"use server";

import { randomUUID as uid } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { backlogItem, issue, task, agent } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";
import { writeDoc } from "@/lib/workspace-doc";
import { logDecision } from "@/server/decisions";

type Moscow = "Must" | "Should" | "Could" | "Won't";
type IssueCol = "todo" | "doing" | "blocked" | "review" | "done";

export async function createBacklogItem(input: { title: string; moscow?: Moscow; points?: number }) {
  const { workspace } = await requireWorkspace();
  const title = input.title.trim();
  if (!title) return;
  await db.insert(backlogItem).values({
    id: uid(), workspaceId: workspace.id, title,
    moscow: input.moscow ?? "Should", points: input.points ?? 0,
  });
  revalidatePath("/pm");
}

export async function deleteBacklogItem(id: string) {
  const { workspace } = await requireWorkspace();
  await db.delete(backlogItem).where(and(eq(backlogItem.id, id), eq(backlogItem.workspaceId, workspace.id)));
  revalidatePath("/pm");
}

/** Close the current sprint (session-less core): write a retro doc summarizing what shipped vs what's
 *  carried over, then archive the shipped issues OFF the active board (preserved on disk + in the retro).
 *  Used by the /pm action AND the /close-sprint chat command + the public API. */
export async function closeSprintFor(orgId: string, wsId: string): Promise<{ ok: boolean; shipped: number; carried: number; path?: string }> {
  const all = await db.select().from(issue).where(and(eq(issue.workspaceId, wsId), eq(issue.status, "active")));
  const done = all.filter((i) => i.col === "done");
  const carried = all.filter((i) => i.col !== "done");
  if (!done.length) return { ok: false, shipped: 0, carried: carried.length };
  const date = new Date().toISOString().slice(0, 10);
  const md = [
    `# Sprint retro — ${date}`, ``,
    `## Shipped (${done.length})`, ...done.map((i) => `- ${i.key} — ${i.title}${i.points ? ` (${i.points} pts)` : ""}`), ``,
    `## Carried over (${carried.length})`, ...(carried.length ? carried.map((i) => `- ${i.key} [${i.col}] — ${i.title}`) : ["- (nothing — clean sprint)"]), ``,
    `_Closed ${new Date().toISOString()} by the Product Owner._`, ``,
  ].join("\n");
  const path = `PO/sprint-retro-${date}.md`;
  try { await writeDoc(orgId, path, md); } catch (e) { console.error("[closeSprint] retro write failed:", e); }
  await db.update(issue).set({ status: "archived" }).where(and(eq(issue.workspaceId, wsId), inArray(issue.id, done.map((i) => i.id))));
  await logDecision(wsId, { text: `Sprint closed — ${done.length} shipped, ${carried.length} carried over; retro at ${path}`, by: "donald", source: "po-grooming" });
  return { ok: true, shipped: done.length, carried: carried.length, path };
}

/** Operator-triggered sprint close from the Product Manager (session wrapper). */
export async function closeSprint() {
  const { org, workspace } = await requireWorkspace();
  const r = await closeSprintFor(org.id, workspace.id);
  revalidatePath("/pm"); revalidatePath("/", "layout");
  return r;
}

/** Pull a backlog item into the sprint board as a `todo` issue. */
export async function promoteBacklogItem(id: string) {
  const { workspace } = await requireWorkspace();
  const [b] = await db.select().from(backlogItem).where(and(eq(backlogItem.id, id), eq(backlogItem.workspaceId, workspace.id)));
  if (!b) return;
  const count = (await db.select().from(issue).where(eq(issue.workspaceId, workspace.id))).length;
  await db.insert(issue).values({
    id: uid(), workspaceId: workspace.id, key: "S-" + (count + 1),
    title: b.title, col: "todo", prio: "med", moscow: b.moscow, points: b.points,
  });
  await db.delete(backlogItem).where(eq(backlogItem.id, id));
  revalidatePath("/pm");
}

export async function moveIssue(id: string, col: IssueCol) {
  const { workspace } = await requireWorkspace();
  await db.update(issue).set({ col }).where(and(eq(issue.id, id), eq(issue.workspaceId, workspace.id)));
  revalidatePath("/pm");
}

export async function setIssueMoscow(id: string, moscow: Moscow) {
  const { workspace } = await requireWorkspace();
  await db.update(issue).set({ moscow }).where(and(eq(issue.id, id), eq(issue.workspaceId, workspace.id)));
  revalidatePath("/pm");
}

/** PO/operator blocks an issue — its linked task is blocked too so the runner stops picking it up. */
export async function blockIssue(id: string) {
  const { workspace } = await requireWorkspace();
  await db.update(issue).set({ col: "blocked" }).where(and(eq(issue.id, id), eq(issue.workspaceId, workspace.id)));
  await db.update(task).set({ col: "blocked" }).where(and(eq(task.issueId, id), eq(task.workspaceId, workspace.id)));
  revalidatePath("/pm"); revalidatePath("/tasks");
}

/** Unblock — issue + linked task return to `todo` and the assignee is freed (idle) so it can run again. */
export async function unblockIssue(id: string) {
  const { workspace } = await requireWorkspace();
  await db.update(issue).set({ col: "todo" }).where(and(eq(issue.id, id), eq(issue.workspaceId, workspace.id)));
  const [t] = await db.update(task).set({ col: "todo" }).where(and(eq(task.issueId, id), eq(task.workspaceId, workspace.id))).returning();
  if (t?.assigneeId) await db.update(agent).set({ status: "idle" }).where(eq(agent.id, t.assigneeId));
  revalidatePath("/pm"); revalidatePath("/tasks");
}
