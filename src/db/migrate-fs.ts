/**
 * One-off filesystem migration — relocates each org's workspace from the legacy
 * slug-keyed path (`<project>/.constella/<slug>` or `<home>/.constella/<slug>`)
 * to the new org-ID-keyed, isolated home:
 *
 *   <constellaHome>/organizations/<orgId>/workspace/
 *
 * Non-destructive: copies into an empty dest, never overwrites a populated one,
 * never touches the DB (auth preserved — see constella-seed-login-gotcha). Run:
 *
 *   npx tsx src/db/migrate-fs.ts
 */
import { existsSync, mkdirSync, cpSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { db } from "./index";
import { organization, workspace } from "./schema";
import { orgRoot, constellaHome } from "../lib/fs-workspace";

function nonEmpty(dir: string): boolean {
  return existsSync(dir) && readdirSync(dir).length > 0;
}

function main() {
  const orgs = db.select().from(organization).all();
  if (orgs.length === 0) { console.log("No organizations — nothing to migrate."); return; }

  for (const o of orgs) {
    const [ws] = db.select().from(workspace).where(eq(workspace.orgId, o.id)).all();
    const dest = orgRoot(o.id);
    mkdirSync(dest, { recursive: true });

    if (nonEmpty(dest)) { console.log(`= ${o.id}: already populated at ${dest}`); continue; }

    const legacy = [
      ws ? join(process.cwd(), ".constella", ws.slug) : "",
      ws ? join(constellaHome(), ws.slug) : "",
    ].filter(Boolean);
    const src = legacy.find((p) => nonEmpty(p));

    if (src) { cpSync(src, dest, { recursive: true }); console.log(`→ ${o.id}: copied ${src} → ${dest}`); }
    else console.log(`· ${o.id}: no legacy content; empty workspace at ${dest} (scaffold/repair will fill it)`);
  }
  console.log("✓ migrate-fs done");
}

main();
