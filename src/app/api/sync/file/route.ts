import { NextResponse } from "next/server";
import { indexFile, deindexFile } from "@/server/sync";
import { assertOrgId } from "@/lib/fs-workspace";

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
  if (typeof orgId !== "string" || typeof rel !== "string" || !orgId || !rel) {
    return NextResponse.json({ ok: false, error: "missing orgId/rel" }, { status: 400 });
  }
  // Same shape as /api/locks/acquire: a body-supplied orgId reaches orgRoot() → a filesystem path. orgRoot()
  // asserts the charset but throws; check here too so a malformed body is a clean 400 instead of a 500.
  try { assertOrgId(orgId); } catch { return NextResponse.json({ ok: false, error: "invalid orgId" }, { status: 400 }); }
  const r = event === "unlink" ? await deindexFile(orgId, rel) : await indexFile(orgId, rel);
  return NextResponse.json(r);
}
