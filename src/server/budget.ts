"use server";

import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { budget, agent } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";

/** Monthly cap autosave (Costs). Budgets are enforced server-side at dispatch time. */
export async function setMonthlyCap(usd: number) {
  const { workspace } = await requireWorkspace();
  await db.update(budget).set({ monthlyCapUsd: Math.max(0, usd) }).where(eq(budget.workspaceId, workspace.id));
  revalidatePath("/costs");
}

export async function setAgentDailyCap(agentId: string, usd: number) {
  const { workspace } = await requireWorkspace();
  // Scope the UPDATE to the caller's workspace — otherwise any authenticated user
  // could set the cap on another org's agent (cross-tenant IDOR).
  await db.update(agent).set({ dailyCapUsd: Math.max(0, usd) })
    .where(and(eq(agent.id, agentId), eq(agent.workspaceId, workspace.id)));
  revalidatePath("/costs");
  revalidatePath("/agents/[handle]", "page");
}

/**
 * Hard ceiling check used by the agent dispatcher (server-side enforcement):
 * an agent may only spend if it is under BOTH its daily cap and the monthly cap.
 */
export async function canDispatch(workspaceId: string, agentId: string, spentTodayUsd: number, monthlySpentUsd: number) {
  const [b] = await db.select().from(budget).where(eq(budget.workspaceId, workspaceId));
  const [a] = await db.select().from(agent).where(eq(agent.id, agentId));
  if (!b || !a) return false;
  return spentTodayUsd < a.dailyCapUsd && monthlySpentUsd < b.monthlyCapUsd;
}
