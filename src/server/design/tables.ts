import "server-only";
import { sqlite } from "@/db";

/**
 * Create the Design module tables if missing. Idempotent + safe every boot — the same surgical
 * `CREATE TABLE IF NOT EXISTS` pattern the KB tables use (db:push is UNSAFE in this project: it drops
 * the migrations bookkeeping + rewrites the agent table). Drizzle defs live in `src/db/schema.ts`.
 */
let ensured = false;
export function ensureDesignTables(): void {
  if (ensured) return;
  ensured = true;
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS design_session (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT 'Design session',
      status TEXT NOT NULL DEFAULT 'building',
      tokens TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS design_session_ws_idx ON design_session (workspace_id, created_at);
    CREATE TABLE IF NOT EXISTS design_page (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES design_session(id) ON DELETE CASCADE,
      key TEXT NOT NULL,
      name TEXT NOT NULL,
      tree TEXT
    );
    CREATE INDEX IF NOT EXISTS design_page_sess_idx ON design_page (session_id);
    CREATE TABLE IF NOT EXISTS design_version (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES design_session(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      patch TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS design_version_sess_idx ON design_version (session_id, created_at);
    CREATE TABLE IF NOT EXISTS design_comment (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES design_session(id) ON DELETE CASCADE,
      page_key TEXT NOT NULL,
      xp REAL NOT NULL,
      yp REAL NOT NULL,
      body TEXT NOT NULL,
      reply TEXT NOT NULL DEFAULT '',
      selection TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS design_comment_sess_idx ON design_comment (session_id);
  `);
}
