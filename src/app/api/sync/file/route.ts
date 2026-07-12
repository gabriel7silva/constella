import { NextResponse } from "next/server";
import { indexFile, deindexFile } from "@/server/sync";

/**
 * Sync endpoint. The headless worker's file-watcher POSTs here when a workspace
 * file changes on disk (external/agent edits), so the DB index reconciles to the
 * directory. Guarded by CONSTELLA_WORKER_SECRET — not publicly triggerable.
 */
export async function POST(req: Request) {
  // Fail CLOSED: an unset secret must NOT leave this endpoint open. It takes an
  // arbitrary orgId from the body, so an unauthenticated caller could otherwise
  // reindex/deindex any org's files (cross-tenant DB tampering).
  const secret = process.env.CONSTELLA_WORKER_SECRET;
  if (!secret || req.headers.get("x-worker-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { orgId, rel, event } = await req.json().catch(() => ({}));
  if (!orgId || !rel) return NextResponse.json({ ok: false, error: "missing orgId/rel" }, { status: 400 });
  const r = event === "unlink" ? await deindexFile(orgId, rel) : await indexFile(orgId, rel);
  return NextResponse.json(r);
}
