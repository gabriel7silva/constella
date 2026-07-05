"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { workspace, budget, organization } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";

export async function updateWorkspace(input: { name?: string; mission?: string; objective?: string }) {
  const { workspace: ws } = await requireWorkspace();
  const patch: Partial<typeof workspace.$inferInsert> = {};
  if (typeof input.name === "string" && input.name.trim()) patch.name = input.name.trim();
  if (typeof input.mission === "string") patch.mission = input.mission;
  if (typeof input.objective === "string") patch.objective = input.objective;
  if (Object.keys(patch).length === 0) return;
  await db.update(workspace).set(patch).where(eq(workspace.id, ws.id));
  revalidatePath("/config");
  revalidatePath("/", "layout");
}

/** Persist the monthly budget cap (USD). Upserts the workspace budget row. */
export async function setMonthlyCap(usd: number) {
  const { workspace: ws } = await requireWorkspace();
  const cap = Number.isFinite(usd) && usd >= 0 ? Math.round(usd) : 0;
  await db
    .insert(budget)
    .values({ workspaceId: ws.id, monthlyCapUsd: cap })
    .onConflictDoUpdate({ target: budget.workspaceId, set: { monthlyCapUsd: cap } });
  revalidatePath("/config");
  return { monthlyCapUsd: cap };
}

/** Persist editor preferences onto workspace.settings.editor (merge). */
export async function setEditorSettings(patch: { tabSize?: number; formatOnSave?: boolean; wordWrap?: boolean; minimap?: boolean }) {
  const { workspace: ws } = await requireWorkspace();
  const cur = ws.settings ?? {};
  await db.update(workspace).set({ settings: { ...cur, editor: { ...cur.editor, ...patch } } }).where(eq(workspace.id, ws.id));
  revalidatePath("/config");
}

/** Toggle an integration on/off in workspace.settings.integrations (merge). */
export async function toggleIntegration(id: string, on: boolean) {
  const { workspace: ws } = await requireWorkspace();
  const cur = ws.settings ?? {};
  await db.update(workspace).set({ settings: { ...cur, integrations: { ...cur.integrations, [id]: on } } }).where(eq(workspace.id, ws.id));
  revalidatePath("/config");
}

/** Persist parallel-agent runtime settings onto workspace.settings.agents (merge). The runner reads
 *  maxConcurrent for the per-workspace cap; fileLocks flips the per-file lock hook for its spawns. */
export async function setAgentRuntime(patch: { maxConcurrent?: number; fileLocks?: boolean; webResearch?: boolean }) {
  const { workspace: ws } = await requireWorkspace();
  const cur = ws.settings ?? {};
  const clean: { maxConcurrent?: number; fileLocks?: boolean; webResearch?: boolean } = {};
  if (typeof patch.maxConcurrent === "number") clean.maxConcurrent = Math.max(1, Math.min(5, Math.round(patch.maxConcurrent)));
  if (typeof patch.fileLocks === "boolean") clean.fileLocks = patch.fileLocks;
  if (typeof patch.webResearch === "boolean") clean.webResearch = patch.webResearch;
  await db.update(workspace).set({ settings: { ...cur, agents: { ...cur.agents, ...clean } } }).where(eq(workspace.id, ws.id));
  revalidatePath("/config");
}

/** Persist the Design Gate's default onto workspace.settings.design (merge). When `autoSkip` is on,
 *  a new visual request never holds for Grace — it goes straight to the plan, like a permanent
 *  "Skip design & plan anyway" (the in-gate Skip button stays a one-shot bypass; this is the standing
 *  default the operator sets once in Settings instead of clicking Skip every time). */
export async function setDesignSettings(patch: { autoSkip?: boolean }) {
  const { workspace: ws } = await requireWorkspace();
  const cur = ws.settings ?? {};
  const clean: { autoSkip?: boolean } = {};
  if (typeof patch.autoSkip === "boolean") clean.autoSkip = patch.autoSkip;
  await db.update(workspace).set({ settings: { ...cur, design: { ...cur.design, ...clean } } }).where(eq(workspace.id, ws.id));
  revalidatePath("/config");
}

/** Change the organization-wide default run mode (mirrors workspace deploy mode). */
export async function setOrgRunMode(mode: "start" | "auth" | "vps" | "portable") {
  const { org } = await requireWorkspace();
  await db.update(organization).set({ runMode: mode }).where(eq(organization.id, org.id));
  revalidatePath("/config");
  return { runMode: mode };
}
