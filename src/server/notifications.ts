"use server";

import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { notification } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";

export async function markRead(id: string) {
  const { workspace } = await requireWorkspace();
  await db.update(notification).set({ read: true }).where(and(eq(notification.id, id), eq(notification.workspaceId, workspace.id)));
  revalidatePath("/notifications");
}

export async function markAllRead() {
  const { workspace } = await requireWorkspace();
  await db.update(notification).set({ read: true }).where(eq(notification.workspaceId, workspace.id));
  revalidatePath("/notifications");
}

export async function clearAll() {
  const { workspace } = await requireWorkspace();
  await db.delete(notification).where(eq(notification.workspaceId, workspace.id));
  revalidatePath("/notifications");
}
