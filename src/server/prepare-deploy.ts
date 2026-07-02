"use server";

import { randomUUID as uid } from "node:crypto";
import { cpSync, mkdirSync, rmSync, writeFileSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { agent, costEntry } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";
import { getSecret } from "@/lib/vault";
import { orgRoot, listFiles, readWorkspaceFile } from "@/lib/fs-workspace";
import { runCommand, runAgentStream, pickBinary, type CliResult } from "@/server/adapters/cli";
import { assembleAgentPrompt } from "@/server/context-manager";
import { emit } from "@/server/events";
import { ensureBootable, detectProject, type ProjectInfo } from "@/server/devserver";
import { scanForSecrets, type SecretFinding } from "@/server/git-scan";
import { pushInbox } from "@/server/inbox";
import { notifyOps } from "@/lib/notify";
import {
  loadDeployRow, upsertDeployRow,
  type DeployRunRow, type PipelineStep, type StepStatus, type ChecklistItem, type RunStatus,
} from "@/server/deploy-store";

/* ----------------------------------------------------------------- clean-export filter */
// Top-level dirs that are Constella's control/planning layer or build/dep noise — NEVER exported.
const DENY_TOP = new Set([
  ".claude", "DOCS", "PO", "Reports", "specs", "issues", "mock", "uploads", "archives", ".testdev",
  "node_modules", ".git", ".next", "dist", "build", "out", "coverage", ".cache", ".turbo", "vendor",
]);
// Secrets / dumps / logs / local stores — never exported (env templates are kept).
const SENSITIVE = /(^|\/)(\.env(\.[\w.-]+)?|id_[rd]sa\w*|.*\.(pem|key|p12|pfx|keystore|jks|ppk|asc)|credentials?\.json|service[-_]?account[\w.-]*\.json|.*\.(sql|dump|bak|sqlite3?|db)|.*\.log|.*\.local)$/i;
const ALLOW_ENV = /\.env\.(example|sample|template|dist)$/i;

const EXPORT_GITIGNORE = `node_modules/\n.next/\ndist/\nbuild/\nout/\n.turbo/\ncoverage/\n.cache/\n*.log\n.env\n.env.*\n!.env.example\n.DS_Store\n`;

/** Is this workspace-relative path part of the CLEAN product (vs Constella-internal / sensitive)? */
function isCleanProductPath(rel: string): boolean {
  const r = rel.replace(/\\/g, "/");
  const top = r.split("/")[0];
  if (DENY_TOP.has(top) || r.startsWith(".constella")) return false;
  if (SENSITIVE.test(r) && !ALLOW_ENV.test(r)) return false;
  return true;
}

/* ----------------------------------------------------------------- small fs/format helpers */
function readProjFile(proj: ProjectInfo | null, name: string, orgId: string): string | null {
  if (proj) { try { const p = join(proj.dir, name); if (existsSync(p)) return readFileSync(p, "utf8"); } catch { /* fall through */ } }
  return readWorkspaceFile(orgId, name);
}
type Pkg = { name?: string; scripts?: Record<string, string>; dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
function readPkg(proj: ProjectInfo | null, orgId: string): Pkg | null {
  const raw = readProjFile(proj, "package.json", orgId);
  if (!raw) return null;
  try { return JSON.parse(raw) as Pkg; } catch { return null; }
}
function hasBuildOutput(orgId: string): boolean {
  const proj = detectProject(orgId);
  if (!proj) return false;
  return ["dist", "build", "out", ".next", ".output", "target/release", "bin"].some((d) => { try { return existsSync(join(proj.dir, d)); } catch { return false; } });
}
function humanBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
function tailOut(r: { stdout: string; stderr: string }): string {
  return (r.stderr || r.stdout || "").replace(/\s+/g, " ").trim().slice(-180);
}

/* ----------------------------------------------------------------- environment snapshot (P1) */
export type RequiredEnvVar = { key: string; hasValue: boolean };
export type DeployEnv = {
  detected: boolean;
  runtime: ProjectInfo["kind"] | "unknown";
  packageManager?: "npm" | "pnpm" | "yarn";
  framework?: string;
  projectName?: string;
  runLabel?: string;
  requiredEnv: RequiredEnvVar[];
  referencedEnvCount: number;
  unsetEnvKeys: string[];
  database: "relational" | "document" | "key-value" | "none";
  ports: number[];
  hasDockerfile: boolean;
  hasCompose: boolean;
  buildScript?: string;
  startScript?: string;
  mode: "dev" | "prod" | "unknown";
};

function detectFramework(deps: Record<string, string>, runtime: DeployEnv["runtime"]): string | undefined {
  const has = (k: string) => k in deps;
  if (has("next")) return "Next.js app";
  if (has("nuxt")) return "Nuxt app";
  if (has("@remix-run/react")) return "Remix app";
  if (has("@angular/core")) return "Angular app";
  if (has("svelte") || has("@sveltejs/kit")) return "Svelte app";
  if (has("vue")) return "Vue app";
  if (has("react")) return "React app";
  if (has("@nestjs/core")) return "Nest API";
  if (has("express") || has("fastify") || has("koa") || has("@hapi/hapi")) return "Node server";
  if (runtime === "python") return "Python service";
  if (runtime === "go") return "Go service";
  if (runtime === "rust") return "Rust service";
  if (runtime === "static") return "Static site";
  if (runtime === "node") return "Node app";
  return undefined;
}
function detectDatabase(deps: Record<string, string>): DeployEnv["database"] {
  const has = (...ks: string[]) => ks.some((k) => k in deps);
  if (has("pg", "postgres", "mysql", "mysql2", "better-sqlite3", "sqlite3", "sequelize", "prisma", "drizzle-orm", "typeorm", "knex")) return "relational";
  if (has("mongodb", "mongoose")) return "document";
  if (has("redis", "ioredis")) return "key-value";
  return "none";
}
function detectPorts(proj: ProjectInfo | null, orgId: string): { ports: number[]; hasDockerfile: boolean; hasCompose: boolean } {
  const ports = new Set<number>();
  const docker = readProjFile(proj, "Dockerfile", orgId);
  if (docker) for (const m of docker.matchAll(/EXPOSE\s+(\d+)/gi)) ports.add(Number(m[1]));
  const compose = readProjFile(proj, "docker-compose.yml", orgId) ?? readProjFile(proj, "docker-compose.yaml", orgId) ?? readProjFile(proj, "compose.yml", orgId) ?? readProjFile(proj, "compose.yaml", orgId);
  // Anchor to a compose port-mapping line (`- "8080:80"` / `- 8080:80`) so a `host:container` substring
  // elsewhere in the file (a sha-pinned tag, an interval) isn't surfaced as a bogus exposed port.
  if (compose) for (const m of compose.matchAll(/^[ \t]*-[ \t]*["']?(\d{2,5}):\d{2,5}\b/gm)) ports.add(Number(m[1]));
  return { ports: [...ports].filter((p) => p > 0 && p < 65536).slice(0, 12), hasDockerfile: docker != null, hasCompose: compose != null };
}
const SRC_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|vue|svelte)$/i;
const ENV_REF_RE = /(?:process\.env\.([A-Z][A-Z0-9_]*)|process\.env\[['"]([A-Z][A-Z0-9_]*)['"]\]|import\.meta\.env\.([A-Z][A-Z0-9_]*)|os\.environ(?:\.get)?\(\s*['"]([A-Z][A-Z0-9_]*)['"]|os\.getenv\(\s*['"]([A-Z][A-Z0-9_]*)['"]|os\.Getenv\(\s*['"]([A-Z][A-Z0-9_]*)['"])/g;
function scanEnvRefs(orgId: string): Set<string> {
  const keys = new Set<string>();
  let n = 0;
  for (const rel of listFiles(orgId)) {
    if (!SRC_EXT.test(rel)) continue;
    if (n++ > 1500) break;
    const content = readWorkspaceFile(orgId, rel);
    if (!content || content.length > 512 * 1024) continue;
    for (const m of content.matchAll(ENV_REF_RE)) {
      const k = m[1] || m[2] || m[3] || m[4] || m[5] || m[6];
      if (k) keys.add(k);
    }
  }
  return keys;
}
function parseEnvKeys(content: string | null): RequiredEnvVar[] {
  if (!content) return [];
  const out: RequiredEnvVar[] = [];
  for (const line of content.split("\n")) {
    const m = /^\s*([A-Z][A-Z0-9_]*)\s*=(.*)$/.exec(line);
    if (!m) continue;
    const val = m[2].trim().replace(/^["']|["']$/g, "");
    out.push({ key: m[1], hasValue: val.length > 0 && !/^(your[_-]|<|change[_-]?me|xxx|placeholder|example)/i.test(val) });
  }
  return out;
}
const ENV_NOISE = new Set(["NODE_ENV", "PORT", "HOST", "PWD", "HOME", "PATH", "CI", "TZ", "VERCEL", "VERCEL_ENV"]);

/** Deterministic environment snapshot for the env panel + checklist. No agent. */
async function detectDeployEnv(orgId: string): Promise<DeployEnv> {
  const proj = detectProject(orgId);
  const runtime: DeployEnv["runtime"] = proj?.kind ?? "unknown";
  const pkg = readPkg(proj, orgId);
  const deps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) };
  const envExampleRaw = readProjFile(proj, ".env.example", orgId) ?? readProjFile(proj, ".env.sample", orgId) ?? readProjFile(proj, ".env.template", orgId);
  const requiredEnv = parseEnvKeys(envExampleRaw);
  const documented = new Set(requiredEnv.map((e) => e.key));
  const referenced = scanEnvRefs(orgId);
  const unsetEnvKeys = [...referenced].filter((k) => !documented.has(k) && !ENV_NOISE.has(k)).sort().slice(0, 40);
  const { ports, hasDockerfile, hasCompose } = detectPorts(proj, orgId);
  return {
    detected: !!proj,
    runtime,
    packageManager: runtime === "node" ? (proj!.runCmd as DeployEnv["packageManager"]) : undefined,
    framework: detectFramework(deps, runtime),
    projectName: proj?.name,
    runLabel: proj?.label,
    requiredEnv,
    referencedEnvCount: referenced.size,
    unsetEnvKeys,
    database: runtime === "node" ? detectDatabase(deps) : "none",
    ports,
    hasDockerfile,
    hasCompose,
    buildScript: pkg?.scripts?.build,
    startScript: pkg?.scripts?.start,
    mode: !proj ? "unknown" : hasBuildOutput(orgId) ? "prod" : "dev",
  };
}

/** Server action: the environment snapshot for the current workspace. */
export async function getDeployEnv(): Promise<DeployEnv> {
  const { org } = await requireWorkspace();
  return detectDeployEnv(org.id);
}

/* ----------------------------------------------------------------- clean tree + preview (P2) */
/** Copy the CLEAN product into `tmp` (single source of truth shared by export + preview). */
function buildCleanTree(tmp: string, orgId: string): { copied: number; docs: string[]; files: { path: string; size: number }[] } {
  const root = orgRoot(orgId);
  const files: { path: string; size: number }[] = [];
  const docs: string[] = [];
  let copied = 0;
  for (const rel of listFiles(orgId)) {
    if (!isCleanProductPath(rel)) continue;
    try {
      const src = join(root, rel);
      const dst = join(tmp, rel);
      mkdirSync(dirname(dst), { recursive: true });
      cpSync(src, dst);
      let size = 0; try { size = statSync(src).size; } catch { /* keep 0 */ }
      const norm = rel.replace(/\\/g, "/");
      files.push({ path: norm, size });
      copied++;
      const base = (norm.split("/").pop() ?? "").toLowerCase();
      if (/^(readme|license|licence|changelog|deploy|contributing)(\.|$)/.test(base)) docs.push(norm);
    } catch { /* skip unreadable */ }
  }
  writeFileSync(join(tmp, ".gitignore"), EXPORT_GITIGNORE);
  return { copied, docs, files };
}

export type TreeNode = { name: string; kind: "dir" | "file"; size?: number; childCount?: number };
function buildTree(files: { path: string; size: number }[]): TreeNode[] {
  const dirs = new Map<string, { size: number; count: number }>();
  const rootFiles: TreeNode[] = [];
  for (const f of files) {
    const parts = f.path.split("/");
    if (parts.length === 1) rootFiles.push({ name: parts[0], kind: "file", size: f.size });
    else { const top = parts[0]; const d = dirs.get(top) ?? { size: 0, count: 0 }; d.size += f.size; d.count += 1; dirs.set(top, d); }
  }
  const dirNodes: TreeNode[] = [...dirs.entries()].map(([name, d]) => ({ name, kind: "dir" as const, size: d.size, childCount: d.count }));
  return [...dirNodes.sort((a, b) => a.name.localeCompare(b.name)), ...rootFiles.sort((a, b) => a.name.localeCompare(b.name))];
}

export type CleanPreview = {
  files: { path: string; size: number }[];
  tree: TreeNode[];
  totalBytes: number;
  includedCount: number;
  ignoredCount: number;
  docs: string[];
  hasBuild: boolean;
  secrets: SecretFinding[];
  blocked: boolean;
  error?: string;
};

/** Build the clean tree in a temp dir, scan it for secrets, summarize — never pushes. */
async function buildPreview(orgId: string): Promise<CleanPreview> {
  const tmp = join(tmpdir(), "constella-preview-" + uid());
  try {
    mkdirSync(tmp, { recursive: true });
    const built = buildCleanTree(tmp, orgId);
    let secrets: SecretFinding[] = [];
    if (built.copied > 0) {
      await runCommand("git", ["init", "-b", "main"], { cwd: tmp });
      await runCommand("git", ["add", "-A"], { cwd: tmp });
      secrets = (await scanForSecrets(tmp)).findings;
    }
    const totalBytes = built.files.reduce((a, f) => a + f.size, 0);
    const allFiles = listFiles(orgId).length;
    return {
      files: built.files.slice(0, 500),
      tree: buildTree(built.files),
      totalBytes,
      includedCount: built.copied,
      ignoredCount: Math.max(0, allFiles - built.copied),
      docs: built.docs,
      hasBuild: hasBuildOutput(orgId),
      secrets,
      blocked: secrets.length > 0,
    };
  } catch (e) {
    return { files: [], tree: [], totalBytes: 0, includedCount: 0, ignoredCount: 0, docs: [], hasBuild: false, secrets: [], blocked: false, error: String(e instanceof Error ? e.message : e) };
  } finally {
    try { rmSync(tmp, { recursive: true, force: true }); } catch { /* best-effort */ }
  }
}

/** Server action: read-only preview of the clean export set (+ a pre-export secret scan). */
export async function previewCleanExport(): Promise<CleanPreview> {
  const { org } = await requireWorkspace();
  return buildPreview(org.id);
}

/* ----------------------------------------------------------------- auto checklist (P3) */
async function computeChecklist(orgId: string, wsId: string, row: DeployRunRow, env: DeployEnv): Promise<ChecklistItem[]> {
  const proj = detectProject(orgId);
  const pkg = readPkg(proj, orgId);
  const stepStatus = (k: string) => row.steps.find((s) => s.key === k)?.status;
  const present = (name: string) => readProjFile(proj, name, orgId) != null;
  const hasNodeModules = !!proj && env.runtime === "node" && (() => { try { return existsSync(join(proj.dir, "node_modules")); } catch { return false; } })();
  const hasToken = !!(await getSecret(wsId, "github_pat").catch(() => null));
  const items: ChecklistItem[] = [];
  const push = (key: string, label: string, status: ChecklistItem["status"], detail?: string) => items.push({ key, label, status, detail });

  if (env.runtime === "node") push("pkg", "package.json valid", pkg ? "ok" : "fail", pkg ? undefined : "missing or invalid");
  else push("pkg", "Project manifest present", env.detected ? "ok" : "todo");

  push("deps", "Dependencies installed", env.runtime !== "node" ? (env.detected ? "ok" : "todo") : (hasNodeModules || stepStatus("deps") === "done" ? "ok" : "todo"));
  push("envExample", ".env.example present", env.requiredEnv.length > 0 || present(".env.example") ? "ok" : "todo");
  push("envComplete", "All used env vars documented", env.unsetEnvKeys.length === 0 ? "ok" : "warn", env.unsetEnvKeys.length ? `${env.unsetEnvKeys.length} undocumented` : undefined);

  const sec = stepStatus("secrets");
  push("secrets", "No secrets in the product", sec === "blocked" ? "fail" : sec === "done" ? "ok" : "todo");

  const bs = stepStatus("build");
  push("build", "Production build runs", env.buildScript ? (bs === "done" ? "ok" : bs === "error" ? "fail" : "todo") : "warn", env.buildScript ? undefined : "no build script");

  const ts = stepStatus("tests");
  push("tests", "Tests pass", pkg?.scripts?.test ? (ts === "done" ? "ok" : ts === "error" ? "fail" : "todo") : "warn", pkg?.scripts?.test ? undefined : "no test script");

  push("readme", "README present", present("README.md") || present("readme.md") ? "ok" : "todo");
  push("deployDoc", "Deploy docs present", present("DEPLOY.md") ? "ok" : "todo");
  push("internalExcluded", "Internal files excluded from export", "ok");
  push("exportRepo", "Export repository configured", hasToken ? "ok" : "todo", hasToken ? undefined : "connect a token");
  return items;
}

/** Server action: the current auto checklist (deterministic). */
export async function deployChecklist(): Promise<ChecklistItem[]> {
  const { org, workspace } = await requireWorkspace();
  const [row, env] = await Promise.all([loadDeployRow(workspace.id), detectDeployEnv(org.id)]);
  return computeChecklist(org.id, workspace.id, row, env);
}

/* ----------------------------------------------------------------- run row read (P0) */
export async function getDeployRun(): Promise<DeployRunRow> {
  const { workspace } = await requireWorkspace();
  return loadDeployRow(workspace.id);
}

/* ----------------------------------------------------------------- the agent phase */
async function pickDeployAgent(wsId: string) {
  const agents = await db.select().from(agent).where(eq(agent.workspaceId, wsId));
  return agents.find((x) => /devops/i.test(x.role)) ?? agents.find((x) => x.handle === "ada") ?? agents[0] ?? null;
}
type AgentRow = Awaited<ReturnType<typeof pickDeployAgent>>;
type WsRow = Awaited<ReturnType<typeof requireWorkspace>>["workspace"];

/** One streamed agent call on the "deploy" channel; books real cost. Suppresses the stream's
 *  terminal done/error so the live narration box doesn't end mid-pipeline. */
async function runFocusedAgent(orgId: string, ws: WsRow, a: NonNullable<AgentRow>, instruction: string, runId: string): Promise<CliResult> {
  const binary = pickBinary(a.adapter, a.model);
  const model = binary === "claude" ? (a.model.includes("opus") ? "opus" : a.model.includes("haiku") ? "haiku" : "sonnet") : undefined;
  await db.update(agent).set({ status: "working" }).where(eq(agent.id, a.id));
  const { prompt } = await assembleAgentPrompt({ orgId, ws, agent: a, channel: "deploy", instruction });
  const res = await runAgentStream(prompt, { orgId, binary, model, timeoutMs: 600_000 }, (ev) => {
    if (ev.kind === "done") return; // don't terminate the live narration box mid-pipeline
    void emit(ws.id, { runId, channel: "deploy", agentId: a.id, kind: ev.kind, target: ev.target, detail: ev.detail });
  });
  await db.update(agent).set({ status: "idle" }).where(eq(agent.id, a.id));
  if (res.usd > 0 || res.inputTokens + res.outputTokens > 0) {
    await db.insert(costEntry).values({ id: uid(), workspaceId: ws.id, agentId: a.id, provider: res.binary, model: res.model ?? a.model, usd: res.usd, tokens: res.inputTokens + res.outputTokens, at: new Date() });
  }
  return res;
}

function deployAgentInstruction(env: DeployEnv, buildLog: string): string {
  const lines = [
    "FINISH PREPARING THIS PROJECT FOR PRODUCTION. Dependencies, tests, the secret scan and the production build have ALREADY been run by the system — focus on the remaining gaps.",
    "Do, in order: (1) create/refresh `.env.example` documenting EVERY required environment variable (NEVER inline real secrets/tokens — use placeholders)." + (env.unsetEnvKeys.length ? ` The code references these vars not yet in .env.example: ${env.unsetEnvKeys.slice(0, 30).join(", ")}.` : ""),
    "(2) if the production build failed, FIX the errors until it builds clean;",
    "(3) write/refresh a root `README.md` (what it is, install, run, configure) and a root `DEPLOY.md` with concrete build/run/deploy steps for this project's host;",
    "(4) finish with a SHORT operator summary + the exact next steps to deploy.",
    "Keep the existing product and its UX; do NOT add internal/control files or a second app.",
  ];
  if (buildLog) lines.push("Latest production build output (tail):\n" + buildLog.slice(-1200));
  return lines.join("\n");
}

/* ----------------------------------------------------------------- the pipeline (P4) */
const PIPELINE_STEPS: { key: string; label: string }[] = [
  { key: "analyze", label: "Analyze the project" },
  { key: "deps", label: "Validate dependencies" },
  { key: "env", label: "Validate environment variables" },
  { key: "tests", label: "Run tests" },
  { key: "secrets", label: "Security scan" },
  { key: "build", label: "Production build" },
  { key: "validateBuild", label: "Validate build" },
  { key: "agent", label: "Configure env, fix & document" },
  { key: "package", label: "Prepare clean package" },
];

/** In-process deploy re-entry lock: wsId → claim time. A synchronous claim (no await between the read and the
 *  set) closes the TOCTOU the DB-status guard alone leaves open; a stale claim (>15m) auto-clears so a throw
 *  before finalize can't wedge deploys for the process lifetime. */
const deployRunning = new Map<string, number>();

/**
 * Hybrid production-prep pipeline: deterministic code steps (real commands + checks) + ONE bundled
 * agent phase. Each step persists to the deploy_run row AND emits a "deploy" event so the visual
 * pipeline (poll) and the live narration (AgentRunLive) both show real state.
 */
export async function runDeployPipeline(): Promise<DeployRunRow> {
  const { org, workspace } = await requireWorkspace();
  const wsId = workspace.id;
  const claimed = deployRunning.get(wsId);
  if (claimed && Date.now() - claimed < 15 * 60_000) return loadDeployRow(wsId); // already running in THIS process
  deployRunning.set(wsId, Date.now()); // claim synchronously
  const cur = await loadDeployRow(wsId);
  if (cur.status === "running" && cur.startedAt && Date.now() - cur.startedAt < 15 * 60_000) { deployRunning.delete(wsId); return cur; } // re-entry guard (DB-side)

  const runId = uid();
  const steps: PipelineStep[] = PIPELINE_STEPS.map((s) => ({ key: s.key, label: s.label, status: "waiting" as StepStatus }));
  await upsertDeployRow(wsId, { status: "running", runId, startedAt: Date.now(), steps, summary: "", buildLog: "" });

  const labelOf = (k: string) => PIPELINE_STEPS.find((s) => s.key === k)?.label ?? k;
  const setStep = async (key: string, status: StepStatus, detail?: string) => {
    const i = steps.findIndex((s) => s.key === key);
    if (i >= 0) steps[i] = { ...steps[i], status, detail, ...(status === "running" ? { startedAt: Date.now() } : { endedAt: Date.now() }) };
    await upsertDeployRow(wsId, { steps });
    void emit(wsId, { runId, channel: "deploy", agentId: null, kind: "text", target: "", detail: `${labelOf(key)}${detail ? " — " + detail : ""}` });
  };

  const proj = detectProject(org.id);
  const env = await detectDeployEnv(org.id);
  let buildLog = "";

  const finalize = async (status: RunStatus, summary: string): Promise<DeployRunRow> => {
    deployRunning.delete(wsId); // release the in-process lock — finalize is the single terminal funnel
    const checklist = await computeChecklist(org.id, wsId, await loadDeployRow(wsId), env);
    await upsertDeployRow(wsId, { status, summary, checklist, buildLog });
    void emit(wsId, { runId, channel: "deploy", agentId: null, kind: status === "failed" ? "error" : "done", target: "prep complete", detail: summary.slice(0, 160) });
    await notifyOps(wsId, { kind: "deploy", text: status === "done" ? "Production prep finished" : status === "blocked" ? "Prep blocked — secrets found" : "Production prep failed", detail: summary.slice(0, 200) });
    revalidatePath("/prepare-deploy");
    return loadDeployRow(wsId);
  };

  try {
    // analyze
    await setStep("analyze", "running");
    if (!proj) { await setStep("analyze", "error", "No runnable project detected."); return finalize("failed", "No runnable project detected in the workspace."); }
    await setStep("analyze", "done", `${env.framework ?? env.runtime}${proj.label ? " · " + proj.label : ""}`);

    // deps
    await setStep("deps", "running");
    if (proj.install) {
      const r = await runCommand(proj.install.cmd, proj.install.args, { cwd: proj.dir, timeoutMs: 300_000, env: { ...process.env, CI: "1" } });
      await setStep("deps", r.code === 0 ? "done" : "error", r.code === 0 ? "dependencies installed" : (r.timedOut ? "install timed out" : tailOut(r)));
    } else await setStep("deps", "done", "already installed");

    // env
    await setStep("env", "running");
    await setStep("env", env.unsetEnvKeys.length ? "needs-action" : "done", env.unsetEnvKeys.length ? `${env.unsetEnvKeys.length} var(s) missing from .env.example` : `${env.requiredEnv.length} documented`);

    // tests
    await setStep("tests", "running");
    const pkg = readPkg(proj, org.id);
    if (env.runtime === "node" && pkg?.scripts?.test) {
      const r = await runCommand(proj.runCmd, ["test"], { cwd: proj.dir, timeoutMs: 300_000, env: { ...process.env, CI: "1" } });
      await setStep("tests", r.code === 0 ? "done" : "error", r.code === 0 ? "tests passing" : (r.timedOut ? "tests timed out" : tailOut(r)));
    } else await setStep("tests", "needs-action", "no automated test script");

    // secrets (early gate — stop before build/agent)
    await setStep("secrets", "running");
    const sec = await buildPreview(org.id);
    if (sec.blocked) {
      await setStep("secrets", "blocked", `${sec.secrets.length} potential secret(s)`);
      await pushInbox(wsId, { kind: "block", refType: "task", refId: "deploy-prep", title: `Prep blocked — ${sec.secrets.length} secret risk(s)`, detail: sec.secrets.slice(0, 5).map((f) => `${f.file}: ${f.kind}`).join("; ") });
      return finalize("blocked", `Blocked: ${sec.secrets.length} potential secret(s) found in the product. Remove them and re-run.`);
    }
    await setStep("secrets", "done", "no secrets found");

    // build
    await setStep("build", "running");
    if (env.runtime === "node" && env.buildScript) {
      const r = await runCommand(proj.runCmd, proj.runCmd === "npm" ? ["run", "build"] : ["build"], { cwd: proj.dir, timeoutMs: 600_000, env: { ...process.env, CI: "1" } });
      buildLog = `build ${r.code === 0 ? "OK" : r.timedOut ? "TIMED OUT" : "FAILED (" + r.code + ")"}\n` + (r.stdout + r.stderr).slice(-1800);
      await upsertDeployRow(wsId, { buildLog });
      await setStep("build", r.code === 0 ? "done" : "error", r.code === 0 ? "build succeeded" : "build failed — the agent will try to fix it");
    } else await setStep("build", "needs-action", env.runtime === "node" ? "no build script" : "no build step for this stack");

    // validate build
    await setStep("validateBuild", "running");
    const boot = await ensureBootable(wsId, org.id);
    await setStep("validateBuild", boot.ok ? "done" : "error", boot.ok ? (hasBuildOutput(org.id) ? "boots · build output present" : "boots") : boot.detail.slice(0, 160));

    // agent (single creative phase)
    await setStep("agent", "running");
    const a = await pickDeployAgent(wsId);
    let summary = "";
    if (a) {
      const res = await runFocusedAgent(org.id, workspace, a, deployAgentInstruction(env, buildLog), runId);
      summary = (res.text || "").slice(0, 800);
      await setStep("agent", res.ok ? "done" : "error", res.ok ? "configured env, docs & fixes" : (res.error?.slice(0, 160) || "agent run failed"));
    } else await setStep("agent", "needs-action", "no agent available to run");

    // package (re-check after the agent's edits)
    await setStep("package", "running");
    const prev = await buildPreview(org.id);
    await setStep("package", prev.blocked ? "blocked" : "done", prev.blocked ? `${prev.secrets.length} secret risk(s) in the export set` : `${prev.includedCount} file(s) · ${humanBytes(prev.totalBytes)}`);

    return finalize(prev.blocked ? "blocked" : "done", summary || `Prepared ${prev.includedCount} clean file(s) for production.`);
  } catch (e) {
    return finalize("failed", String(e instanceof Error ? e.message : e).slice(0, 300));
  }
}

/* ----------------------------------------------------------------- quick actions (P5) */
async function withDeployEvents<T>(wsId: string, label: string, fn: () => Promise<T>): Promise<T> {
  const runId = uid();
  void emit(wsId, { runId, channel: "deploy", agentId: null, kind: "run", target: label });
  try { const r = await fn(); void emit(wsId, { runId, channel: "deploy", agentId: null, kind: "done", target: label }); return r; }
  catch (e) { void emit(wsId, { runId, channel: "deploy", agentId: null, kind: "error", target: label, detail: String(e) }); throw e; }
}

export async function runBuildOnly(): Promise<{ ok: boolean; log: string }> {
  const { org, workspace } = await requireWorkspace();
  const proj = detectProject(org.id);
  const pkg = readPkg(proj, org.id);
  if (!proj || proj.kind !== "node" || !pkg?.scripts?.build) return { ok: false, log: "No Node build script to run." };
  return withDeployEvents(workspace.id, "production build", async () => {
    const r = await runCommand(proj.runCmd, proj.runCmd === "npm" ? ["run", "build"] : ["build"], { cwd: proj.dir, timeoutMs: 600_000, env: { ...process.env, CI: "1" } });
    const log = `build ${r.code === 0 ? "OK" : r.timedOut ? "TIMED OUT" : "FAILED (" + r.code + ")"}\n` + (r.stdout + r.stderr).slice(-1800);
    await upsertDeployRow(workspace.id, { buildLog: log });
    revalidatePath("/prepare-deploy");
    return { ok: r.code === 0, log };
  });
}

export async function runTestsOnly(): Promise<{ ok: boolean; log: string }> {
  const { org, workspace } = await requireWorkspace();
  const proj = detectProject(org.id);
  const pkg = readPkg(proj, org.id);
  if (!proj || proj.kind !== "node" || !pkg?.scripts?.test) return { ok: false, log: "No test script to run." };
  return withDeployEvents(workspace.id, "tests", async () => {
    const r = await runCommand(proj.runCmd, ["test"], { cwd: proj.dir, timeoutMs: 300_000, env: { ...process.env, CI: "1" } });
    return { ok: r.code === 0, log: `tests ${r.code === 0 ? "PASS" : "FAIL"}\n` + (r.stdout + r.stderr).slice(-1800) };
  });
}

async function genDocs(kind: "readme" | "deploy"): Promise<{ ok: boolean; summary: string }> {
  const { org, workspace } = await requireWorkspace();
  const a = await pickDeployAgent(workspace.id);
  if (!a) return { ok: false, summary: "No agent available." };
  const env = await detectDeployEnv(org.id);
  const ctx = env.framework ? `\nProject: ${env.framework}${env.unsetEnvKeys.length ? `; undocumented env vars: ${env.unsetEnvKeys.slice(0, 20).join(", ")}` : ""}.` : "";
  const instruction = (kind === "readme"
    ? "Write or refresh a clear root `README.md` for this project: what it is, prerequisites, install, run, configure (reference .env.example), and basic usage. Keep it accurate to the real code; do NOT invent features."
    : "Write or refresh a root `DEPLOY.md` with concrete production deploy steps for this project's stack/host: build, environment variables (reference .env.example, never real secrets), run command, and host-specific notes. Keep it accurate to the real project.") + ctx;
  const runId = uid();
  void emit(workspace.id, { runId, channel: "deploy", agentId: a.id, kind: "run", target: kind === "readme" ? "generate README" : "generate deploy docs" });
  const res = await runFocusedAgent(org.id, workspace, a, instruction, runId);
  void emit(workspace.id, { runId, channel: "deploy", agentId: a.id, kind: "done", target: "done" });
  revalidatePath("/prepare-deploy");
  return { ok: res.ok, summary: (res.text || "").slice(0, 400) };
}
export async function generateReadme(): Promise<{ ok: boolean; summary: string }> { return genDocs("readme"); }
export async function generateDeployDocs(): Promise<{ ok: boolean; summary: string }> { return genDocs("deploy"); }

/* ----------------------------------------------------------------- clean source export */
export type ExportResult = { ok: boolean; pushed?: boolean; sha?: string; copied?: number; blocked?: boolean; secrets?: SecretFinding[]; error?: string };

/**
 * Export ONLY the clean product source to a SEPARATE GitHub repo (never the org workspace remote).
 * Shares `buildCleanTree` with the preview; the secret-scan is the final push-time gate.
 */
export async function exportCleanSource(input: { repo: string; token?: string; branch?: string; message?: string }): Promise<ExportResult> {
  const { org, workspace } = await requireWorkspace();
  const repo = (input.repo || "").trim().replace(/^https?:\/\/github\.com\//i, "").replace(/\.git$/, "");
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) return { ok: false, error: "Use the form owner/repo." };
  const token = (input.token?.trim()) || (await getSecret(workspace.id, "github_pat"));
  if (!token) return { ok: false, error: "Provide a GitHub token (or connect one in Commit GitHub first)." };
  const redact = (s: string) => (token ? s.split(token).join("***") : s);

  try {
    const r = await fetch(`https://api.github.com/repos/${repo}`, { headers: { Authorization: `Bearer ${token}`, "User-Agent": "constella", Accept: "application/vnd.github+json" }, signal: AbortSignal.timeout(12_000) });
    if (r.status === 404) return { ok: false, error: "Repo not found, or this token can't access it." };
    if (!r.ok) return { ok: false, error: `GitHub ${r.status}` };
  } catch { return { ok: false, error: "Couldn't reach GitHub." }; }

  const tmp = join(tmpdir(), "constella-export-" + uid());
  const branch = (input.branch?.trim()) || "main";
  try {
    mkdirSync(tmp, { recursive: true });
    const built = buildCleanTree(tmp, org.id);
    if (built.copied === 0) return { ok: false, error: "Nothing to export yet — no clean product source files were found." };

    await runCommand("git", ["init", "-b", branch], { cwd: tmp });
    await runCommand("git", ["add", "-A"], { cwd: tmp });
    // FINAL safety net: block ANY inlined secret regardless of the allowlist.
    const scan = await scanForSecrets(tmp);
    if (scan.findings.length) {
      await pushInbox(workspace.id, { kind: "block", refType: "task", refId: `export-${repo}`, title: `Export blocked — ${scan.findings.length} secret risk(s)`, detail: scan.findings.slice(0, 5).map((f) => `${f.file}: ${f.kind}`).join("; ") });
      await notifyOps(workspace.id, { kind: "security", text: `Clean export blocked — ${scan.findings.length} secret risk(s)`, detail: `Resolve before exporting to ${repo}.` });
      revalidatePath("/prepare-deploy"); revalidatePath("/inbox");
      return { ok: false, blocked: true, secrets: scan.findings, error: `Blocked: ${scan.findings.length} potential secret(s) in the export set.` };
    }
    await runCommand("git", ["-c", "user.email=agents@constella.dev", "-c", "user.name=Constella Agents", "commit", "-m", (input.message?.trim() || "chore: export clean source")], { cwd: tmp });
    const sha = (await runCommand("git", ["rev-parse", "HEAD"], { cwd: tmp })).stdout.trim().slice(0, 7);
    const authUrl = `https://x-access-token:${token}@github.com/${repo}.git`;
    const push = await runCommand("git", ["push", "-f", authUrl, `HEAD:${branch}`], { cwd: tmp, timeoutMs: 120_000 });
    if (push.code !== 0) return { ok: false, error: redact((push.stderr || "git push failed").slice(-300)) };
    await upsertDeployRow(workspace.id, { lastExport: { ok: true, sha, copied: built.copied, repo, branch, at: Date.now() } });
    revalidatePath("/prepare-deploy");
    return { ok: true, pushed: true, sha, copied: built.copied };
  } catch (e) {
    return { ok: false, error: redact(String(e instanceof Error ? e.message : e)) };
  } finally {
    try { rmSync(tmp, { recursive: true, force: true }); } catch { /* best-effort */ }
  }
}
