"use server";

import { randomUUID as uid } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { goal } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";

export async function createGoal(input: { title: string; description?: string; ownerId?: string; parentId?: string }) {
  const { workspace } = await requireWorkspace();
  await db.insert(goal).values({
    id: uid(), workspaceId: workspace.id,
    title: input.title.trim(), description: input.description ?? "",
    ownerId: input.ownerId, parentId: input.parentId, progress: 0,
  });
  revalidatePath("/goals");
}

export async function updateGoalProgress(id: string, progress: number) {
  const { workspace } = await requireWorkspace();
  await db.update(goal).set({ progress: Math.max(0, Math.min(100, progress)) })
    .where(and(eq(goal.id, id), eq(goal.workspaceId, workspace.id)));
  revalidatePath("/goals");
}

export async function deleteGoal(id: string) {
  const { workspace } = await requireWorkspace();
  await db.delete(goal).where(and(eq(goal.id, id), eq(goal.workspaceId, workspace.id)));
  revalidatePath("/goals");
}
