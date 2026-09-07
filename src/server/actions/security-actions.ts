"use server";

import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { finding } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";

/** Toggle a finding between open and fixed (workspace-scoped). */
export async function toggleFinding(id: string) {
  const { workspace: ws } = await requireWorkspace();
  const [f] = await db
    .select()
    .from(finding)
    .where(and(eq(finding.id, id), eq(finding.workspaceId, ws.id)));
  if (!f) return { ok: false };
  await db
    .update(finding)
    .set({ status: f.status === "open" ? "fixed" : "open" })
    .where(eq(finding.id, id));
  revalidatePath("/security");
  return { ok: true, status: f.status === "open" ? "fixed" : "open" };
}
