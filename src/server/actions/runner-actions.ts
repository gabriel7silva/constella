"use server";

import { revalidatePath } from "next/cache";
import { eq, and, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { workspace, plan, task } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";
import { isDevMode } from "@/lib/build-mode";
import { tickWorkspace } from "../runner";
import { materializeTasks } from "../materialize";

/**
 * Advance the current workspace one step. Called by the UI heartbeat
 * (a client interval) or manually. Always scoped to the caller's workspace.
 */
/** Browser heartbeat — refreshes pulse/health only (never spends money). */
export async function tick() {
  const { workspace: ws } = await requireWorkspace();
  if (!ws.runMode || ws.runMode === "off") return { paused: true as const };
  const r = await tickWorkspace(ws.id, { execute: false });
  // Only invalidate the layout cache when something actually changed — otherwise this
  // 8s heartbeat forces a full RSC layout re-render (5 DB queries) on every idle tick.
  if ((r.changed ?? 0) > 0 || (r.advanced ?? 0) > 0) revalidatePath("/", "layout");
  return { ...r, paused: false as const };
}

/**
 * Browser-driven autonomous step. Executes ONE task iff the plan is approved AND
 * Run 24/7 is on, then reports whether more runnable work remains so the client can
 * chain to the next task (organic continue). Gated identically to the cron path —
 * a stray tab can't run code while paused. Spends real budget (operator opted in).
 */
export async function autoTick(): Promise<{ ran: boolean; remaining: number; paused: boolean }> {
  const { org, workspace: ws } = await requireWorkspace();
  const pl = await db.query.plan.findFirst({ where: eq(plan.workspaceId, ws.id) });
  if (!pl?.approved || !pl?.auto247) return { ran: false, remaining: 0, paused: true };
  // Self-heal: a plan approved before the issues→tasks bridge has issues but no tasks. Materialize once.
  const anyTask = await db.select({ id: task.id }).from(task).where(eq(task.workspaceId, ws.id)).limit(1);
  if (anyTask.length === 0) await materializeTasks(org.id, ws.id);
  const r = await tickWorkspace(ws.id, { execute: true, auto: true, browser: true });
  // remaining = tasks still runnable (todo/doing with an assignee). Blocked/review/done excluded.
  const runnable = await db.select({ id: task.id }).from(task)
    .where(and(eq(task.workspaceId, ws.id), inArray(task.col, ["todo", "doing"]), isNotNull(task.assigneeId)));
  revalidatePath("/", "layout");
  return { ran: (r.advanced ?? 0) > 0, remaining: runnable.length, paused: false };
}

/** Explicit real step — dispatches one task to a real agent CLI (spends real budget). */
export async function runStep() {
  const { workspace: ws } = await requireWorkspace();
  const r = await tickWorkspace(ws.id, { execute: true });
  revalidatePath("/", "layout");
  return r;
}

/** Change the run-mode (off pauses the autonomous loop). */
export async function setRunMode(mode: "off" | "start" | "auth" | "vps" | "portable") {
  const { workspace: ws } = await requireWorkspace();
  // In a public/compiled build the mode is fixed by the launch command (`constella --<mode>`); the
  // UI chips are dev-only. Refuse a mutation from a shipped build so a crafted POST can't flip it.
  if (!isDevMode()) return { runMode: ws.runMode };
  await db.update(workspace).set({ runMode: mode }).where(eq(workspace.id, ws.id));
  revalidatePath("/", "layout");
  return { runMode: mode };
}
