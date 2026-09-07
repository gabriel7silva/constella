"use server";

import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { plugin } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";
import { randomUUID } from "crypto";

/** Enable/disable a plugin — workspace-scoped. */
export async function togglePlugin(id: string, enabled: boolean) {
  const { workspace: ws } = await requireWorkspace();
  await db.update(plugin).set({ enabled }).where(and(eq(plugin.id, id), eq(plugin.workspaceId, ws.id)));
  revalidatePath("/plugins");
}

/** Install a plugin from a name/URL (mock — just registers it disabled). */
export async function installPlugin(name: string, description = "") {
  const { workspace: ws } = await requireWorkspace();
  if (!name.trim()) return { ok: false };
  await db.insert(plugin).values({
    id: randomUUID(), workspaceId: ws.id, name: name.trim(),
    description: description || "Installed from URL", enabled: true, native: false,
  });
  revalidatePath("/plugins");
  return { ok: true };
}

/** Remove a non-native plugin. */
export async function removePlugin(id: string) {
  const { workspace: ws } = await requireWorkspace();
  await db.delete(plugin).where(and(eq(plugin.id, id), eq(plugin.workspaceId, ws.id), eq(plugin.native, false)));
  revalidatePath("/plugins");
}
