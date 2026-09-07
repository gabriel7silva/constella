"use server";

import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { inboxItem } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";

/** Resolve (or reopen) an inbox item — workspace-scoped. */
export async function resolveInbox(id: string, resolved = true) {
  const { workspace: ws } = await requireWorkspace();
  await db
    .update(inboxItem)
    .set({ resolved })
    .where(and(eq(inboxItem.id, id), eq(inboxItem.workspaceId, ws.id)));
  revalidatePath("/inbox");
  return { ok: true };
}
