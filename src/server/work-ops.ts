import "server-only";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import AdmZip from "adm-zip";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { goal, task, issue, spec, decision, report, taskStep, agent } from "@/db/schema";
import { orgRoot } from "@/lib/fs-workspace";
import { abortRun } from "@/server/adapters/cli";
import { goalFilePaths } from "@/server/goal-files";
import { logDecision } from "@/server/decisions";
import { resolveInboxForGoal } from "@/server/inbox";
import { notifyOps } from "@/lib/notify";

/**
 * Session-LESS goal lifecycle cores, keyed by explicit (orgId, wsId) — the shared core behind the
 * session-scoped server actions in actions/work-actions.ts AND the channels with no session (the
 * Telegram remote control, the public API later). `server-only`, NOT `"use server"`: never an
 * unauthenticated RPC endpoint. Callers must already be authorized for the workspace.
 */

type Goal = typeof goal.$inferSelect;

export async function ownGoal(wsId: string, goalId: string): Promise<Goal | undefined> {
  const [g] = await db.select().from(goal).where(and(eq(goal.id, goalId), eq(goal.workspaceId, wsId)));
  return g;
}
export function slug(s: string): string {
  return (s || "work").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "work";
}

/** Park a goal's tasks out of the runnable set (+ SIGKILL any in-flight run, mirror issues,
 *  free assignees). Used by cancel/archive so nothing for the goal keeps running. */
export async function parkGoalTasks(wsId: string, goalId: string): Promise<void> {
  const tasks = await db.select().from(task).where(and(eq(task.workspaceId, wsId), eq(task.goalId, goalId)));
  for (const t of tasks) {
    abortRun(t.id); // kill the live CLI process (or mark so a mid-claim run self-kills on spawn)
    if (t.col === "todo" || t.col === "doing") {
      await db.update(task).set({ col: "blocked" }).where(eq(task.id, t.id));
      if (t.issueId) await db.update(issue).set({ col: "blocked" }).where(eq(issue.id, t.issueId));
    }
    if (t.assigneeId) await db.update(agent).set({ status: "idle" }).where(eq(agent.id, t.assigneeId));
  }
}
export async function unparkGoalTasks(wsId: string, goalId: string): Promise<void> {
  const tasks = await db.select().from(task).where(and(eq(task.workspaceId, wsId), eq(task.goalId, goalId), eq(task.col, "blocked")));
  for (const t of tasks) {
    await db.update(task).set({ col: "todo" }).where(eq(task.id, t.id));
    if (t.issueId) await db.update(issue).set({ col: "todo" }).where(eq(issue.id, t.issueId));
  }
}

/** Cascade a goal's lifecycle onto its specs + issues so nothing tied to a cancelled/archived
 *  goal keeps reading as pending/active in the Planner. Reversible (set back to 'active'). */
export async function setGoalChildrenStatus(wsId: string, goalId: string, status: "active" | "cancelled" | "archived"): Promise<void> {
  await db.update(spec).set({ status }).where(and(eq(spec.workspaceId, wsId), eq(spec.goalId, goalId)));
  await db.update(issue).set({ status }).where(and(eq(issue.workspaceId, wsId), eq(issue.goalId, goalId)));
}

/** Cancel a Goal: stop ALL its work immediately (kill in-flight runs + park tasks), PRESERVE
 *  everything (DB rows, files) so it can be reopened. */
export async function cancelGoalFor(wsId: string, goalId: string): Promise<{ ok: boolean; title?: string }> {
  const g = await ownGoal(wsId, goalId);
  if (!g) return { ok: false };
  await db.update(goal).set({ status: "cancelled", cancelledAt: new Date() }).where(eq(goal.id, goalId));
  await setGoalChildrenStatus(wsId, goalId, "cancelled");
  await resolveInboxForGoal(wsId, goalId);
  await parkGoalTasks(wsId, goalId);
  await logDecision(wsId, { text: `Cancelled goal: ${g.title}`, by: "operator", source: "operator-instruction", goalId });
  await notifyOps(wsId, { kind: "info", text: `Goal cancelled — ${g.title}`, detail: "Execution stopped; state preserved. Reopen to resume." });
  return { ok: true, title: g.title };
}

/** Archive a WORK (goal): ZIP ONLY what this goal produced — its source files + a manifest of its
 *  specs/issues/tasks/todos/decisions/reports. Parks execution; restorable. */
export async function archiveGoalFor(orgId: string, wsId: string, goalId: string): Promise<{ ok: boolean; path?: string; title?: string }> {
  const g = await ownGoal(wsId, goalId);
  if (!g) return { ok: false };
  const root = orgRoot(orgId);

  const [specs, issues, tasks, decisions, reports] = await Promise.all([
    db.select().from(spec).where(and(eq(spec.workspaceId, wsId), eq(spec.goalId, goalId))),
    db.select().from(issue).where(and(eq(issue.workspaceId, wsId), eq(issue.goalId, goalId))),
    db.select().from(task).where(and(eq(task.workspaceId, wsId), eq(task.goalId, goalId))),
    db.select().from(decision).where(and(eq(decision.workspaceId, wsId), eq(decision.goalId, goalId))),
    db.select().from(report).where(and(eq(report.workspaceId, wsId), eq(report.goalId, goalId))),
  ]);
  const taskIds = tasks.map((t) => t.id);
  const steps = taskIds.length ? await db.select().from(taskStep).where(inArray(taskStep.taskId, taskIds)) : [];
  const files = await goalFilePaths(wsId, goalId);

  const zip = new AdmZip();
  let added = 0;
  for (const rel of files) {
    const abs = join(root, rel);
    if (existsSync(abs)) { try { zip.addFile("files/" + rel, readFileSync(abs)); added++; } catch { /* skip */ } }
  }
  const manifest = { goal: g, specs, issues, tasks, taskSteps: steps, decisions, reports, fileCount: added, archivedAt: new Date().toISOString() };
  const manifestMd = [
    `# Archived work — ${g.title}`, ``, `Status at archive: ${g.status} · progress ${g.progress}%`, ``,
    `## Specs (${specs.length})`, ...specs.map((s) => `- ${s.key} ${s.title}`), ``,
    `## Issues (${issues.length})`, ...issues.map((i) => `- ${i.key} [${i.col}] ${i.title}`), ``,
    `## Decisions (${decisions.length})`, ...decisions.map((d) => `- ${d.text} (${d.by})`), ``,
    `## Source files (${added})`, ...files.map((f) => `- ${f}`), ``,
  ].join("\n");
  zip.addFile("MANIFEST.json", Buffer.from(JSON.stringify(manifest, null, 2)));
  zip.addFile("MANIFEST.md", Buffer.from(manifestMd));

  const archivesDir = join(root, "archives");
  mkdirSync(archivesDir, { recursive: true });
  const rel = `archives/${slug(g.title)}-${new Date().toISOString().slice(0, 10)}-${goalId.slice(0, 6)}.zip`;
  try { zip.writeZip(join(root, rel)); } catch (e) { console.error("[archiveGoalFor] zip failed:", e); return { ok: false }; }

  await db.update(goal).set({ status: "archived", archivePath: rel, archivedAt: new Date() }).where(eq(goal.id, goalId));
  await setGoalChildrenStatus(wsId, goalId, "archived");
  await resolveInboxForGoal(wsId, goalId);
  await parkGoalTasks(wsId, goalId);
  await logDecision(wsId, { text: `Archived goal: ${g.title} → ${rel}`, by: "operator", source: "operator-instruction", goalId });
  await notifyOps(wsId, { kind: "info", text: `Goal archived — ${g.title}`, detail: `${added} files + manifest zipped to ${rel}.` });
  return { ok: true, path: rel, title: g.title };
}
