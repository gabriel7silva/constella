import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { currentVersion } from "@/lib/version";

/**
 * Liveness + process identity. `bootId` is generated once per server process (module load), so it stays
 * constant while this server runs and CHANGES on every restart. The browser polls this and reloads when the
 * id changes — so the tab always runs the current build after any restart (manual or self-update). Public and
 * unauthenticated (loopback; it leaks only the version) and allow-listed in proxy.ts so it answers on /login.
 */
export const dynamic = "force-dynamic";

const BOOT_ID = randomUUID();

export async function GET() {
  return NextResponse.json(
    { bootId: BOOT_ID, version: currentVersion() },
    { headers: { "cache-control": "no-store, no-cache, must-revalidate" } },
  );
}
