import "server-only";
import { randomUUID as uid } from "node:crypto";
import { readdirSync, statSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join, relative, isAbsolute, sep } from "node:path";
import { tmpdir } from "node:os";
import { IMPORT_SKIP_DIRS, orgRoot, writeWorkspaceFile } from "@/lib/fs-workspace";
import { runCommand } from "@/server/adapters/cli";

/**
 * Import helpers for onboarding: validate + copy a local project directory into the org workspace,
 * and clone a GitHub repo into it. All copies go through writeWorkspaceFile (path-jailed by safe()).
 * Server-only (not exposed as actions); completeOnboarding calls these.
 *
 * The walk skips dependency/build/cache/runtime dirs (IMPORT_SKIP_DIRS) AND honors the project's own
 * `.gitignore`, so a real project's source lands — not its `.venv` / `node_modules` / `target`. Without
 * this the file cap was exhausted by dependencies before the actual code was reached.
 */

const SKIP_FILE = /(^|[\\/])(\.env(\.local|\.development|\.production)?|\.DS_Store|\.gitignore|\.gitattributes)$/i; // keep .env.example/.sample
const DEFAULT_MAX_FILES = 4000;
const DEFAULT_MAX_BYTES = 512 * 1024;

function isBinary(buf: Buffer): boolean {
  const n = Math.min(buf.length, 8192);
  for (let i = 0; i < n; i++) if (buf[i] === 0) return true;
  return false;
}

/** Convert a single gitignore glob token to an anchored regex (segment-scoped: `*` never crosses `/`). */
function globToRe(glob: string): RegExp {
  let re = "";
  for (const ch of glob) {
    if (ch === "*") re += "[^/]*";
    else if (ch === "?") re += "[^/]";
    else re += ch.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp("^" + re + "$");
}

type IgnoreRule = { anchored: boolean; re: RegExp };

/** Build a best-effort `.gitignore` matcher for the import root. Supports comments, dir markers, anchored
 *  (`/x`) and unanchored (match any path segment) patterns and `*`/`?` globs. Negations (`!`) are ignored
 *  (conservative — we'd rather skip a file than copy a dependency). Combined with IMPORT_SKIP_DIRS. */
function buildIgnore(root: string): (rel: string, isDir: boolean) => boolean {
  const rules: IgnoreRule[] = [];
  let txt = "";
  try { txt = readFileSync(join(root, ".gitignore"), "utf8"); } catch { /* no .gitignore */ }
  for (let line of txt.split(/\r?\n/)) {
    line = line.trim();
    if (!line || line.startsWith("#") || line.startsWith("!")) continue;
    const anchored = line.startsWith("/") || (line.replace(/\/$/, "").includes("/"));
    const pat = line.replace(/^\//, "").replace(/\/$/, "");
    if (!pat) continue;
    rules.push({ anchored, re: globToRe(pat) });
  }
  if (!rules.length) return () => false;
  return (rel: string, _isDir: boolean) => {
    const segs = rel.split("/");
    for (const r of rules) {
      if (r.anchored) { if (r.re.test(rel)) return true; }
      else if (segs.some((s) => r.re.test(s))) return true; // unanchored → match any segment, at any depth
    }
    return false;
  };
}

/** Walk a directory collecting file paths, skipping IMPORT_SKIP_DIRS + .gitignore-ignored paths, capped. */
function walkDir(root: string, cap: number, ignore: (rel: string, isDir: boolean) => boolean): string[] {
  const out: string[] = [];
  const stack = [root];
  while (stack.length && out.length < cap) {
    const d = stack.pop()!;
    let entries: import("node:fs").Dirent[];
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const abs = join(d, e.name);
      const rel = relative(root, abs).split(sep).join("/");
      if (e.isDirectory()) {
        if (IMPORT_SKIP_DIRS.has(e.name) || ignore(rel, true)) continue; // prune the whole subtree
        stack.push(abs);
      } else if (e.isFile()) {
        if (ignore(rel, false)) continue;
        out.push(abs);
        if (out.length >= cap) break;
      }
    }
  }
  return out;
}

/** Cheap stack hint from the file basenames present (Django / Node / Python / Go / etc.). */
function detectStack(root: string, files: string[]): string | undefined {
  const names = new Set(files.map((f) => relative(root, f).split(sep).join("/").toLowerCase()));
  const has = (n: string) => names.has(n) || [...names].some((p) => p.endsWith("/" + n));
  if (has("manage.py")) return "Django (Python)";
  if (has("pyproject.toml") || has("requirements.txt") || [...names].some((p) => p.endsWith(".py"))) return "Python";
  if (has("next.config.js") || has("next.config.mjs") || has("next.config.ts")) return "Next.js";
  if (has("nuxt.config.ts") || has("nuxt.config.js")) return "Nuxt";
  if (has("vite.config.js") || has("vite.config.ts")) return "Vite";
  if ([...names].some((p) => p.endsWith(".vue"))) return "Vue";
  if (has("angular.json")) return "Angular";
  if (has("go.mod")) return "Go";
  if (has("cargo.toml")) return "Rust";
  if (has("composer.json")) return "PHP";
  if (has("gemfile")) return "Ruby";
  if (has("pom.xml") || has("build.gradle")) return "JVM";
  if (has("package.json")) return "Node";
  return undefined;
}

/** Inspect a local directory the operator typed (no contents returned). The fileCount reflects what will
 *  ACTUALLY be imported (deps + .gitignore pruned), so the UI count matches the import. Operator == server
 *  machine (self-hosted), so reading their own disk is in-scope. */
export function scanLocalDir(path: string): { ok: boolean; error?: string; fileCount?: number; sample?: string[]; stack?: string } {
  const p = (path || "").trim();
  if (!p) return { ok: false, error: "Enter a directory path." };
  if (!isAbsolute(p)) return { ok: false, error: "Use an absolute path (e.g. C:\\Users\\you\\project)." };
  let st;
  try { st = statSync(p); } catch { return { ok: false, error: "Path not found." }; }
  if (!st.isDirectory()) return { ok: false, error: "That path is a file, not a directory." };
  const files = walkDir(p, 6000, buildIgnore(p));
  if (files.length === 0) return { ok: false, error: "No importable source files found (only dependencies, build output or git-ignored files)." };
  const sample = files.slice(0, 8).map((f) => relative(p, f).split(sep).join("/"));
  return { ok: true, fileCount: files.length, sample, stack: detectStack(p, files) };
}

/** Copy a snapshot of a source dir into the org workspace (skips dep/build/cache dirs, .gitignore'd paths,
 *  .git, .env, binaries, oversize files). Every write is path-jailed by writeWorkspaceFile/safe(). */
export function copyLocalDirIntoWorkspace(orgId: string, srcPath: string, opts?: { maxFiles?: number; maxBytes?: number }): { copied: number; skipped: number; bytes: number; sample: string[] } {
  const maxFiles = opts?.maxFiles ?? DEFAULT_MAX_FILES;
  const maxBytes = opts?.maxBytes ?? DEFAULT_MAX_BYTES;
  let copied = 0, skipped = 0, bytes = 0;
  const sample: string[] = [];
  for (const abs of walkDir(srcPath, maxFiles + 200, buildIgnore(srcPath))) {
    if (copied >= maxFiles) break;
    const rel = relative(srcPath, abs).split(sep).join("/");
    if (!rel || rel.startsWith("..")) { skipped++; continue; }
    if (SKIP_FILE.test(rel)) { skipped++; continue; }
    let buf: Buffer;
    try { buf = readFileSync(abs); } catch { skipped++; continue; }
    if (buf.length > maxBytes || isBinary(buf)) { skipped++; continue; }
    try { writeWorkspaceFile(orgId, rel, buf.toString("utf8")); copied++; bytes += buf.length; if (sample.length < 8) sample.push(rel); }
    catch { skipped++; } // path escapes / unwritable → skip, never throw
  }
  return { copied, skipped, bytes, sample };
}

/** Clone a GitHub repo (shallow) into a temp dir, copy its files into the workspace, then point the
 *  workspace git `origin` at the CLEAN repo URL (no token). The token is used transiently in the
 *  clone URL and redacted from every returned/logged string. */
export async function cloneRepoIntoWorkspace(orgId: string, repoFull: string, token: string, branch?: string): Promise<{ ok: boolean; error?: string; copied?: number }> {
  const full = repoFull.trim().replace(/^https?:\/\/github\.com\//i, "").replace(/\.git$/, "");
  // owner/repo: no leading `-` on either segment (a `-…` value would be read by git as an OPTION, not a repo —
  // argument injection — even though runCommand spawns shell:false). No `..` either.
  if (!/^[A-Za-z0-9_][\w.-]*\/[A-Za-z0-9_][\w.-]*$/.test(full) || full.includes("..")) return { ok: false, error: "Use the form owner/repo." };
  // A ref/branch flows into `git clone --branch <branch>`; reject anything that could be read as a git option
  // (`--upload-pack=…`, `-x`) or traverse. Must start alphanumeric; a bounded safe charset only.
  if (branch !== undefined && !/^[A-Za-z0-9][\w.\-/]{0,200}$/.test(branch)) return { ok: false, error: "Invalid branch name." };
  const redact = (s: string) => (token ? s.split(token).join("***") : s);
  const cwd = orgRoot(orgId);
  const tmp = join(tmpdir(), "constella-clone-" + uid());
  const authUrl = `https://x-access-token:${token}@github.com/${full}.git`;
  try {
    // `--end-of-options` hard-stops git option parsing before the positional repo+dir, so even a future
    // validation gap can't turn the URL/dir into a flag. `--branch=<b>` (=) keeps the validated ref an option value.
    const args = ["clone", "--depth", "1", "--single-branch", ...(branch ? [`--branch=${branch}`] : []), "--end-of-options", authUrl, tmp];
    const r = await runCommand("git", args, { cwd: tmpdir(), timeoutMs: 180_000 });
    if (r.code !== 0) { try { rmSync(tmp, { recursive: true, force: true }); } catch { /* */ } return { ok: false, error: redact((r.stderr || "git clone failed").slice(-300)) }; }
    const { copied } = copyLocalDirIntoWorkspace(orgId, tmp);
    try { rmSync(tmp, { recursive: true, force: true }); } catch { /* */ }
    // Point origin at the clean (token-free) URL.
    const cleanUrl = `https://github.com/${full}.git`;
    if (!existsSync(join(cwd, ".git"))) await runCommand("git", ["init", "-b", "main"], { cwd });
    const has = await runCommand("git", ["remote", "get-url", "origin"], { cwd });
    await runCommand("git", ["remote", has.code === 0 ? "set-url" : "add", "origin", cleanUrl], { cwd });
    return { ok: true, copied };
  } catch (e) {
    try { rmSync(tmp, { recursive: true, force: true }); } catch { /* */ }
    return { ok: false, error: redact(String(e instanceof Error ? e.message : e)) };
  }
}
