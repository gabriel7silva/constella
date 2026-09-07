import "server-only";
import { inArray, eq, and, ne } from "drizzle-orm";
import { db } from "@/db";
import { agent, task, goal, spec, issue, workspace, organization } from "@/db/schema";
import { assertAuthSecret } from "@/lib/auth";
import { stopAllProjectServers } from "@/server/devserver";
import { pruneOrphanRuns } from "@/server/events-prune";
import { seedLibrarySkillsForExistingWorkspaces } from "@/server/seed-library-skills";
import { seedRosterForExistingWorkspaces } from "@/server/seed-roster";
import { ensureEmbedServer, ensureLlamaServer } from "@/server/local-models";
import { warmModelsDev } from "@/server/model-catalog";
import { refreshAllStaleProviders } from "@/server/providers";
import { ensureKbTables, markKbObsoleteForGoal, seedKbAgent } from "@/server/kb";
import { ensureDeployTables, reconcileDeployRuns } from "@/server/deploy-store";
import { ensureDesignTables } from "@/server/design/tables";
import { resumePendingDesignHandoffs } from "@/server/design/actions";
import { seedDefaultBlocksForExistingWorkspaces } from "@/server/blocks";

let reconciled = false;

/**
 * One-time, on server startup: heal state that a previous process left dangling.
 *  - No agent is genuinely mid-run at boot (the in-memory run/abort registries are empty), so any
 *    agent still marked "working"/"review" is stale → reset to "idle". (Fixes the chat dock
 *    showing agents "Working" forever after a restart.)
 *  - Any task stuck at "doing" is an orphan (its CLI process died with the old process) → back to
 *    "todo" so the runner re-picks it — EXCEPT tasks whose goal was cancelled/archived (stay parked).
 * Idempotent; safe to call repeatedly. Best-effort (never throws to the caller).
 */
export async function reconcileOnBoot(): Promise<void> {
  if (reconciled) return;
  reconciled = true;
  // Security gate FIRST, and DO NOT swallow it: a network mode (auth/vps/portable) without a real
  // BETTER_AUTH_SECRET would otherwise sign + accept sessions with better-auth's PUBLIC default key
  // (forgeable cookies) since better-auth only throws on the default under NODE_ENV=production.
  // Refuse to serve. (No-op in `start`/dev, which are local-only.)
  try {
    assertAuthSecret();
  } catch (e) {
    console.error("[boot] FATAL:", (e as Error).message);
    process.exit(1);
  }
  // Knowledge-Base tables/columns (idempotent DDL) — before anything that may read/write the KB.
  try { ensureKbTables(); } catch (e) { console.error("[boot] ensureKbTables failed:", e); }
  // Prepare-Deploy run table (idempotent DDL); flip any orphaned "running" run → failed.
  try { ensureDeployTables(); reconcileDeployRuns(); } catch (e) { console.error("[boot] ensureDeployTables failed:", e); }
  // Design module tables (idempotent DDL) — before anything that may read/write a design session.
  try { ensureDesignTables(); } catch (e) { console.error("[boot] ensureDesignTables failed:", e); }
  try {
    stopAllProjectServers(); // no project dev server survives a Constella restart in-memory
    const cleared = await db.update(agent).set({ status: "idle" }).where(inArray(agent.status, ["working", "review"])).returning({ id: agent.id });
    const doing = await db.select().from(task).where(eq(task.col, "doing"));
    let requeued = 0;
    for (const t of doing) {
      if (t.goalId) {
        const g = await db.query.goal.findFirst({ where: eq(goal.id, t.goalId) });
        if (g && g.status !== "active") continue; // cancelled/archived goal → leave parked
      }
      await db.update(task).set({ col: "todo" }).where(eq(task.id, t.id));
      requeued++;
    }
    // Cascade-sync: a cancelled/archived goal's specs+issues must read as such — covers goals
    // cancelled before the status columns existed, and any drift, so the Planner never shows a
    // cancelled goal's work as still "awaiting approval".
    let synced = 0, kbRetired = 0;
    const parked = await db.select().from(goal).where(inArray(goal.status, ["cancelled", "archived"]));
    for (const g of parked) {
      const st = g.status as "cancelled" | "archived";
      const s1 = await db.update(spec).set({ status: st }).where(and(eq(spec.goalId, g.id), ne(spec.status, st))).returning({ id: spec.id });
      const s2 = await db.update(issue).set({ status: st }).where(and(eq(issue.goalId, g.id), ne(issue.status, st))).returning({ id: issue.id });
      synced += s1.length + s2.length;
      // State-aware KB: a parked goal's knowledge must stop surfacing as current.
      kbRetired += await markKbObsoleteForGoal(g.workspaceId, g.id);
    }
    if (kbRetired) console.log(`[boot] retired ${kbRetired} KB entr(y/ies) from cancelled/archived goals`);
    // Clear orphan chat runs (events from a process that died mid-run) so the dock doesn't show
    // an agent "Working" forever after a restart.
    let prunedEvents = 0;
    for (const ws of await db.select({ id: workspace.id }).from(workspace)) prunedEvents += await pruneOrphanRuns(ws.id);
    console.log(`[boot] reconciled: ${cleared.length} agent(s) → idle, ${requeued} orphan task(s) → todo, ${synced} spec/issue status synced, ${prunedEvents} orphan event(s) pruned`);
  } catch (e) {
    console.error("[boot] reconcile failed:", e);
  }
  // Re-kick any Design → execution handoff left in-flight by a crash (gate.handoffAt set, CEO never activated).
  try { const resumed = await resumePendingDesignHandoffs(); if (resumed) console.log(`[boot] resumed ${resumed} pending design handoff(s)`); }
  catch (e) { console.error("[boot] resume design handoffs failed:", e); }
  // Reflect the LAUNCHED run mode (the CLI flag, `CONSTELLA_RUN_MODE`) in the DB. The deploy/auth mode is
  // otherwise written only at onboarding, so relaunching `constella --auth/--vps/--portable` left the UI
  // still showing `--start`. The launch flag is the source of truth in a CLI build; sync it here. A paused
  // execution loop (`workspace.runMode === "off"`) is preserved so a restart doesn't un-pause the runner.
  try {
    const launched = process.env.CONSTELLA_RUN_MODE;
    if (launched && ["start", "auth", "vps", "portable"].includes(launched)) {
      const m = launched as "start" | "auth" | "vps" | "portable";
      await db.update(organization).set({ runMode: m }).where(ne(organization.runMode, m));
      const r = await db.update(workspace).set({ runMode: m })
        .where(and(ne(workspace.runMode, "off"), ne(workspace.runMode, m))).returning({ id: workspace.id });
      if (r.length) console.log(`[boot] run mode synced to --${m}`);
    }
  } catch (e) { console.error("[boot] run-mode sync failed:", e); }
  // Backfill the native skills library into existing workspaces (orgs created before the feature).
  try {
    const r = seedLibrarySkillsForExistingWorkspaces();
    if (r.seeded) console.log(`[boot] backfilled ${r.seeded} library skill(s) across ${r.workspaces} workspace(s)`);
  } catch (e) { console.error("[boot] skill backfill failed:", e); }
  // Backfill any roster agent added after an org was onboarded (e.g. the Knowledge agent, Vannevar).
  try {
    const r = seedRosterForExistingWorkspaces();
    if (r.added) console.log(`[boot] backfilled ${r.added} roster agent(s) into existing workspace(s)`);
  } catch (e) { console.error("[boot] roster backfill failed:", e); }
  // Seed/refresh Vannevar's central KB-Agent prompt (source-of-truth operating manual) + taxonomy doc.
  try {
    const r = await seedKbAgent();
    if (r.updated) console.log(`[boot] seeded the KB-Agent prompt for ${r.updated} workspace(s)`);
  } catch (e) { console.error("[boot] KB-Agent seed failed:", e); }
  // Seed default synced knowledge blocks (mission / objective / official-stack) from the workspace.
  try {
    const r = await seedDefaultBlocksForExistingWorkspaces();
    if (r.seeded) console.log(`[boot] seeded ${r.seeded} default knowledge block(s)`);
  } catch (e) { console.error("[boot] block seed failed:", e); }
  // Bring up the RAG embedding server if a local embed model is installed (fire-and-forget — it
  // polls for readiness on its own; no-op when there's no model / no llama-server binary).
  void ensureEmbedServer().then((r) => { if (r.up) console.log(`[boot] embedding server up (${r.model ?? "model"}) — RAG is semantic`); }).catch(() => {});
  // Bring up the MAIN llama.cpp server (:8082) serving the installed chat GGUF, so an agent on
  // local_llamacpp works without the manual "Start server" click. No-op when no chat model is installed.
  void ensureLlamaServer().then((r) => { if (r.up) console.log(`[boot] llama.cpp serving ${r.model ?? "a model"} on 127.0.0.1:8082`); }).catch(() => {});
  // Warm the dynamic model catalog (models.dev) + refresh any stale connected providers. Fire-and-
  // forget + offline-tolerant (falls back to the disk cache / hardcoded snapshot) so it never blocks boot.
  void warmModelsDev()
    .then((n) => { if (n) console.log(`[boot] model catalog warmed (${n} providers from models.dev)`); })
    .then(() => refreshAllStaleProviders())
    .then((r) => { if (r.refreshed) console.log(`[boot] refreshed model list for ${r.refreshed} provider(s)`); })
    .catch(() => {});
}
