import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { agent } from "@/db/schema";
import { STALE_MS } from "@/lib/pulse";

/**
 * True iff some agent is ACTIVELY running a CLI right now: `status='working'` AND it has pulsed within the
 * last STALE_MS (90s). The pulse check is the safety valve — a "working" agent whose process crashed (no
 * recent pulse) does NOT count, so the update gate auto-releases instead of staying stuck disabled forever.
 *
 * Used to block an in-app update (a server restart would kill a running agent's CLI mid-task).
 */
export async function anyAgentWorking(): Promise<boolean> {
  const rows = await db.select({ lastPulse: agent.lastPulse }).from(agent).where(eq(agent.status, "working"));
  const cutoff = Date.now() - STALE_MS;
  return rows.some((r) => r.lastPulse != null && new Date(r.lastPulse).getTime() >= cutoff);
}
