import "server-only";
import { randomUUID as uid } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { plan, spec, issue, agent, notification, backlogItem, message, goal, task, workspace as workspaceTable } from "@/db/schema";
import { notifyOps } from "@/lib/notify";
import { logDecision } from "@/server/decisions";
import { resolveInboxFor, resolveInboxRefTypes } from "@/server/inbox";
import { writeDoc } from "@/lib/workspace-doc";
import { materializeTasks } from "./materialize";

/**
 * Session-LESS plan operations, keyed by an explicit (orgId, workspace) — the shared core behind
 * both the session-scoped server actions in planner.ts AND the channels that have no session
 * (the Telegram remote control, and later the public API). This module is `server-only`, NOT
 * `"use server"`, so these cores are never exposed as unauthenticated RPC endpoints — every caller
 * must already have proved it's allowed to act on this workspace (planner.ts via `requireWorkspace`,
 * Telegram via the single allowlisted chat id).
 */

type WorkspaceRow = typeof workspaceTable.$inferSelect;

/** Approve the CEO's plan for a workspace: approve plan/specs/issues, materialize tasks, groom the
 *  PO backlog doc, have the CEO narrate, notify + clear the inbox. (No revalidatePath — the session
 *  wrapper handles that; off-request callers have no page to revalidate.) */
export async function approvePlanFor(orgId: string, ws: WorkspaceRow): Promise<{ made: number; issues: number }> {
  await db.update(plan).set({ approved: true, stage: 6 }).where(eq(plan.workspaceId, ws.id));
  await db.update(issue).set({ approved: true }).where(eq(issue.workspaceId, ws.id));
  await db.update(spec).set({ approved: true }).where(and(eq(spec.workspaceId, ws.id), eq(spec.status, "active")));
  const made = await materializeTasks(orgId, ws.id);

  const issues = await db.select().from(issue).where(eq(issue.workspaceId, ws.id));
  await db.delete(backlogItem).where(eq(backlogItem.workspaceId, ws.id));
  for (const i of issues) {
    await db.insert(backlogItem).values({ id: uid(), workspaceId: ws.id, title: i.title, moscow: i.moscow ?? "Should", points: i.points });
  }
  const backlogMd = `# Product backlog — ${ws.name}\n\n_Groomed from the approved plan._\n\n${issues.map((i) => `- [ ] (${i.prio}) ${i.key} — ${i.title}`).join("\n")}\n`;
  try { await writeDoc(orgId, "PO/backlog.md", backlogMd); } catch (e) { console.error("[approvePlanFor] backlog write failed:", e); }

  const [ada] = await db.select().from(agent).where(and(eq(agent.workspaceId, ws.id), eq(agent.handle, "ada")));
  const ceo = ada ?? (await db.select().from(agent).where(eq(agent.workspaceId, ws.id)))[0];
  if (ceo) {
    await db.insert(message).values({
      id: uid(), workspaceId: ws.id, channel: "room", fromKind: "agent", fromHandle: ceo.handle,
      text: `Plan approved — starting execution. ${made} task${made === 1 ? "" : "s"} queued; the team will work the board top to bottom. Turn on Run 24/7 to begin.`,
      createdAt: new Date(),
    });
  }

  await notifyOps(ws.id, { kind: "done", text: "Plan approved — agents may start coding", detail: `${made} task${made === 1 ? "" : "s"} created from the plan.` });
  await logDecision(ws.id, { text: `Plan approved — ${issues.length} issues, ${made} tasks queued for execution`, by: "operator", source: "plan-approve" });
  await resolveInboxFor(ws.id, "plan", ws.id);
  await resolveInboxRefTypes(ws.id, ["spec", "issue"]);
  // Auto-groom the freshly-approved backlog (PO sizes story points + MoSCoW, flags dupes/gaps). Fired
  // async + via dynamic import to avoid a static circular dep with planner.ts; safe off-request (the
  // core takes explicit orgId/ws — no session needed). Best-effort: a groom failure never blocks approve.
  void import("@/server/planner").then((m) => m.groomBacklogFor(orgId, ws)).catch((e) => console.error("[approvePlanFor] auto-groom failed:", e));
  return { made, issues: issues.length };
}

/** Toggle 24/7 autonomous execution for a workspace. */
export async function setAuto247For(wsId: string, on: boolean): Promise<void> {
  await db.update(plan).set({ auto247: on }).where(eq(plan.workspaceId, wsId));
}

/** Send the plan back to Ada for revision — un-approves, halts 24/7, rewinds the pipeline. An
 *  optional reason is recorded so the operator's "why" survives. */
export async function requestPlanChangesFor(wsId: string, reason?: string): Promise<void> {
  await db.update(plan).set({ approved: false, auto247: false, stage: 1 }).where(eq(plan.workspaceId, wsId));
  await resolveInboxFor(wsId, "plan", wsId);
  await db.insert(notification).values({
    id: uid(), workspaceId: wsId, kind: "info",
    text: "Plan sent back to Ada for revision",
    detail: reason?.trim() ? `Operator requested changes: ${reason.trim().slice(0, 280)}` : "The operator requested changes before any code is written.",
  });
}

/* ----------------------------------------------------------- read-only summaries (mobile context) */

/** One-line status — active goals · open issues · tasks in flight · 24/7 · plan state. */
export async function planStatusFor(ws: WorkspaceRow): Promise<string> {
  const [goals, issues, doing, [p]] = await Promise.all([
    db.select({ status: goal.status }).from(goal).where(eq(goal.workspaceId, ws.id)),
    db.select({ col: issue.col }).from(issue).where(eq(issue.workspaceId, ws.id)),
    db.select({ id: task.id }).from(task).where(and(eq(task.workspaceId, ws.id), eq(task.col, "doing"))),
    db.select().from(plan).where(eq(plan.workspaceId, ws.id)),
  ]);
  const activeGoals = goals.filter((g) => g.status === "active").length;
  const openIssues = issues.filter((i) => i.col !== "done").length;
  const planState = !p ? "none" : p.approved ? "approved" : "draft";
  return `📊 ${ws.name} — ${activeGoals} active goal(s) · ${openIssues} open issue(s) · ${doing.length} task(s) in flight · 24/7 ${p?.auto247 ? "ON" : "off"} · plan ${planState}.`;
}

/** Rich mobile review — plan state, goals, specs, issues by column, tasks in flight, next steps. */
export async function reviewSummaryFor(ws: WorkspaceRow): Promise<string> {
  const [goals, specs, issues, tasks, [p]] = await Promise.all([
    db.select({ title: goal.title, status: goal.status }).from(goal).where(eq(goal.workspaceId, ws.id)),
    db.select({ status: spec.status }).from(spec).where(eq(spec.workspaceId, ws.id)),
    db.select({ key: issue.key, title: issue.title, col: issue.col, prio: issue.prio }).from(issue).where(eq(issue.workspaceId, ws.id)),
    db.select({ col: task.col }).from(task).where(eq(task.workspaceId, ws.id)),
    db.select().from(plan).where(eq(plan.workspaceId, ws.id)),
  ]);
  const activeGoals = goals.filter((g) => g.status === "active");
  const cnt = (c: string) => issues.filter((i) => i.col === c).length;
  const taskDoing = tasks.filter((t) => t.col === "doing").length;
  const planState = !p ? "none" : p.approved ? "✅ approved" : `📝 draft (stage ${p.stage})`;
  const PRIO = { high: 3, med: 2, low: 1 } as const;
  const next = issues
    .filter((i) => i.col !== "done")
    .sort((a, b) => (PRIO[b.prio] - PRIO[a.prio]) || a.key.localeCompare(b.key))
    .slice(0, 5);

  const lines = [
    `📊 ${ws.name} — review`,
    `Plan: ${planState} · 24/7 ${p?.auto247 ? "ON" : "off"}`,
    `Goals: ${activeGoals.length} active / ${goals.length} total`,
    `Specs: ${specs.filter((s) => s.status === "active").length} active`,
    `Issues: todo ${cnt("todo")} · doing ${cnt("doing")} · review ${cnt("review")} · blocked ${cnt("blocked")} · done ${cnt("done")} (of ${issues.length})`,
    `Tasks in flight: ${taskDoing}`,
  ];
  if (activeGoals[0]) lines.push(`Active goal: “${activeGoals[0].title}”`);
  if (next.length) lines.push(`Next up:\n${next.map((i) => `  • (${i.prio}) ${i.key} — ${i.title}`).join("\n")}`);
  return lines.join("\n").slice(0, 3500);
}

/** Tasks currently in flight + queued (for the /tasks command). */
export async function tasksListFor(ws: WorkspaceRow): Promise<string> {
  const rows = await db.select({ key: task.key, title: task.title, col: task.col, prio: task.prio })
    .from(task).where(eq(task.workspaceId, ws.id));
  const doing = rows.filter((t) => t.col === "doing");
  const todo = rows.filter((t) => t.col === "todo" || t.col === "triage");
  const review = rows.filter((t) => t.col === "review");
  const fmt = (t: { key: string; title: string }) => `  • ${t.key} — ${t.title}`;
  const parts = [`🗂️ ${ws.name} — tasks`];
  parts.push(`Doing (${doing.length}):${doing.length ? "\n" + doing.slice(0, 10).map(fmt).join("\n") : " —"}`);
  parts.push(`In review (${review.length}):${review.length ? "\n" + review.slice(0, 8).map(fmt).join("\n") : " —"}`);
  parts.push(`Queued (${todo.length}):${todo.length ? "\n" + todo.slice(0, 10).map(fmt).join("\n") : " —"}`);
  return parts.join("\n").slice(0, 3500);
}
