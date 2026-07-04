import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { workspace } from "@/db/schema";
import { acquireLock, normalizeLockPath } from "@/server/file-locks";
import { pushInbox } from "@/server/inbox";

/**
 * Per-file lock acquisition — called by the spawned agent CLI's PreToolUse hook (bin/lock-hook.mjs)
 * before a Write/Edit. Guarded by CONSTELLA_WORKER_SECRET (same as the other worker endpoints).
 * 200 {ok:true} = go ahead; 423 {ok:false, heldBy} = another agent holds it (the hook tells the
 * model to edit a different file). Fails OPEN (allow) on any ambiguity so a glitch never hard-stalls.
 */
export async function POST(req: Request) {
  const secret = process.env.CONSTELLA_WORKER_SECRET;
  if (!secret || req.headers.get("x-worker-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { orgId, path, taskId, agentId, agentHandle } = await req.json().catch(() => ({}));
  if (!orgId || !path) return NextResponse.json({ ok: false, error: "missing orgId/path" }, { status: 400 });
  const rel = normalizeLockPath(orgId, path);
  if (!rel) return NextResponse.json({ ok: true }); // base/config files (.git, .claude) aren't locked
  const [ws] = await db.select({ id: workspace.id }).from(workspace).where(eq(workspace.orgId, orgId));
  if (!ws) return NextResponse.json({ ok: true }); // unknown org → don't block a real edit
  const r = await acquireLock(ws.id, rel, { taskId, agentId, handle: agentHandle });
  if (r.ok) return NextResponse.json({ ok: true });
  // Genuine cross-agent contention on the same file → surface it (deduped per path; auto-resolved when
  // the holder releases the lock in releaseLocksForTask). Rare in the default 1-task/tick mode.
  await pushInbox(ws.id, { kind: "block", refType: "task", refId: `lock:${rel}`, title: `File contention — ${rel}`, detail: `@${agentHandle || "an agent"} is blocked editing \`${rel}\` — held by @${r.heldBy?.handle || "another task"}. Usually transient; if it lingers, one run may be stuck on that file.` });
  return NextResponse.json({ ok: false, heldBy: r.heldBy }, { status: 423 });
}
