"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/workspace";
import { cancelRunToken, stopAllRunsForWorkspace } from "@/server/run-control";

/** Stop an in-flight agent run by its token (a chat reply, a Design turn, a planner draft, …).
 *  Always reports success once a token is given — the run either dies now (already spawned) or
 *  self-kills the moment it spawns (claim→spawn race), so there's nothing for the UI to retry. */
export async function cancelRun(token: string): Promise<{ ok: boolean }> {
  await requireWorkspace(); // authorize — any signed-in operator of this workspace may stop a run
  return cancelRunToken(token);
}

/** Pulse "Stop All" — interrupt every agent at once. PARKS (not cancels) every active goal's tasks:
 *  work-ops.ts's parkGoalTasks interrupts the in-flight process, sets running tasks to "blocked" and frees
 *  the assignee — the goal itself stays "active" and is resumable per-task via the Tasks/PM board's
 *  existing Unblock button (never a dead end). Any OTHER in-flight run (chat/design/planner-draft/review/
 *  deploy/grooming) is aborted via its registered token, and every agent still marked "working" is freed. */
export async function stopAllRuns(): Promise<{ ok: boolean; stopped: number }> {
  const { workspace } = await requireWorkspace();
  const r = await stopAllRunsForWorkspace(workspace.id);
  revalidatePath("/", "layout");
  return r;
}
