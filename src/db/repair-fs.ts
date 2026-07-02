/**
 * Repair / backfill — writes any MISSING or EMPTY required workspace file for
 * every organization (non-destructive; never overwrites existing content). Use
 * to bring older workspaces up to the full bootstrap baseline. Run:
 *
 *   npx tsx src/db/repair-fs.ts
 */
import { eq } from "drizzle-orm";
import { db } from "./index";
import { organization, workspace } from "./schema";
import { scaffoldMissing } from "../data/scaffold";

function main() {
  const orgs = db.select().from(organization).all();
  if (orgs.length === 0) { console.log("No organizations."); return; }
  for (const o of orgs) {
    const [ws] = db.select().from(workspace).where(eq(workspace.orgId, o.id)).all();
    if (!ws) { console.log(`· ${o.id}: no workspace row, skipped`); continue; }
    const written = scaffoldMissing({
      orgId: o.id, slug: ws.slug, company: ws.name, mission: ws.mission, objective: ws.objective,
      stack: (ws.stack ?? {}) as Record<string, string>, runMode: o.runMode,
      createdAt: new Date().toISOString().slice(0, 10),
    });
    console.log(`${o.id} (${ws.slug}): wrote ${written.length} missing file(s)`);
  }
  console.log("✓ repair-fs done");
}

main();
