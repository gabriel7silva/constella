import "server-only";
import { randomUUID as uid } from "node:crypto";
import { and, eq, desc, isNull } from "drizzle-orm";
import { db } from "@/db";
import { chatSession, message } from "@/db/schema";

/**
 * DM session helpers. A DM channel (`dm:<handle>`) can hold multiple sessions — a fresh session gives
 * the agent a fresh context while the operator keeps every message visible (just per-session). The room
 * + Telegram are single-thread and never get sessions. Plain server-only helpers (no "use server") so
 * the read/context paths can call them directly.
 */

/** The active DM session id — lazily creates "Session 1" (and adopts legacy null-session messages) the
 *  first time a DM is touched. Returns null for non-DM channels. */
export async function ensureActiveSession(workspaceId: string, channel: string): Promise<string | null> {
  if (!channel.startsWith("dm:")) return null;
  const [act] = await db.select().from(chatSession)
    .where(and(eq(chatSession.workspaceId, workspaceId), eq(chatSession.channel, channel), eq(chatSession.active, true)));
  if (act) return act.id;
  const all = await db.select().from(chatSession)
    .where(and(eq(chatSession.workspaceId, workspaceId), eq(chatSession.channel, channel))).orderBy(desc(chatSession.createdAt));
  if (all.length) { await db.update(chatSession).set({ active: true }).where(eq(chatSession.id, all[0].id)); return all[0].id; }
  const id = uid();
  await db.insert(chatSession).values({ id, workspaceId, channel, title: "Session 1", active: true });
  // Adopt any messages sent before sessions existed into this first session.
  await db.update(message).set({ sessionId: id })
    .where(and(eq(message.workspaceId, workspaceId), eq(message.channel, channel), isNull(message.sessionId)));
  return id;
}

/** All sessions for a DM channel, newest first, with the active flag. */
export async function sessionsFor(workspaceId: string, channel: string): Promise<{ id: string; title: string; active: boolean; createdAt: number }[]> {
  if (!channel.startsWith("dm:")) return [];
  await ensureActiveSession(workspaceId, channel); // guarantees at least "Session 1"
  const rows = await db.select().from(chatSession)
    .where(and(eq(chatSession.workspaceId, workspaceId), eq(chatSession.channel, channel))).orderBy(desc(chatSession.createdAt));
  return rows.map((r) => ({ id: r.id, title: r.title, active: r.active, createdAt: (r.createdAt instanceof Date ? r.createdAt.getTime() : Number(r.createdAt) * 1000) || 0 }));
}

/** Create a new (active) session for a DM, deactivating the others. Returns the new session id. */
export async function newSession(workspaceId: string, channel: string, title?: string): Promise<string | null> {
  if (!channel.startsWith("dm:")) return null;
  await ensureActiveSession(workspaceId, channel); // ensure a default exists first
  const count = (await db.select({ id: chatSession.id }).from(chatSession)
    .where(and(eq(chatSession.workspaceId, workspaceId), eq(chatSession.channel, channel)))).length;
  const id = uid();
  await db.update(chatSession).set({ active: false }).where(and(eq(chatSession.workspaceId, workspaceId), eq(chatSession.channel, channel)));
  await db.insert(chatSession).values({ id, workspaceId, channel, title: title?.trim() || `Session ${count + 1}`, active: true });
  return id;
}

/** Switch the active session for a DM. */
export async function activateSession(workspaceId: string, channel: string, sessionId: string): Promise<void> {
  const [s] = await db.select().from(chatSession).where(and(eq(chatSession.id, sessionId), eq(chatSession.workspaceId, workspaceId), eq(chatSession.channel, channel)));
  if (!s) return;
  await db.update(chatSession).set({ active: false }).where(and(eq(chatSession.workspaceId, workspaceId), eq(chatSession.channel, channel)));
  await db.update(chatSession).set({ active: true }).where(eq(chatSession.id, sessionId));
}

/** Rename a session (workspace-scoped). */
export async function renameSessionRow(workspaceId: string, sessionId: string, title: string): Promise<void> {
  await db.update(chatSession).set({ title: title.trim().slice(0, 60) || "Session" })
    .where(and(eq(chatSession.id, sessionId), eq(chatSession.workspaceId, workspaceId)));
}

/** Delete a session + its messages. If it was the active one, activates the newest remaining session
 *  (or none — ensureActiveSession recreates "Session 1" on the next touch). Workspace-scoped. */
export async function deleteSessionRow(workspaceId: string, channel: string, sessionId: string): Promise<void> {
  if (!channel.startsWith("dm:")) return;
  const [s] = await db.select().from(chatSession)
    .where(and(eq(chatSession.id, sessionId), eq(chatSession.workspaceId, workspaceId), eq(chatSession.channel, channel)));
  if (!s) return;
  await db.delete(message).where(and(eq(message.workspaceId, workspaceId), eq(message.sessionId, sessionId)));
  await db.delete(chatSession).where(eq(chatSession.id, sessionId));
  if (s.active) {
    const [next] = await db.select().from(chatSession)
      .where(and(eq(chatSession.workspaceId, workspaceId), eq(chatSession.channel, channel))).orderBy(desc(chatSession.createdAt));
    if (next) await db.update(chatSession).set({ active: true }).where(eq(chatSession.id, next.id));
  }
}
