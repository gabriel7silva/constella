/**
 * Surgical STATE reset — wipes all workspace/demo data but PRESERVES auth, so the
 * operator stays logged in. The password lives in the `account` table, which the
 * seed does NOT recreate (see constella-seed-login-gotcha) — so we never drop it.
 *
 * After this (+ wiping the on-disk org dirs), requireWorkspace finds no org and
 * redirects to /onboarding for a clean fresh start, session still valid.
 *
 *   npx tsx src/db/reset-state.ts        (or: npm run db:reset-state)
 *
 * NON-destructive to auth: keeps user/session/account/verification/passkey/
 * two_factor/personal_access_token/notification_pref + migration metadata.
 */
import Database from "better-sqlite3";

const KEEP = new Set([
  "user", "session", "account", "verification", "passkey",
  "two_factor", "personal_access_token", "notification_pref",
  "__drizzle_migrations",
]);

const url = (process.env.DATABASE_URL ?? "file:./.constella/constella.db").replace(/^file:/, "");
const db = new Database(url);
db.pragma("foreign_keys = OFF");

const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[])
  .map((r) => r.name)
  .filter((t) => !t.startsWith("sqlite_") && !KEEP.has(t));

let total = 0;
const run = db.transaction(() => {
  for (const t of tables) {
    const { c } = db.prepare(`SELECT COUNT(*) c FROM "${t}"`).get() as { c: number };
    db.prepare(`DELETE FROM "${t}"`).run();
    if (c) { console.log(`  wiped ${t}: ${c}`); total += c; }
  }
});
run();

db.pragma("foreign_keys = ON");
db.pragma("wal_checkpoint(TRUNCATE)");
console.log(`✓ reset-state done — ${total} rows wiped across ${tables.length} tables; auth preserved.`);
db.close();
