import "server-only";
import { eq, and, ne } from "drizzle-orm";
import { db } from "@/db";
import { agent, goal } from "@/db/schema";
import { abortRun, listActiveTokens } from "@/server/adapters/cli";
import { abortHttpRun, listActiveHttpTokens } from "@/server/adapters/http";
import { parkGoalTasks } from "@/server/work-ops";

export function cancelRunToken(token: string): { ok: boolean; stopped: boolean } {
  if (!token) return { ok: false, stopped: false };
  const cli = abortRun(token);
  const http = abortHttpRun(token);
  return { ok: true, stopped: cli || http };
}

export async function stopAllRunsForWorkspace(workspaceId: string): Promise<{ ok: boolean; stopped: number }> {
  const activeGoals = await db.select({ id: goal.id }).from(goal).where(and(eq(goal.workspaceId, workspaceId), eq(goal.status, "active")));
  for (const g of activeGoals) await parkGoalTasks(workspaceId, g.id);
  const tokens = [...new Set([...listActiveTokens(), ...listActiveHttpTokens()])];
  for (const tok of tokens) {
    abortRun(tok);
    abortHttpRun(tok);
  }
  await db.update(agent).set({ status: "idle" }).where(and(eq(agent.workspaceId, workspaceId), ne(agent.status, "idle")));
  return { ok: true, stopped: activeGoals.length + tokens.length };
}
