import "server-only";
import { randomUUID as uid } from "node:crypto";
import { eq, and, like } from "drizzle-orm";
import { db } from "@/db";
import { task, issue, spec, agent, taskStep } from "@/db/schema";
import { readWorkspaceFile } from "@/lib/fs-workspace";

/** Parse `- [ ]` / `- [x]` checklist lines out of markdown → TODO steps. */
export function parseChecklist(md: string): { text: string; done: boolean }[] {
  const out: { text: string; done: boolean }[] = [];
  for (const line of md.split("\n")) {
    const m = line.match(/^\s*-\s*\[([ xX])\]\s+(.+)$/);
    if (m) out.push({ text: m[2].trim().slice(0, 200), done: m[1].toLowerCase() === "x" });
  }
  return out.slice(0, 12);
}

/** Sync a task's TODO steps from a `## Checklist` the agent emitted in its run output:
 *  update done-state on matching steps (by text), append any new ones. The basis for live
 *  issue/goal progress. */
export async function syncTaskChecklist(wsId: string, taskId: string, agentText: string): Promise<void> {
  const items = parseChecklist(agentText);
  if (!items.length) return;
  const existing = await db.select().from(taskStep).where(eq(taskStep.taskId, taskId));
  const byText = new Map(existing.map((s) => [s.text.toLowerCase(), s]));
  let ord = existing.length;
  for (const it of items) {
    const ex = byText.get(it.text.toLowerCase());
    if (ex) { if (ex.done !== it.done) await db.update(taskStep).set({ done: it.done }).where(eq(taskStep.id, ex.id)); }
    else { await db.insert(taskStep).values({ id: uid(), workspaceId: wsId, taskId, text: it.text, done: it.done, ord: ord++ }); }
  }
}

/**
 * Convert every issue into an executable `task` row so the runner (which only executes
 * tasks) can pick them up. Idempotent — skips issues that already have a task
 * (`task.issueId`), so a re-approve after a re-plan materializes only the new ones
 * (never duplicates). Plain lib (not a server action) so it isn't web-exposed.
 * Returns the number of tasks created.
 */
export async function materializeTasks(orgId: string, wsId: string): Promise<number> {
  const issues = await db.select().from(issue).where(eq(issue.workspaceId, wsId));
  const specs = await db.select().from(spec).where(eq(spec.workspaceId, wsId));
  const summaryById = Object.fromEntries(specs.map((s) => [s.id, s.summary]));
  const existing = await db.select({ issueId: task.issueId }).from(task).where(eq(task.workspaceId, wsId));
  const done = new Set(existing.map((t) => t.issueId).filter(Boolean));
  let made = 0;
  for (const i of issues) {
    if (done.has(i.id)) continue;
    const md = readWorkspaceFile(orgId, `issues/${i.key}.md`) ?? "";
    // Carry the planner's "Skills to consult" line into the task so the executing agent is told to read
    // the matching .claude/skills/<name>.md before building (its role skills are already pinned too).
    const skillsLine = md.match(/^\*\*Skills to consult:\*\*\s*(.+)$/m)?.[1]?.trim();
    const consult = skillsLine ? `\n\nConsult these skills BEFORE building (read the matching .claude/skills/<name>.md): ${skillsLine}.` : "";
    const desc = (((i.specId ? summaryById[i.specId] : "") || md).slice(0, 2000) + consult).slice(0, 2200);
    const taskId = uid();
    await db.insert(task).values({
      id: taskId, workspaceId: wsId, issueId: i.id, goalId: i.goalId, key: i.key, title: i.title,
      description: desc, col: "todo", prio: i.prio, assigneeId: i.assigneeId, createdBy: "agent",
    });
    // Seed the issue's TODOs (its `## Checklist`) as task steps → the progress basis.
    let ord = 0;
    for (const s of parseChecklist(md)) {
      await db.insert(taskStep).values({ id: uid(), workspaceId: wsId, taskId, text: s.text, done: s.done, ord: ord++ });
    }
    made++;
  }
  await ensureDocsTask(wsId);
  return made;
}

/**
 * 100% automatic docs: ensure a Docs task (@barbara) exists so the autonomous loop ALWAYS
 * documents the build. Created last → the runner picks it after the other tasks drain, so
 * Barbara reads the real code/specs and rewrites DOCS/ to match. Idempotent (fixed key).
 */
export async function ensureDocsTask(wsId: string): Promise<void> {
  const [barbara] = await db.select().from(agent).where(and(eq(agent.workspaceId, wsId), eq(agent.handle, "barbara")));
  const docs = barbara ?? (await db.select().from(agent).where(and(eq(agent.workspaceId, wsId), like(agent.role, "%Docs%"))))[0];
  if (!docs) return;
  const existing = await db.select({ id: task.id }).from(task).where(and(eq(task.workspaceId, wsId), eq(task.key, "DOCS-1")));
  if (existing.length) return;
  await db.insert(task).values({
    id: uid(), workspaceId: wsId, key: "DOCS-1",
    title: "Document the project — update DOCS/ to match what was built",
    description: "Read the real code, specs and structure in this workspace, then write/refresh accurate documentation under DOCS/ (architecture, API, usage, how to run). Replace the scaffold templates with real content grounded in the actual files. Do not invent features.",
    col: "todo", prio: "low", assigneeId: docs.id, createdBy: "agent",
  });
}
