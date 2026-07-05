"use server";

import { existsSync, writeFileSync } from "node:fs";
import { mkdirSync } from "node:fs";
import { randomUUID as uid } from "node:crypto";
import { join } from "node:path";
import { eq, and, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { vault, file, account, workspace as workspaceTable } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";
import { putSecret, getSecret } from "@/lib/vault";
import { orgRoot } from "@/lib/fs-workspace";
import { runCommand } from "@/server/adapters/cli";
import { scanForSecrets, type SecretFinding } from "@/server/git-scan";
import { pushInbox } from "@/server/inbox";
import { notifyOps } from "@/lib/notify";

const GH = "https://api.github.com";

const DEFAULT_GITIGNORE = `# Constella default — don't commit deps/build output
node_modules/
.next/
dist/
build/
out/
.turbo/
coverage/
.cache/
*.log
.env
.env.*
.DS_Store
.testdev/
uploads/
`;

/** Ensure a git repo + a sane .gitignore exist so `git add -A` never stages node_modules/build. */
async function ensureRepo(cwd: string): Promise<boolean> {
  mkdirSync(cwd, { recursive: true });
  if (!existsSync(join(cwd, ".git"))) { const i = await runCommand("git", ["init", "-b", "main"], { cwd }); if (i.code !== 0) return false; }
  const gi = join(cwd, ".gitignore");
  if (!existsSync(gi)) { try { writeFileSync(gi, DEFAULT_GITIGNORE); } catch { /* best-effort */ } }
  return true;
}

/** GitHub token for API + git: the vaulted PAT first, else the user's OAuth access token (only
 *  usable for git if the GitHub OAuth app was granted `repo` scope). */
async function ghToken(workspaceId: string, userId: string): Promise<string | null> {
  const pat = await getSecret(workspaceId, "github_pat");
  if (pat) return pat;
  const [acc] = await db.select().from(account).where(and(eq(account.userId, userId), eq(account.providerId, "github")));
  return acc?.accessToken ?? null;
}

function ghApi(token: string, path: string, init?: RequestInit) {
  return fetch(GH + path, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "User-Agent": "constella", Accept: "application/vnd.github+json", ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(12_000),
  });
}

export type GhRepo = { full: string; private: boolean; branch: string };

/** List the user's repos (most-recently-updated) for the picker. */
export async function listRepos(): Promise<{ ok: boolean; repos?: GhRepo[]; error?: string }> {
  const { session, workspace } = await requireWorkspace();
  const token = await ghToken(workspace.id, session.user.id);
  if (!token) return { ok: false, error: "Connect GitHub first." };
  try {
    const r = await ghApi(token, "/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member");
    if (!r.ok) return { ok: false, error: `GitHub ${r.status}` };
    const j = (await r.json()) as { full_name: string; private: boolean; default_branch: string }[];
    return { ok: true, repos: j.map((x) => ({ full: x.full_name, private: x.private, branch: x.default_branch || "main" })) };
  } catch { return { ok: false, error: "Couldn't reach GitHub." }; }
}

/** Token-only repo list for ONBOARDING (the org/workspace doesn't exist yet, so requireWorkspace
 *  can't run). Validates the PAT via /user, then lists repos. The PAT is NOT vaulted here — it is
 *  vaulted at completeOnboarding once the workspace exists. Never logs the token. */
export async function githubReposForToken(pat: string): Promise<{ ok: boolean; login?: string; repos?: GhRepo[]; error?: string }> {
  const token = (pat || "").trim();
  if (token.length < 7) return { ok: false, error: "That token looks too short." };
  let login: string | undefined;
  try {
    const u = await ghApi(token, "/user");
    if (u.status === 401) return { ok: false, error: "Invalid token (401). It needs the 'repo' scope." };
    if (!u.ok) return { ok: false, error: `GitHub rejected the token (${u.status}).` };
    login = (await u.json().catch(() => ({})))?.login;
    const r = await ghApi(token, "/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member");
    if (!r.ok) return { ok: false, error: `GitHub ${r.status}` };
    const j = (await r.json()) as { full_name: string; private: boolean; default_branch: string }[];
    return { ok: true, login, repos: j.map((x) => ({ full: x.full_name, private: x.private, branch: x.default_branch || "main" })) };
  } catch { return { ok: false, error: "Couldn't reach GitHub — check your connection and retry." }; }
}

/** Create a new repo for the user, then point `origin` at it. */
export async function createRepo(input: { name: string; private?: boolean }): Promise<{ ok: boolean; full?: string; error?: string }> {
  const { session, workspace } = await requireWorkspace();
  const token = await ghToken(workspace.id, session.user.id);
  if (!token) return { ok: false, error: "Connect GitHub first." };
  const name = input.name.trim().replace(/\s+/g, "-");
  if (!/^[\w.-]+$/.test(name)) return { ok: false, error: "Use letters, numbers, - _ . only." };
  try {
    const r = await ghApi(token, "/user/repos", { method: "POST", body: JSON.stringify({ name, private: input.private ?? true, auto_init: false }) });
    if (!r.ok) { const t = await r.text().catch(() => ""); return { ok: false, error: /already exists/i.test(t) ? "A repo with that name already exists." : `GitHub ${r.status}` }; }
    const j = (await r.json()) as { full_name: string };
    await setRepo(j.full_name);
    return { ok: true, full: j.full_name };
  } catch { return { ok: false, error: "Couldn't reach GitHub." }; }
}

/** Point the workspace git `origin` at the chosen repo (owner/repo or a github URL). Verifies the
 *  workspace's PAT can actually access it (so an agent can't be pointed at a repo this company's
 *  token has no rights to) and records the binding for the pre-commit org/repo check. */
export async function setRepo(fullName: string): Promise<{ ok: boolean; error?: string }> {
  const { session, org, workspace: ws } = await requireWorkspace();
  const cwd = orgRoot(org.id);
  mkdirSync(cwd, { recursive: true });
  const full = fullName.trim().replace(/^https?:\/\/github\.com\//i, "").replace(/\.git$/, "");
  if (!/^[\w.-]+\/[\w.-]+$/.test(full)) return { ok: false, error: "Use the form owner/repo." };
  // The bound account's token MUST be able to reach this repo — blocks binding to another org's repo.
  const token = await ghToken(ws.id, session.user.id);
  if (!token) return { ok: false, error: "Connect GitHub for this company first." };
  let defaultBranch = "main";
  try {
    const r = await ghApi(token, `/repos/${full}`);
    if (r.status === 404) return { ok: false, error: "Repo not found, or this company's token can't access it." };
    if (!r.ok) return { ok: false, error: `GitHub ${r.status}` };
    defaultBranch = ((await r.json()) as { default_branch?: string }).default_branch || "main";
  } catch { return { ok: false, error: "Couldn't reach GitHub." }; }
  const url = `https://github.com/${full}.git`;
  if (!(await ensureRepo(cwd))) return { ok: false, error: "git init failed" };
  const has = await runCommand("git", ["remote", "get-url", "origin"], { cwd });
  const res = has.code === 0
    ? await runCommand("git", ["remote", "set-url", "origin", url], { cwd })
    : await runCommand("git", ["remote", "add", "origin", url], { cwd });
  if (res.code !== 0) return { ok: false, error: "couldn't set origin" };
  await db.update(workspaceTable).set({ settings: { ...(ws.settings ?? {}), github: { ...(ws.settings?.github ?? {}), repo: full, defaultBranch } } }).where(eq(workspaceTable.id, ws.id));
  revalidatePath("/github"); revalidatePath("/code");
  return { ok: true };
}

/** Current `origin` repo (owner/repo) or null — drives the header + picker state. */
export async function currentRepo(): Promise<string | null> {
  const { org } = await requireWorkspace();
  const cwd = orgRoot(org.id);
  if (!existsSync(join(cwd, ".git"))) return null;
  const r = await runCommand("git", ["remote", "get-url", "origin"], { cwd });
  if (r.code !== 0) return null;
  const m = r.stdout.trim().match(/github\.com[/:]([\w.-]+\/[\w.-]+?)(?:\.git)?\s*$/i);
  return m ? m[1] : null;
}

/** Run REAL `git status --porcelain` and reconcile `file.gitStatus` so the GitHub + Code modules
 *  show the actual working-tree changes (was never populated → always "No changes"). No revalidate
 *  — callers (page render / a Refresh button) decide that. */
const refreshing = new Set<string>(); // per-workspace lock: prevents two concurrent renders racing
                                      // the file-row reconcile (which would insert duplicate rows).

export async function refreshGitStatus(): Promise<{ ok: boolean; changed: number }> {
  const { org, workspace } = await requireWorkspace();
  if (refreshing.has(workspace.id)) return { ok: true, changed: 0 }; // another refresh in flight
  refreshing.add(workspace.id);
  try {
  const cwd = orgRoot(org.id);
  if (!(await ensureRepo(cwd))) return { ok: false, changed: 0 };
  // `-z` → NUL-separated, RAW (unquoted) paths. Renames emit the NEW path then the OLD path as a
  // separate NUL field — without -z, non-ASCII/CJK names are octal-escaped and corrupt the parse.
  const st = await runCommand("git", ["status", "--porcelain", "-z", "--untracked-files=all"], { cwd });
  if (st.code !== 0) return { ok: false, changed: 0 };
  const map = new Map<string, "M" | "A" | "D" | "U">();
  const fields = st.stdout.split("\0");
  for (let i = 0; i < fields.length; i++) {
    const entry = fields[i];
    if (!entry || entry.length < 3) continue;
    const x = entry[0], y = entry[1];
    const p = entry.slice(3); // skip "XY " prefix
    if (x === "R" || x === "C" || y === "R" || y === "C") i++; // rename/copy → consume the old-path field
    if (!p || p.startsWith(".git/") || /(^|\/)node_modules\//.test(p)) continue;
    const code = (x === "?" || y === "?") ? "U" : (x === "D" || y === "D") ? "D" : (x === "A" || y === "A") ? "A" : "M";
    map.set(p, code);
  }
  const existing = await db.select().from(file).where(eq(file.workspaceId, workspace.id));
  const byPath = new Map(existing.map((f) => [f.path, f]));
  for (const f of existing) if (f.gitStatus !== "" && !map.has(f.path)) await db.update(file).set({ gitStatus: "" }).where(eq(file.id, f.id));
  for (const [p, code] of map) {
    const ex = byPath.get(p);
    if (ex) { if (ex.gitStatus !== code) await db.update(file).set({ gitStatus: code }).where(eq(file.id, ex.id)); }
    else await db.insert(file).values({ id: uid(), workspaceId: workspace.id, path: p, gitStatus: code });
  }
  return { ok: true, changed: map.size };
  } finally { refreshing.delete(workspace.id); }
}

/** Unified diff for one changed file (Code Source-control viewer). */
export async function fileDiff(path: string): Promise<{ ok: boolean; diff: string }> {
  const { org } = await requireWorkspace();
  const cwd = orgRoot(org.id);
  if (!existsSync(join(cwd, ".git"))) return { ok: false, diff: "" };
  // Tracked changes; if the file is untracked, show it as an all-added diff.
  const tracked = await runCommand("git", ["diff", "HEAD", "--", path], { cwd, timeoutMs: 15_000 });
  let diff = tracked.stdout;
  if (!diff.trim()) { const u = await runCommand("git", ["diff", "--no-index", "/dev/null", path], { cwd, timeoutMs: 15_000 }); diff = u.stdout; }
  return { ok: true, diff: diff.slice(0, 60_000) };
}

/** Validate a GitHub Personal Access Token against the API, then vault it (never plaintext). */
export async function connectGitHub(pat: string): Promise<{ ok: boolean; login?: string; error?: string }> {
  const { workspace } = await requireWorkspace();
  const token = pat.trim();
  if (token.length < 7) return { ok: false, error: "That token looks too short." };
  // Verify the token actually works (and isn't fabricated) before storing it.
  let login: string | undefined;
  try {
    const r = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${token}`, "User-Agent": "constella", Accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(8000),
    });
    if (r.status === 401) return { ok: false, error: "Invalid token (401). Make sure it has the 'repo' scope." };
    if (!r.ok) return { ok: false, error: `GitHub rejected the token (${r.status}).` };
    login = (await r.json().catch(() => ({})))?.login;
  } catch {
    return { ok: false, error: "Couldn't reach GitHub — check your connection and retry." };
  }
  // Replace any existing PAT so reconnecting doesn't leave stale rows.
  await db.delete(vault).where(and(eq(vault.workspaceId, workspace.id), eq(vault.ref, "github_pat")));
  await putSecret(workspace.id, "github_pat", token);
  // Bind the GitHub account to THIS workspace (per-company config) + clear any stale repo binding so
  // a different account can't push to the previous account's repo.
  await db.update(workspaceTable).set({ settings: { ...(workspace.settings ?? {}), github: { login, repo: undefined, defaultBranch: undefined } } }).where(eq(workspaceTable.id, workspace.id));
  revalidatePath("/github");
  return { ok: true, login };
}

/** Forget the stored GitHub PAT — the screen falls back to the connect state. */
export async function disconnectGitHub() {
  const { workspace } = await requireWorkspace();
  await db.delete(vault).where(and(eq(vault.workspaceId, workspace.id), eq(vault.ref, "github_pat")));
  revalidatePath("/github");
  return { ok: true };
}

/**
 * Draft a Conventional-Commit message from the REAL changed files in this
 * workspace. No fabrication: if nothing has changed the caller gets an empty
 * draft and the honest empty state stays visible.
 */
export async function draftCommitMessage() {
  const { workspace } = await requireWorkspace();
  const changes = await db
    .select({ path: file.path, st: file.gitStatus })
    .from(file)
    .where(and(eq(file.workspaceId, workspace.id), ne(file.gitStatus, "")));
  if (changes.length === 0) return { ok: false as const, message: "" };

  const added = changes.filter((c) => c.st === "A").length;
  const modified = changes.filter((c) => c.st === "M").length;
  const removed = changes.filter((c) => c.st === "D").length;
  const verb = added && !modified && !removed ? "feat" : removed && !added && !modified ? "refactor" : "chore";
  const parts: string[] = [];
  if (modified) parts.push(`update ${modified} file${modified > 1 ? "s" : ""}`);
  if (added) parts.push(`add ${added} file${added > 1 ? "s" : ""}`);
  if (removed) parts.push(`remove ${removed} file${removed > 1 ? "s" : ""}`);
  const subject = `${verb}: ${parts.join(", ")}`;
  const body = changes.map((c) => `${c.st} ${c.path}`).join("\n");
  return { ok: true as const, message: `${subject}\n\n${body}` };
}

export type PushResult = {
  ok: boolean;          // a real commit landed
  committed: boolean;
  sha: string;
  pushed: boolean;      // reached a configured remote
  prUrl: string;
  nothing: boolean;     // working tree had nothing to commit
  error?: string;
  blocked?: boolean;        // a safety gate stopped the commit (config or secrets)
  secrets?: SecretFinding[]; // secret-scan findings when blocked
};

/** Run the pre-commit secret scan on demand (UI "Scan" button) without committing. */
export async function scanWorkspace(): Promise<{ ok: boolean; findings: SecretFinding[]; scanned: number; files: number }> {
  const { org } = await requireWorkspace();
  const cwd = orgRoot(org.id);
  if (!(await ensureRepo(cwd))) return { ok: false, findings: [], scanned: 0, files: 0 };
  const r = await scanForSecrets(cwd);
  return { ok: true, ...r };
}

/**
 * REAL git: stage + commit the workspace dir on disk (initialising the repo on
 * first use), then push to `origin` and open a PR when a remote + PAT exist.
 * The commit is always real local git history; push/PR are honestly reported as
 * skipped when no remote is configured. The PAT is redacted from every captured
 * string so it can never leak into a notification or the UI.
 */
export async function commitPush(input: { repo: string; branch: string; message: string; delegated?: boolean; force?: boolean }): Promise<PushResult> {
  const { org, workspace } = await requireWorkspace();
  const cwd = orgRoot(org.id);
  mkdirSync(cwd, { recursive: true });
  const branch = input.branch || "main";
  const pat = await getSecret(workspace.id, "github_pat");
  const redact = (s: string) => (pat ? s.split(pat).join("***") : s).slice(-300);
  const out: PushResult = { ok: false, committed: false, sha: "", pushed: false, prUrl: "", nothing: false };

  // Ensure a repo + .gitignore exist (so add -A never stages node_modules/build).
  if (!(await ensureRepo(cwd))) { out.error = "git init failed"; return finish(workspace.id, out, input); }

  // ── SAFETY GATE 1: GitHub must be configured FOR THIS COMPANY (per-workspace PAT). On org switch
  //    the new workspace has no PAT → blocked until reconfigured.
  if (!pat) { out.blocked = true; out.error = "GitHub isn't configured for this company — connect a token + pick a repo first."; return finish(workspace.id, out, input); }

  // ── SAFETY GATE 2: commit only to the repo bound to the ACTIVE workspace. The configured `origin`
  //    must match the recorded binding (settings.github.repo) — prevents pushing to another org's repo.
  const boundRepo = workspace.settings?.github?.repo;
  const origin = await currentRepo();
  if (!boundRepo || !origin) { out.blocked = true; out.error = "No repository set for this company — pick or create one first."; return finish(workspace.id, out, input); }
  if (boundRepo.toLowerCase() !== origin.toLowerCase()) {
    out.blocked = true; out.error = `Origin (${origin}) doesn't match this company's configured repo (${boundRepo}). Re-select the repo before committing.`;
    return finish(workspace.id, out, input);
  }

  // ── SAFETY GATE 3: mandatory secret scan of the would-be-committed files. Any finding BLOCKS the
  //    commit and lands in the Inbox for fix/approval (operator may re-run with force after review).
  if (!input.force) {
    const scan = await scanForSecrets(cwd);
    if (scan.findings.length) {
      out.blocked = true; out.secrets = scan.findings;
      out.error = `Blocked: ${scan.findings.length} potential secret(s)/sensitive file(s) in the change set. Resolve them or review before committing.`;
      await pushInbox(workspace.id, {
        kind: "block", refType: "task", refId: `commit-${origin}`,
        title: `Commit blocked — ${scan.findings.length} secret risk(s)`,
        detail: `Pushing to ${origin} was blocked. Sensitive items:\n` + scan.findings.slice(0, 20).map((f) => `• ${f.file}${f.line ? ":" + f.line : ""} — ${f.kind} (${f.preview})`).join("\n"),
      });
      await notifyOps(workspace.id, { kind: "security", text: `Commit blocked — ${scan.findings.length} secret risk(s)`, detail: scan.findings.slice(0, 5).map((f) => `${f.file}: ${f.kind}`).join("; ") });
      revalidatePath("/github"); revalidatePath("/inbox");
      return out;
    }
  }

  await runCommand("git", ["add", "-A"], { cwd });
  const commit = await runCommand("git", [
    "-c", "user.email=agents@constella.dev", "-c", "user.name=Constella Agents",
    "commit", "-m", input.message,
  ], { cwd });

  if (commit.code === 0) {
    out.committed = true;
    const rev = await runCommand("git", ["rev-parse", "--short", "HEAD"], { cwd });
    out.sha = rev.stdout.trim();
  } else if (/nothing to commit|no changes added/i.test(commit.stdout + commit.stderr)) {
    out.nothing = true;
    return finish(workspace.id, out, input);
  } else {
    out.error = redact(commit.stderr || commit.stdout) || "git commit failed";
    return finish(workspace.id, out, input);
  }

  // Push to origin when one is configured and we have credentials.
  const remote = await runCommand("git", ["remote", "get-url", "origin"], { cwd });
  const originUrl = remote.code === 0 ? remote.stdout.trim() : "";
  if (originUrl && pat && /^https:\/\/github\.com\//i.test(originUrl)) {
    const authed = originUrl.replace(/^https:\/\//i, `https://x-access-token:${pat}@`);
    const push = await runCommand("git", ["push", authed, `HEAD:${branch}`], { cwd, timeoutMs: 120_000 });
    out.pushed = push.code === 0;
    if (!out.pushed) {
      out.error = redact(push.stderr) || "git push failed";
      // A rejected / non-fast-forward push is a merge conflict the operator must resolve → Inbox.
      if (/rejected|non-fast-forward|fetch first|merge conflict|failed to push/i.test(push.stderr)) {
        await pushInbox(workspace.id, { kind: "block", refType: "task", refId: `push:${input.repo}:${branch}`, title: `Push rejected — ${input.repo}`, detail: `git push to \`${branch}\` was rejected (remote conflict / non-fast-forward). Pull + resolve, then push again.\n\n${redact(push.stderr).slice(0, 300)}` });
      }
    }

    // Delegated → open a PR via gh using the PAT (never persisted; passed as env).
    if (out.pushed && input.delegated) {
      const pr = await runCommand("gh", ["pr", "create", "--fill", "--head", branch], { cwd, timeoutMs: 60_000, env: { GH_TOKEN: pat } });
      const url = (pr.stdout.match(/https:\/\/github\.com\/\S+/) ?? [])[0];
      if (url) out.prUrl = url;
      else if (pr.code !== 0) out.error = redact(pr.stderr).slice(0, 200) || "gh pr create did not open a PR (is the branch the repo default, or no diff vs base?)"; // surface the no-PR case instead of silently succeeding
    }
  } else if (!originUrl) {
    out.error = "committed locally — no 'origin' remote configured to push";
  } else if (!pat) {
    out.error = "committed locally — connect a GitHub PAT to push";
  }

  return finish(workspace.id, out, input);
}

async function finish(workspaceId: string, out: PushResult, input: { repo: string; branch: string; message: string; delegated?: boolean }): Promise<PushResult> {
  if (out.committed) {
    // Reflect the commit by clearing the tracked change set that was just committed.
    await db.update(file).set({ gitStatus: "" }).where(and(eq(file.workspaceId, workspaceId), ne(file.gitStatus, "")));
    const where = out.pushed ? `pushed to ${input.repo} · ${input.branch}` : "committed locally";
    await notifyOps(workspaceId, {
      kind: "deploy",
      text: `Workspace ${where}${out.sha ? ` (${out.sha})` : ""}`,
      detail: (input.delegated && out.prUrl ? `PR: ${out.prUrl}\n` : "") + input.message,
    });
  }
  out.ok = out.committed;
  revalidatePath("/github");
  return out;
}
