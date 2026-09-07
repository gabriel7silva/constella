import { NextResponse } from "next/server";
import { tickAll } from "@/server/runner";
import { refreshAllStaleProviders } from "@/server/providers";

/**
 * Headless 24/7 runner endpoint. The worker (bin/worker.mjs) POSTs here
 * on an interval to advance every active workspace with REAL agent execution.
 * Guarded by CONSTELLA_WORKER_SECRET so it isn't publicly triggerable.
 */
export async function POST(req: Request) {
  // Fail CLOSED: without a configured secret this endpoint would let anyone
  // trigger real (token-spending) agent execution across every workspace.
  const secret = process.env.CONSTELLA_WORKER_SECRET;
  if (!secret || req.headers.get("x-worker-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // `auto: true` → the autonomous loop only runs workspaces where the operator turned Run 24/7 on.
  const results = await tickAll({ execute: true, auto: true });
  // Keep the dynamic model catalog current — refresh providers stale > 12h (internally guarded + capped).
  const catalog = await refreshAllStaleProviders().catch(() => ({ refreshed: 0 }));
  return NextResponse.json({ ok: true, results, catalogRefreshed: catalog.refreshed });
}
