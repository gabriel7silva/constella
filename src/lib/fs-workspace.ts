import { mkdirSync, writeFileSync, readFileSync, readdirSync, statSync, existsSync, rmSync, renameSync, cpSync, realpathSync } from "node:fs";
import { join, normalize, sep, dirname } from "node:path";
import { homedir } from "node:os";
import { resolveRuntimePath } from "./runtime-root";

/**
 * Filesystem-as-source-of-truth, per-organization and sandboxed.
 *
 * Every organization owns an isolated workspace directory:
 *   <constellaHome>/organizations/<orgId>/workspace/   (.claude/ is a config subfolder INSIDE it)
 *
 * The directory is keyed by the STABLE `organization.id` (never the renameable
 * slug). All access is sandboxed inside the org root via `safe()` — no path
 * traversal, no leakage across organizations or outside the runtime root.
 */

/** Runtime root. Defaults to the user-home `~/.constella` (the installed runtime,
 *  matching tools like Claude Code/Codex); `CONSTELLA_HOME` overrides it — e.g.
 *  point it at the project `./.constella` during local development. */
export function constellaHome(): string {
  // Anchor a relative CONSTELLA_HOME to the launch dir (not cwd) so the standalone prod server's
  // chdir into `.next/standalone/` can't fork a separate workspace tree from dev.
  return process.env.CONSTELLA_HOME ? resolveRuntimePath(process.env.CONSTELLA_HOME) : join(homedir(), ".constella");
}

/** Orgs whose legacy dir has been migration-checked this process (guards the rename). */
const migratedRoots = new Set<string>();

/** Absolute path to an organization's isolated workspace directory.
 *  One-time boot migration: if the new `workspace/` dir is absent but a legacy
 *  `constella/` dir exists, rename it so existing orgs keep their data. */
/** Org ids come from better-auth (alphanumeric + `-`/`_`). Reject anything that
 *  could traverse (`.`, `/`, `\`, `..`) before it reaches a filesystem path. */
function assertOrgId(orgId: string): void {
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(orgId)) throw new Error("Invalid orgId");
}

export function orgRoot(orgId: string): string {
  assertOrgId(orgId);
  const root = join(constellaHome(), "organizations", orgId, "workspace");
  if (!migratedRoots.has(orgId)) {
    migratedRoots.add(orgId);
    try {
      const legacy = join(constellaHome(), "organizations", orgId, "constella");
      const rootEmpty = !existsSync(root) || readdirSync(root).length === 0;
      if (existsSync(legacy) && rootEmpty) {
        try {
          renameSync(legacy, root);
        } catch {
          // Cross-device move (EXDEV): fall back to a copy so legacy data is never lost. But if the rename
          // failed because legacy is already GONE (another process won the race + migrated it), there is
          // nothing to copy — guard on legacy still existing AND root still empty to avoid copying a
          // half-migrated tree. Keep the legacy dir intact (no delete).
          if (existsSync(legacy)) {
            mkdirSync(root, { recursive: true });
            if (readdirSync(root).length === 0) cpSync(legacy, root, { recursive: true });
          }
        }
      }
    } catch { /* best-effort; never block a workspace read */ }
  }
  return root;
}

/** Resolve the realpath of the nearest existing ancestor of `p` (used to defeat
 *  symlink escapes — `safe()`'s lexical check can't see through a symlink). */
function realAncestor(p: string): string {
  let cur = p;
  for (;;) {
    if (existsSync(cur)) { try { return realpathSync.native(cur); } catch { return cur; } }
    const parent = dirname(cur);
    if (parent === cur) return cur; // reached filesystem root
    cur = parent;
  }
}

function safe(root: string, rel: string): string {
  const p = normalize(join(root, rel));
  // 1) Lexical: the joined+normalized path must stay under root (blocks ../, absolute,
  //    drive-letter and UNC paths — join re-roots them under root).
  if (p !== root && !p.startsWith(root + sep)) throw new Error("Path escapes workspace: " + rel);
  // 2) Symlink: re-check against the REAL path of the nearest existing ancestor so a
  //    symlink planted inside the workspace (by a prompt-injected agent) can't tunnel
  //    out to another org's root or the wider filesystem.
  if (existsSync(root)) {
    let realRoot: string;
    try { realRoot = realpathSync.native(root); } catch { realRoot = root; }
    const real = realAncestor(p);
    if (real !== realRoot && !real.startsWith(realRoot + sep)) {
      throw new Error("Path escapes workspace (symlink): " + rel);
    }
  }
  return p;
}

export function readDir(orgId: string, rel = ""): { name: string; path: string; isDir: boolean }[] {
  const root = orgRoot(orgId);
  const dir = safe(root, rel);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).map((name) => {
    const full = join(dir, name);
    const r = (rel ? rel + "/" : "") + name;
    return { name, path: r, isDir: statSync(full).isDirectory() };
  }).sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1));
}

// Dirs never worth walking for a file listing — and walking them (a built project's
// node_modules can be 50k+ files) made /planner take ~12s. Skip them in the recursive walk.
export const HEAVY_DIRS = new Set([
  "node_modules", ".git", ".next", ".turbo", "dist", "build", "out", "coverage", ".cache",
  "archives", ".testdev", ".pnpm-store", ".vercel", "vendor",
]);

// Dirs to NEVER copy when IMPORTING an existing project — a superset of HEAVY_DIRS covering every
// ecosystem's dependency/build/cache/editor/runtime-data dirs. Defined once in a client-safe module so the
// onboarding folder-picker (client) and the server-side walk/clone share the exact same filter.
export { IMPORT_SKIP_DIRS } from "@/data/import-skip";

/** Recursively list every file (not dirs) under the workspace, as relative paths. Skips heavy
 *  build/dependency dirs so it stays fast even after agents scaffold a real project. */
export function listFiles(orgId: string, rel = ""): string[] {
  const out: string[] = [];
  for (const e of readDir(orgId, rel)) {
    if (e.isDir) { if (HEAVY_DIRS.has(e.name)) continue; out.push(...listFiles(orgId, e.path)); }
    else out.push(e.path);
  }
  return out;
}

export function readWorkspaceFile(orgId: string, rel: string): string | null {
  const p = safe(orgRoot(orgId), rel);
  return existsSync(p) ? readFileSync(p, "utf8") : null;
}

export function writeWorkspaceFile(orgId: string, rel: string, content: string): void {
  const p = safe(orgRoot(orgId), rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content, "utf8");
}

export function deleteWorkspacePath(orgId: string, rel: string): void {
  const p = safe(orgRoot(orgId), rel);
  if (existsSync(p)) rmSync(p, { recursive: true, force: true });
}

export function ensureDir(orgId: string, rel: string): void {
  mkdirSync(safe(orgRoot(orgId), rel), { recursive: true });
}
