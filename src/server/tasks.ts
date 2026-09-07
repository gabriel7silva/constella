"use server";

import { randomUUID as uid } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { task, taskStep, issue, agent } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";

export async function createTask(input: { title: string; assigneeId?: string; prio?: "low" | "med" | "high"; createdBy?: "operator" | "agent" }) {
  const { workspace } = await requireWorkspace();
  const count = (await db.select().from(task).where(eq(task.workspaceId, workspace.id))).length;
  await db.insert(task).values({
    id: uid(), workspaceId: workspace.id, key: "T-" + (count + 1),
    title: input.title.trim(), col: "triage", prio: input.prio ?? "med",
    assigneeId: input.assigneeId, createdBy: input.createdBy ?? "operator",
  });
  revalidatePath("/tasks");
}

/** Block a task — mirror to its linked issue so the board + Planner agree; runner skips blocked. */
export async function blockTask(id: string) {
  const { workspace } = await requireWorkspace();
  const [t] = await db.update(task).set({ col: "blocked" }).where(and(eq(task.id, id), eq(task.workspaceId, workspace.id))).returning();
  if (t?.issueId) await db.update(issue).set({ col: "blocked" }).where(eq(issue.id, t.issueId));
  revalidatePath("/tasks"); revalidatePath("/pm");
}

/** Unblock — back to `todo`, mirror the issue, free the assignee (idle) so the loop can run it. */
export async function unblockTask(id: string) {
  const { workspace } = await requireWorkspace();
  const [t] = await db.update(task).set({ col: "todo" }).where(and(eq(task.id, id), eq(task.workspaceId, workspace.id))).returning();
  if (t?.issueId) await db.update(issue).set({ col: "todo" }).where(eq(issue.id, t.issueId));
  if (t?.assigneeId) await db.update(agent).set({ status: "idle" }).where(eq(agent.id, t.assigneeId));
  revalidatePath("/tasks"); revalidatePath("/pm");
}

export async function moveTask(id: string, col: "triage" | "todo" | "doing" | "blocked" | "review" | "done") {
  const { workspace } = await requireWorkspace();
  await db.update(task).set({ col }).where(and(eq(task.id, id), eq(task.workspaceId, workspace.id)));
  revalidatePath("/tasks");
}

export async function deleteTask(id: string) {
  const { workspace } = await requireWorkspace();
  await db.delete(task).where(and(eq(task.id, id), eq(task.workspaceId, workspace.id)));
  revalidatePath("/tasks");
}

export async function updateTaskDescription(id: string, description: string) {
  const { workspace } = await requireWorkspace();
  await db.update(task).set({ description }).where(and(eq(task.id, id), eq(task.workspaceId, workspace.id)));
  revalidatePath("/tasks");
}

export async function addTaskStep(taskId: string, text: string) {
  const { workspace } = await requireWorkspace();
  if (!text.trim()) return;
  const n = (await db.select().from(taskStep).where(eq(taskStep.taskId, taskId))).length;
  await db.insert(taskStep).values({ id: uid(), workspaceId: workspace.id, taskId, text: text.trim(), ord: n });
  revalidatePath("/tasks");
}

export async function toggleTaskStep(id: string, done: boolean) {
  const { workspace } = await requireWorkspace();
  await db.update(taskStep).set({ done, active: false }).where(and(eq(taskStep.id, id), eq(taskStep.workspaceId, workspace.id)));
  revalidatePath("/tasks");
}

export async function deleteTaskStep(id: string) {
  const { workspace } = await requireWorkspace();
  await db.delete(taskStep).where(and(eq(taskStep.id, id), eq(taskStep.workspaceId, workspace.id)));
  revalidatePath("/tasks");
}
