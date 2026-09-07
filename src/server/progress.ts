import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { goal, issue, task, taskStep, agent } from "@/db/schema";

const COL_PROGRESS: Record<string, number> = { triage: 0, todo: 0, blocked: 25, doing: 50, review: 80, done: 100 };

export type IssueRollup = {
  id: string; key: string; title: string; col: string; progress: number;
  steps: { done: number; total: number }; assignee: { handle: string; name: string; color: string } | null;
  updatedAt: Date | null;
};
export type GoalRollup = {
  id: string; title: string; description: string; status: string; specId: string | null;
  progress: number; issues: IssueRollup[];
  createdAt: Date | null; doneAt: Date | null; cancelledAt: Date | null; archivedAt: Date | null;
};

/**
 * Compute live progress for every goal in a workspace. Issue % comes from its task's
 * TODO checklist (taskStep done/total); if an issue has no steps it falls back to its
 * column. Goal % is the AVERAGE of its issues' progress (so 1 of 10 issues fully done ≈
 * 10%, and partial issues count). Computed on read — no drift.
 */
export async function goalRollups(workspaceId: string): Promise<GoalRollup[]> {
  const [goals, issues, tasks, steps, agents] = await Promise.all([
    db.select().from(goal).where(eq(goal.workspaceId, workspaceId)),
    db.select().from(issue).where(eq(issue.workspaceId, workspaceId)),
    db.select().from(task).where(eq(task.workspaceId, workspaceId)),
    db.select().from(taskStep).where(eq(taskStep.workspaceId, workspaceId)),
    db.select().from(agent).where(eq(agent.workspaceId, workspaceId)),
  ]);
  const taskByIssue = new Map(tasks.filter((t) => t.issueId).map((t) => [t.issueId as string, t]));
  const stepsByTask = new Map<string, typeof steps>();
  for (const s of steps) { const a = stepsByTask.get(s.taskId) ?? []; a.push(s); stepsByTask.set(s.taskId, a as typeof steps); }
  const agentById = new Map(agents.map((a) => [a.id, a]));

  const issueRollup = (i: typeof issues[number]): IssueRollup => {
    const t = taskByIssue.get(i.id);
    const col = (t?.col ?? i.col) as string;
    const st = (t ? stepsByTask.get(t.id) : undefined) ?? [];
    const total = st.length;
    // A DONE column is authoritative: a finished item is 100% with all its todos ticked — never show a
    // "Done" issue at 0% just because its checklist wasn't parsed from the agent's reply. Otherwise the
    // live step ratio drives the %, falling back to the column when there are no steps.
    const isDone = col === "done";
    const done = isDone && total > 0 ? total : st.filter((s) => s.done).length;
    const progress = isDone ? 100 : (total > 0 ? Math.round((done / total) * 100) : (COL_PROGRESS[col] ?? 0));
    const a = i.assigneeId ? agentById.get(i.assigneeId) : null;
    return {
      id: i.id, key: i.key, title: i.title, col, progress,
      steps: { done, total }, assignee: a ? { handle: a.handle, name: a.name, color: a.color } : null,
      updatedAt: (i.updatedAt ?? null) as Date | null,
    };
  };

  const flips: string[] = []; // goals that hit 100% while still active → auto-complete
  const rolls = goals.map((g) => {
    const gIssues = issues.filter((i) => i.goalId === g.id).map(issueRollup);
    const computed = gIssues.length ? Math.round(gIssues.reduce((s, i) => s + i.progress, 0) / gIssues.length) : g.progress;
    // Progress + status drift only while ACTIVE. Once a goal settles (done/cancelled/archived) its
    // % is STICKY (the cached value), so a later blocked/added issue can't make a "Done" goal show
    // e.g. 62% — and we never demote done→active here.
    let status = g.status;
    let progress = computed;
    if (status === "active") {
      if (computed >= 100) { status = "done"; progress = 100; flips.push(g.id); } // auto-complete
    } else {
      progress = g.progress; // sticky cached for done/cancelled/archived
    }
    // A cancelled/archived goal's issues read as cancelled/archived (not their last work column).
    const displayIssues = (status === "cancelled" || status === "archived")
      ? gIssues.map((i) => ({ ...i, col: status }))
      : gIssues;
    return {
      id: g.id, title: g.title, description: g.description, status, specId: g.specId, progress, issues: displayIssues,
      createdAt: (g.createdAt ?? null) as Date | null, doneAt: (g.doneAt ?? null) as Date | null,
      cancelledAt: (g.cancelledAt ?? null) as Date | null, archivedAt: (g.archivedAt ?? null) as Date | null,
    };
  });
  // Compare-and-set: only the first writer that still sees the goal "active" stamps done + doneAt;
  // concurrent/late writers (or a reopen in the gap) no-op.
  for (const id of flips) {
    try { await db.update(goal).set({ status: "done", progress: 100, doneAt: new Date() }).where(and(eq(goal.id, id), eq(goal.status, "active"))); } catch { /* read-path write is best-effort */ }
  }
  return rolls;
}

/** Refresh the cached goal.progress for one goal (called by the runner after a task advances).
 *  ONLY while the goal is active — a settled (done/cancelled/archived) goal keeps its cached % so
 *  a late/blocked issue can't drift a "Done" goal below 100%. */
export async function recomputeGoalProgress(workspaceId: string, goalId: string): Promise<void> {
  const rolls = await goalRollups(workspaceId);
  const g = rolls.find((r) => r.id === goalId);
  if (!g || g.status !== "active") return;
  await db.update(goal).set({ progress: g.progress }).where(eq(goal.id, goalId));
}
