import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { goal, issue, task, spec, plan, workspace as workspaceTable } from "@/db/schema";

/**
 * Shared read service for the public API (and any other channel that wants structured project
 * state). Mutations reuse the session-less cores directly — plan-ops.ts (approve / reject / 24-7)
 * and work-ops.ts (cancel / archive). Keeping these reads here means the REST routes, a future MCP
 * server and the CLI all return the SAME shapes.
 */

type WorkspaceRow = typeof workspaceTable.$inferSelect;

export async function apiStatus(ws: WorkspaceRow) {
  const [goals, issues, tasks, [p]] = await Promise.all([
    db.select({ status: goal.status }).from(goal).where(eq(goal.workspaceId, ws.id)),
    db.select({ col: issue.col }).from(issue).where(eq(issue.workspaceId, ws.id)),
    db.select({ col: task.col }).from(task).where(eq(task.workspaceId, ws.id)),
    db.select().from(plan).where(eq(plan.workspaceId, ws.id)),
  ]);
  const byCol = (rows: { col: string }[]) => rows.reduce<Record<string, number>>((m, r) => ((m[r.col] = (m[r.col] ?? 0) + 1), m), {});
  return {
    workspace: { id: ws.id, name: ws.name, slug: ws.slug },
    goals: { active: goals.filter((g) => g.status === "active").length, total: goals.length },
    issues: { open: issues.filter((i) => i.col !== "done").length, total: issues.length, byCol: byCol(issues) },
    tasks: { doing: tasks.filter((t) => t.col === "doing").length, total: tasks.length, byCol: byCol(tasks) },
    plan: p ? { approved: p.approved, auto247: p.auto247, stage: p.stage } : null,
  };
}

export async function apiGoals(wsId: string) {
  const rows = await db.select({ id: goal.id, title: goal.title, status: goal.status, progress: goal.progress }).from(goal).where(eq(goal.workspaceId, wsId));
  return rows;
}

export async function apiIssues(wsId: string) {
  const rows = await db.select({ id: issue.id, key: issue.key, title: issue.title, col: issue.col, prio: issue.prio, points: issue.points, moscow: issue.moscow, approved: issue.approved }).from(issue).where(eq(issue.workspaceId, wsId));
  return rows;
}

export async function apiTasks(wsId: string) {
  const rows = await db.select({ id: task.id, key: task.key, title: task.title, col: task.col, prio: task.prio }).from(task).where(eq(task.workspaceId, wsId));
  return rows;
}

export async function apiSpecs(wsId: string) {
  const rows = await db.select({ id: spec.id, key: spec.key, title: spec.title, status: spec.status, approved: spec.approved }).from(spec).where(eq(spec.workspaceId, wsId));
  return rows;
}
