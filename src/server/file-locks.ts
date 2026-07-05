import "server-only";
import { eq, and, lt } from "drizzle-orm";
import { relative, isAbsolute } from "node:path";
import { db } from "@/db";
import { fileLock } from "@/db/schema";
import { orgRoot } from "@/lib/fs-workspace";
import { resolveInboxFor } from "@/server/inbox";

/**
 * Per-file locking so agents can run in parallel without clobbering each other. A lock is one row
 * per (workspace, file). Acquired just-in-time by the spawned CLI's PreToolUse hook before a
 * Write/Edit, re-acquirable by the SAME task/agent (heartbeat), denied to anyone else. Released on
 * task completion + reclaimed by TTL (crash safety). See docs/KB_RAG (architecture) / Phase 14.
 */

/** Normalize a (possibly absolute) path to a workspace-relative key; skip base/config dirs. */
export function normalizeLockPath(orgId: string, p: string): string | null {
  if (!p) return null;
  const root = orgRoot(orgId);
  const rel = (isAbsolute(p) ? relative(root, p) : p).replace(/\\/g, "/");
  if (!rel || rel.startsWith("..")) return null;
  if (rel.startsWith(".git/") || rel.startsWith(".claude/") || rel.startsWith("archives/")) return null;
  return rel;
}

export type LockHolder = { taskId?: string; agentId?: string; handle?: string };

/** Acquire the lock for a file. Re-acquire (heartbeat) if the SAME task or agent already holds it;
 *  otherwise deny with who holds it. */
export async function acquireLock(wsId: string, path: string, holder: LockHolder): Promise<{ ok: boolean; heldBy?: { handle: string; taskId: string } }> {
  const where = and(eq(fileLock.workspaceId, wsId), eq(fileLock.path, path));
  const [cur] = await db.select().from(fileLock).where(where);
  if (cur) {
    const sameTask = !!holder.taskId && cur.taskId === holder.taskId;
    const sameAgent = !cur.taskId && !!holder.agentId && cur.agentId === holder.agentId;
    if (sameTask || sameAgent) { await db.update(fileLock).set({ heartbeatAt: new Date() }).where(where); return { ok: true }; }
    return { ok: false, heldBy: { handle: cur.agentHandle, taskId: cur.taskId } };
  }
  try {
    await db.insert(fileLock).values({ workspaceId: wsId, path, taskId: holder.taskId || "", agentId: holder.agentId || "", agentHandle: holder.handle || "", acquiredAt: new Date(), heartbeatAt: new Date() });
    return { ok: true };
  } catch {
    // Lost a race on the PK — re-read; allow only if it's actually ours.
    const [c2] = await db.select().from(fileLock).where(where);
    if (c2 && (c2.taskId === holder.taskId || c2.agentId === holder.agentId)) return { ok: true };
    return { ok: false, heldBy: c2 ? { handle: c2.agentHandle, taskId: c2.taskId } : undefined };
  }
}

export async function releaseLocksForTask(wsId: string, taskId: string): Promise<void> {
  if (!taskId) return;
  try {
    const held = await db.select({ path: fileLock.path }).from(fileLock).where(and(eq(fileLock.workspaceId, wsId), eq(fileLock.taskId, taskId)));
    await db.delete(fileLock).where(and(eq(fileLock.workspaceId, wsId), eq(fileLock.taskId, taskId)));
    // Clear any "file contention" Inbox item now that this task freed the file (best-effort).
    for (const l of held) await resolveInboxFor(wsId, "task", `lock:${l.path}`);
  } catch { /* best-effort */ }
}
export async function releaseAllLocks(wsId: string): Promise<void> {
  try { await db.delete(fileLock).where(eq(fileLock.workspaceId, wsId)); } catch { /* best-effort */ }
}
/** Drop locks whose heartbeat is older than ttlMs (a crashed run never released them). */
export async function reclaimStaleLocks(ttlMs = 5 * 60_000): Promise<void> {
  try { await db.delete(fileLock).where(lt(fileLock.heartbeatAt, new Date(Date.now() - ttlMs))); } catch { /* best-effort */ }
}
export async function activeLocks(wsId: string): Promise<{ path: string; agentHandle: string; taskId: string }[]> {
  try { return await db.select({ path: fileLock.path, agentHandle: fileLock.agentHandle, taskId: fileLock.taskId }).from(fileLock).where(eq(fileLock.workspaceId, wsId)); } catch { return []; }
}
