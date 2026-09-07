import "server-only";
import { and, eq, lt, desc } from "drizzle-orm";
import { db } from "@/db";
import { event, message } from "@/db/schema";

const KEEP_PER_CHANNEL = 500;

/**
 * Called after a run's final `message` is written. The `event` table is otherwise
 * never pruned, so it grows without bound — and live `text` deltas (used only to
 * build the streaming bubble) are pure noise once the settled message exists.
 *  1. drop this run's ephemeral `text` events (superseded by message.text),
 *  2. trim the channel to its most recent KEEP_PER_CHANNEL action events.
 * Plain server-only lib (not a "use server" action) so it isn't web-callable.
 */
/**
 * Remove ORPHAN runs: a run whose events never produced a settling `message` AND never emitted a
 * terminal `done`, when its newest event (event.seq is the emit epoch-ms) is older than maxAgeMs.
 * That's a process that died mid-run (typically a server restart) — otherwise the chat shows it
 * "Working" forever. Returns how many event rows were removed.
 */
export async function pruneOrphanRuns(workspaceId: string, maxAgeMs = 5 * 60_000): Promise<number> {
  try {
    const cutoff = Date.now() - maxAgeMs;
    const all = await db.select().from(event).where(eq(event.workspaceId, workspaceId));
    if (!all.length) return 0;
    const byRun = new Map<string, typeof all>();
    for (const e of all) { const a = byRun.get(e.runId) ?? ([] as typeof all); a.push(e); byRun.set(e.runId, a); }
    const settled = new Set((await db.select({ id: message.id }).from(message).where(eq(message.workspaceId, workspaceId))).map((m) => m.id));
    let removed = 0;
    for (const [runId, evs] of byRun) {
      const newest = evs.reduce((mx, e) => Math.max(mx, e.seq), 0);
      if (settled.has(runId) || evs.some((e) => e.kind === "done") || newest > cutoff) continue;
      await db.delete(event).where(and(eq(event.workspaceId, workspaceId), eq(event.runId, runId)));
      removed += evs.length;
    }
    return removed;
  } catch (e) {
    console.error("[events-prune] pruneOrphanRuns failed:", e);
    return 0;
  }
}

export async function pruneRunEvents(workspaceId: string, runId: string, channel: string): Promise<void> {
  try {
    await db.delete(event).where(and(eq(event.workspaceId, workspaceId), eq(event.runId, runId), eq(event.kind, "text")));
    const recent = await db.select({ seq: event.seq }).from(event)
      .where(and(eq(event.workspaceId, workspaceId), eq(event.channel, channel)))
      .orderBy(desc(event.seq)).limit(KEEP_PER_CHANNEL);
    if (recent.length === KEEP_PER_CHANNEL) {
      const cutoff = recent[recent.length - 1].seq;
      await db.delete(event).where(and(eq(event.workspaceId, workspaceId), eq(event.channel, channel), lt(event.seq, cutoff)));
    }
  } catch (e) {
    console.error("[events-prune] failed:", e);
  }
}
