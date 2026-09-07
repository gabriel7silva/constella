/**
 * One-off de-fake — brings an already-seeded DB in line with the structural-only
 * seed WITHOUT wiping it (so the operator's auth/password rows survive). Run once:
 *
 *   npx tsx src/db/defake.ts
 *
 * Idempotent: safe to run repeatedly.
 */
import { and, eq, like } from "drizzle-orm";
import { db } from "./index";
import { budget, provider, issue, backlogItem, report } from "./schema";

const WS = "ws_default";

function main() {
  console.log("De-faking Constella data (auth preserved)…");

  // Spend is derived from real costEntry rows only — clear any fabricated starting value.
  db.update(budget).set({ monthlySpentUsd: 0 }).where(eq(budget.workspaceId, WS)).run();

  // No fabricated "connected" state or model counts. Cloud + local => needs_sync/0.
  db.update(provider).set({ status: "needs_sync", modelCount: 0, lastSync: null }).where(eq(provider.workspaceId, WS)).run();
  // The local Claude Code CLI is the genuinely-available executor (3 real aliases).
  db.update(provider).set({ status: "connected", modelCount: 3, lastSync: null })
    .where(and(eq(provider.workspaceId, WS), eq(provider.catalogId, "claude_code"))).run();

  // Remove fabricated demo content; these screens start empty and fill from real runs.
  const i = db.delete(issue).where(like(issue.id, "iss_%")).run();
  const b = db.delete(backlogItem).where(like(backlogItem.id, "bl_%")).run();
  const r = db.delete(report).where(eq(report.id, "rep_retro4")).run();

  console.log(`✓ De-faked: spend=0, providers normalised, removed ${i.changes} sprint / ${b.changes} backlog / ${r.changes} report row(s).`);
}

main();
