import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import * as schema from "./schema";
import { resolveRuntimePath } from "../lib/runtime-root";

// Anchor a relative DB path to the launch dir, not cwd — the standalone prod server chdir's into
// `.next/standalone/`, which would otherwise create a SEPARATE db there (dev/prod divergence).
const url = resolveRuntimePath((process.env.DATABASE_URL ?? "file:./.constella/constella.db").replace(/^file:/, ""));
mkdirSync(dirname(url), { recursive: true });

const sqlite = new Database(url);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
// Raw better-sqlite3 handle — used for idempotent, migration-free DDL at boot (ensureKbTables:
// CREATE TABLE IF NOT EXISTS + guarded ALTER ADD COLUMN) so existing DBs gain new tables/columns
// without a `drizzle-kit push` (which drifts this project's migration history).
export { sqlite };
export { schema };
