"use server";

import { randomUUID as uid } from "node:crypto";
import { eq, and, gt, asc } from "drizzle-orm";
import { db } from "@/db";
import { event } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";
import { wake } from "@/server/bus";

export type RuntimeEvent = { runId: string; channel?: string; agentId?: string | null; kind: string; target?: string; detail?: string };

/** Record one runtime step (called server-side as an agent run streams). */
export async function emit(workspaceId: string, e: RuntimeEvent): Promise<void> {
  await db.insert(event).values({
    id: uid(), workspaceId, runId: e.runId, channel: e.channel ?? "room", agentId: e.agentId ?? null,
    seq: Date.now(), kind: e.kind, target: (e.target ?? "").slice(0, 500), detail: (e.detail ?? "").slice(0, 8000),
  });
  wake(workspaceId); // nudge any open SSE stream for this workspace to flush immediately
}

/** Poll new events for a channel since a cursor (the UI dedupes by id). */
export async function getEvents(channel: string, sinceSeq = 0) {
  const { workspace } = await requireWorkspace();
  return db.select().from(event)
    .where(and(eq(event.workspaceId, workspace.id), eq(event.channel, channel), gt(event.seq, sinceSeq)))
    .orderBy(asc(event.seq)).limit(300);
}
