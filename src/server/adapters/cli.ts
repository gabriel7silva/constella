import "server-only";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync, copyFileSync, readFileSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join, dirname, isAbsolute, resolve, sep } from "node:path";
import { orgRoot, constellaHome } from "@/lib/fs-workspace";

/**
 * Real agent execution. Drives the locally-installed `claude` (Claude Code) and
 * `codex` CLIs as subprocesses inside the agent's workspace dir, capturing REAL
 * token usage + cost from their JSON output. No API keys — uses the user's
 * subscription via the CLI. Never fabricates usage.
 */
export type CliResult = {
  ok: boolean;
  text: string;
  usd: number;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  binary: string;          // "claude" | "codex" | "gemini" | an http provider id
  model?: string;
  error?: string;
  cancelled?: boolean;     // true when the operator stopped the run (Ctrl+C, then forced fallback) - not a real failure
  subtype?: string;        // the CLI result subtype ("success" | "error_max_turns" | …) — lets a caller tell a
                           // clean finish from "ended early but still produced a usable reply" (vs a hard failure).
};

const IS_WIN = process.platform === "win32";

/**
 * Whether agents may run shell that needs network/full exec (install deps + run tests).
 *
 * Run-mode aware:
 *   - `start` (local dev) → FULL access: install + test freely. You're on your own machine.
 *   - `vps` / `auth` / `portable` (prod) → JAILED: edits-only, no network/arbitrary exec. Prod
 *     already runs inside Docker + Tailscale (the container is the hard jail); the CLI stays
 *     restricted on top for defense-in-depth.
 * Override either way with `CONSTELLA_AGENT_FULL_ACCESS=1|0`.
 */
const RUN_MODE = process.env.CONSTELLA_RUN_MODE ?? "start";
const AGENT_FULL_ACCESS = process.env.CONSTELLA_AGENT_FULL_ACCESS != null
  ? process.env.CONSTELLA_AGENT_FULL_ACCESS !== "0"
  : RUN_MODE === "start";

/** Permission flags for the claude CLI — full lets it run bash (install/test); jailed = edits only. */
function claudePermArgs(): string[] {
  return AGENT_FULL_ACCESS ? ["--permission-mode", "bypassPermissions"] : ["--permission-mode", "acceptEdits"];
}

/**
 * Company agents must run VANILLA — independent of the OPERATOR's personal `~/.claude`
 * customizations. The operator can enable plugins/hooks for their own Claude Code session (e.g.
 * "caveman mode", which rewrites the model's voice into clipped, article-dropped notes); those are
 * registered as UserPromptSubmit/SessionStart hooks that fire for EVERY `claude` invocation —
 * including the headless agent subprocesses we spawn here — so the agents started talking like the
 * operator's plugin instead of themselves. We can't isolate via CLAUDE_CONFIG_DIR (the subscription
 * credentials live in that same dir, so redirecting it logs the agent out). Instead we pass a
 * settings overlay that disables ALL hooks for the agent run, keeping auth intact. Written to a file
 * (not inline JSON) so the braces/quotes never have to survive cmd.exe quoting on Windows.
 */
let AGENT_SETTINGS_PATH: string | null = null;
function vanillaSettingsArgs(): string[] {
  if (AGENT_SETTINGS_PATH === null) {
    try {
      const p = join(tmpdir(), "constella-agent-settings.json");
      writeFileSync(p, JSON.stringify({ disableAllHooks: true }), "utf8");
      AGENT_SETTINGS_PATH = p;
    } catch { AGENT_SETTINGS_PATH = ""; }
  }
  return AGENT_SETTINGS_PATH ? ["--settings", AGENT_SETTINGS_PATH] : [];
}

// ---- Parallel-agent file locking (opt-in: CONSTELLA_AGENT_LOCK_HOOK=1) ---------------------------
// When ON, each `claude` run uses a dedicated CLEAN config dir (no operator hooks/plugins leak in)
// that carries ONLY our PreToolUse lock hook (bin/lock-hook.mjs). The operator's Claude credentials
// are copied in so the agent stays logged in. If isolation can't be set up (no creds, etc.) we FALL
// BACK to the vanilla disableAllHooks behavior — file-locking degrades, auth NEVER breaks. Default
// OFF, so existing installs are unchanged until the operator opts in and verifies login.
// Per-workspace runtime override (set by the runner from settings.agents.fileLocks); falls back to
// the env default. Lets the operator flip file-locking from the Config UI, not only via env.
let LOCK_HOOK_OVERRIDE: boolean | null = null;
export function setLockHook(on: boolean | null): void { LOCK_HOOK_OVERRIDE = on; }
function lockHookOn(): boolean { return LOCK_HOOK_OVERRIDE ?? (process.env.CONSTELLA_AGENT_LOCK_HOOK === "1"); }

// Destructive-command guard (default OFF — opt-in): a PreToolUse hook on Bash that BLOCKS catastrophic
// shell (`rm -rf /`, force-push, mkfs, fork-bomb…). It runs through the SAME clean-config-dir isolation
// as the lock hook (agentClaudeDir) — and as the vanilla note above warns, redirecting CLAUDE_CONFIG_DIR
// can drop the agent's Claude login. So, like the lock hook, it is OFF by default and OPT-IN: the
// operator enables it (env CONSTELLA_AGENT_CMD_GUARD=1 or settings.agents.cmdGuard) after verifying the
// agents stay logged in. When it IS enabled, agentClaudeDir now mirrors BOTH the operator's creds AND
// the account/onboarding state (~/.claude.json) into the clean dir, so the isolated run stays
// authenticated. (Defaulting this ON previously made EVERY agent run — Design, DM, Telegram — fail with
// "Not logged in · Please run /login".) The runner pushes settings.agents.cmdGuard via setGuardHook.
let CMD_GUARD_OVERRIDE: boolean | null = null;
export function setGuardHook(on: boolean | null): void { CMD_GUARD_OVERRIDE = on; }
function guardHookOn(): boolean { return CMD_GUARD_OVERRIDE ?? (process.env.CONSTELLA_AGENT_CMD_GUARD === "1"); }

// Web research — let claude agents use the built-in WebSearch/WebFetch tools to read official docs in
// run. Default ON (disable with env CONSTELLA_WEB_RESEARCH=0 or per-workspace settings.agents.webResearch
// = false, which the runner pushes via setWebResearch before each spawn). `--allowedTools` is ADDITIVE —
// it pre-approves the web tools WITHOUT restricting Read/Edit/Bash (verified against the Claude Code docs).
let WEB_RESEARCH_OVERRIDE: boolean | null = null;
export function setWebResearch(on: boolean | null): void { WEB_RESEARCH_OVERRIDE = on; }
function webResearchOn(): boolean { return WEB_RESEARCH_OVERRIDE ?? (process.env.CONSTELLA_WEB_RESEARCH !== "0"); }
function claudeWebArgs(): string[] { return webResearchOn() ? ["--allowedTools", "WebSearch", "WebFetch"] : []; }
// Build the clean config dir + write settings.json FRESH each call so the per-workspace lock/guard
// flags (pushed by the runner before each spawn) are always honored. Cheap (a creds copy + small write).
function agentClaudeDir(): string | null {
  try {
    const dir = join(constellaHome(), ".agent-claude");
    mkdirSync(dir, { recursive: true });
    const src = join(homedir(), ".claude", ".credentials.json");
    if (!existsSync(src)) return null; // can't keep the agent logged in here → fall back to vanilla
    copyFileSync(src, join(dir, ".credentials.json"));
    // Relocating CLAUDE_CONFIG_DIR also relocates where the CLI reads its ACCOUNT/ONBOARDING state
    // (~/.claude.json: hasCompletedOnboarding, oauthAccount, userID). Copying ONLY .credentials.json left
    // the isolated dir looking un-onboarded, so a `claude -p` run reported "Not logged in · Please run
    // /login". Mirror it too (fresh each spawn) so the isolated run is fully authenticated.
    const cfg = join(homedir(), ".claude.json");
    if (existsSync(cfg)) { try { copyFileSync(cfg, join(dir, ".claude.json")); } catch { /* best effort */ } }
    const root = process.env.CONSTELLA_PKG_ROOT || process.cwd();
    const pre: { matcher: string; hooks: { type: string; command: string }[] }[] = [];
    if (lockHookOn()) pre.push({ matcher: "Write|Edit|MultiEdit|NotebookEdit", hooks: [{ type: "command", command: `node "${join(root, "bin", "lock-hook.mjs")}"` }] });
    if (guardHookOn()) pre.push({ matcher: "Bash", hooks: [{ type: "command", command: `node "${join(root, "bin", "guard-hook.mjs")}"` }] });
    writeFileSync(join(dir, "settings.json"), JSON.stringify({ hooks: { PreToolUse: pre } }), "utf8");
    return dir;
  } catch { return null; }
}
type AgentIdentity = { orgId: string; token?: string; agentId?: string; agentHandle?: string };
/** Settings args for the claude spawn: with the lock hook active the clean config dir already carries
 *  our settings, so we must NOT also pass `--settings disableAllHooks`; otherwise use vanilla. */
function claudeSettingsArgs(dir: string | null): string[] {
  if ((lockHookOn() || guardHookOn()) && dir) return [];
  return vanillaSettingsArgs();
}
/** Env for the claude spawn — adds the clean config dir + the lock-hook identity when the hook is on. The
 *  isolated config dir is resolved ONCE per spawn by the caller and threaded into both helpers (agentClaudeDir
 *  does mkdir + creds/config copy + settings write, so calling it twice per spawn is wasted I/O and can
 *  de-sync the settings args from the env). */
function claudeEnv(id: AgentIdentity, dir: string | null): NodeJS.ProcessEnv {
  if ((!lockHookOn() && !guardHookOn()) || !dir) return process.env;
  return {
    ...process.env,
    CLAUDE_CONFIG_DIR: dir,
    CONSTELLA_ORG_ID: id.orgId,
    CONSTELLA_TASK_ID: id.token || "",
    CONSTELLA_AGENT_ID: id.agentId || "",
    CONSTELLA_AGENT_HANDLE: id.agentHandle || "",
    CONSTELLA_BASE_URL: process.env.CONSTELLA_BASE_URL || "http://127.0.0.1:3000",
  };
}
/** Sandbox flag for the codex CLI — full enables network+exec; workspace-write blocks the network. */
function codexSandbox(): string {
  return AGENT_FULL_ACCESS ? "danger-full-access" : "workspace-write";
}

/**
 * Model names reach argv on a `shell: true` spawn (Windows), and they originate
 * from agent-writable `Agent.md` frontmatter (→ sync → DB). An unconstrained value
 * (e.g. `sonnet"; rm -rf ~`) would be re-parsed by the shell = command injection.
 * The CLI trust boundary validates here rather than trusting caller-side aliasing.
 * Returns the model only if it's a plausible CLI model id; otherwise drops it
 * (the CLI then falls back to its configured default).
 */
function safeModel(model?: string): string | undefined {
  if (!model) return undefined;
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(model) ? model : undefined;
}
/** Like safeModel but allows a `provider/model` slash (OpenClaw / Hermes use provider-prefixed ids).
 *  `/` is not a shell metacharacter, so this stays injection-safe. */
function safeModelSlash(model?: string): string | undefined {
  if (!model || model === "(default)") return undefined;
  return /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,79}$/.test(model) ? model : undefined;
}

type SpawnedChild = ReturnType<typeof spawn>;
type ActiveRun = { child: SpawnedChild; fallback?: NodeJS.Timeout; cancelled?: boolean };

export type ProcResult = { code: number | null; stdout: string; stderr: string; durationMs: number; timedOut: boolean; cancelled: boolean };

// Running agent processes keyed by an abort token (= taskId, or any per-run id a caller generates).
// Lets cancelGoal / cancelRun / Pulse's Stop-All interrupt the in-flight CLI run mid-flight, not just
// gate the next one.
//
// PINNED TO globalThis: `registerChild` runs inside the `agentRespond` server-action bundle, but
// `abortRun` is called from the `/api/runs` ROUTE-HANDLER bundle — and Next.js instantiates a shared
// module SEPARATELY per bundle, so a plain module-level `new Map()` gave each side its OWN registry
// (the route's ACTIVE was always empty → Stop found nothing → the process kept running). A single
// globalThis-scoped instance is shared across every bundle in the same Node process.
type RunRegistry = { active: Map<string, ActiveRun>; aborted: Set<string>; timers: Map<string, NodeJS.Timeout> };
const g = globalThis as unknown as { __constellaRuns?: RunRegistry };
const REG: RunRegistry = g.__constellaRuns ??= { active: new Map(), aborted: new Set(), timers: new Map() };
const ACTIVE = REG.active;
// Tokens cancelled BEFORE their child registered (the claim→spawn window). A child that
// registers later checks this and self-kills, so a cancel can't miss a not-yet-spawned run.
const ABORTED = REG.aborted;
const ABORTED_TTL_MS = 5 * 60_000;
const ABORT_TIMERS = REG.timers;

function rememberAborted(token: string): void {
  ABORTED.add(token);
  const prev = ABORT_TIMERS.get(token);
  if (prev) clearTimeout(prev);
  const timer = setTimeout(() => { ABORTED.delete(token); ABORT_TIMERS.delete(token); }, ABORTED_TTL_MS);
  timer.unref?.();
  ABORT_TIMERS.set(token, timer);
}

function isAbortRequested(token: string | undefined): boolean {
  if (!token) return false;
  return ABORTED.has(token);
}

function forgetAborted(token: string): void {
  ABORTED.delete(token);
  const timer = ABORT_TIMERS.get(token);
  if (timer) clearTimeout(timer);
  ABORT_TIMERS.delete(token);
}
/**
 * Kill a spawned child AND its whole process tree. On Windows, `claude`/`codex` are spawned with
 * `shell: true` (cmd.exe wraps the real binary) — `child.kill()` there only kills the cmd.exe
 * wrapper, leaving the actual agent process running as an orphan (a real, pre-existing gap that
 * also silently affected the timeout-kill below, not just the new Stop button). `taskkill /T`
 * kills the whole tree by PID; fall back to a plain kill if taskkill itself is unavailable.
 */
function killTree(child: SpawnedChild): void {
  if (IS_WIN && child.pid) {
    try {
      const p = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
      p.on("error", () => {});
      p.unref();
      return;
    } catch { /* fall through */ }
  }
  if (child.pid && !IS_WIN) {
    try { process.kill(-child.pid, "SIGKILL"); return; } catch { /* fall through */ }
  }
  try { child.kill("SIGKILL"); } catch { /* already dead */ }
}

// POSIX-only graceful interrupt (SIGINT to the process group). Windows never calls this — abortRun
// there goes straight to killTree (taskkill /T), which is silent and needs no detached console.
function interruptTree(child: SpawnedChild): void {
  if (!child.pid) return;
  try { process.kill(-child.pid, "SIGINT"); return; } catch { /* fall through */ }
  try { child.kill("SIGINT"); } catch { /* hard-kill fallback handles failure */ }
}

function forceKillLater(token: string, child: SpawnedChild): NodeJS.Timeout {
  const timer = setTimeout(() => {
    const active = ACTIVE.get(token);
    if (active?.child === child) killTree(child);
  }, 5_000);
  timer.unref?.();
  return timer;
}
/** Kill an in-flight run by token (taskId), or mark it so a late-spawning child self-kills. */
export function abortRun(token: string): boolean {
  rememberAborted(token);
  const active = ACTIVE.get(token);
  const child = active?.child;
  if (!child) return false; // not spawned yet; the ABORTED mark will interrupt it on registration
  if (active && !active.cancelled) {
    active.cancelled = true;
    // Windows: go straight to a silent PID-tree kill (taskkill /T /F). The graceful Ctrl+C path needs the
    // child to own a separate console — which only `detached:true` provides, and that flashes a visible
    // console window + broke the piped stdin (claude never got the prompt). taskkill is silent + proven.
    if (IS_WIN) { killTree(child); return true; }
    interruptTree(child);
    active.fallback = forceKillLater(token, child);
  }
  return true;
}
/** Register a spawned child under its token; if the token was already aborted, kill it now. */
function registerChild(token: string | undefined, child: SpawnedChild): void {
  if (!token) return;
  ACTIVE.set(token, { child });
  if (isAbortRequested(token)) abortRun(token);
}
function unregisterChild(token?: string): void {
  if (!token) return;
  const active = ACTIVE.get(token);
  if (active?.fallback) clearTimeout(active.fallback);
  ACTIVE.delete(token);
  forgetAborted(token);
}
/** Every token currently registered as a live run — Pulse's "Stop All" enumerates + aborts each. */
export function listActiveTokens(): string[] { return Array.from(ACTIVE.keys()); }

function startCancelPoll(token: string | undefined, child: SpawnedChild): NodeJS.Timeout | undefined {
  if (!token) return undefined;
  const timer = setInterval(() => {
    const active = ACTIVE.get(token);
    if (active?.child === child && !active.cancelled && isAbortRequested(token)) abortRun(token);
  }, 250);
  timer.unref?.();
  return timer;
}

function runProc(cmd: string, args: string[], input: string, cwd: string, timeoutMs: number, env?: NodeJS.ProcessEnv, token?: string, shell: boolean = IS_WIN): Promise<ProcResult> {
  return new Promise((resolve) => {
    const start = Date.now();
    // shell:false (used for git/gh) means args are passed literally as argv — NO cmd.exe
    // metacharacter interpretation, so an attacker-controlled branch/message/path can't inject.
    // detached only on POSIX (process-group kill via process.kill(-pid)). On Windows detached forces a
    // VISIBLE new console AND breaks the piped stdin — we kill by PID-tree (taskkill /T) there, no detach.
    const child = spawn(cmd, args, { cwd, shell, windowsHide: true, env: env ?? process.env, detached: !IS_WIN && !!token });
    registerChild(token, child);
    let stdout = "", stderr = "", timedOut = false;
    // Read BEFORE fin() clears ABORTED, so a caller can tell operator Stop from any other exit.
    const wasCancelled = () => (token ? isAbortRequested(token) || ACTIVE.get(token)?.child === child && ACTIVE.get(token)?.cancelled === true : false);
    const cancelPoll = startCancelPoll(token, child);
    const fin = () => { if (cancelPoll) clearInterval(cancelPoll); unregisterChild(token); };
    const timer = setTimeout(() => { timedOut = true; killTree(child); }, timeoutMs);
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", (e) => { clearTimeout(timer); const cancelled = wasCancelled(); fin(); resolve({ code: -1, stdout, stderr: stderr + String(e), durationMs: Date.now() - start, timedOut, cancelled }); });
    child.on("close", (code) => { clearTimeout(timer); const cancelled = wasCancelled(); fin(); resolve({ code, stdout, stderr, durationMs: Date.now() - start, timedOut, cancelled }); });
    // A child that exits/closes its read end before we finish writing emits EPIPE/ECONNRESET on stdin; with
    // no listener Node throws an unhandled stream error and takes down the whole server. Swallow it — the
    // 'close'/'error' handlers above already resolve the run as a normal non-zero result.
    child.stdin.on("error", () => {});
    if (input) { try { child.stdin.write(input); } catch { /* pipe already closed */ } }
    try { child.stdin.end(); } catch { /* pipe already closed */ }
  });
}

/** Run Claude Code non-interactively; parse the result JSON for real usage + cost. */
export async function runClaude(prompt: string, opts: { model?: string; orgId: string; timeoutMs?: number; token?: string; agentId?: string; agentHandle?: string }): Promise<CliResult> {
  const cwd = orgRoot(opts.orgId);
  mkdirSync(cwd, { recursive: true });
  // cwd = the org workspace. Permission level is set by AGENT_FULL_ACCESS (default: full —
  // can install deps + run tests; set CONSTELLA_AGENT_FULL_ACCESS=0 to re-jail to edits-only).
  const model = safeModel(opts.model);
  const agentDir = (lockHookOn() || guardHookOn()) ? agentClaudeDir() : null; // resolve ONCE per spawn
  const args = ["-p", "--output-format", "json", ...claudeSettingsArgs(agentDir), ...claudePermArgs()];
  if (model) args.push("--model", model);
  const r = await runProc("claude", args, prompt, cwd, opts.timeoutMs ?? 180_000, claudeEnv(opts, agentDir), opts.token);
  if (r.cancelled) return base("claude", opts.model, r.durationMs, "stopped by operator", true);
  if (r.timedOut) return base("claude", opts.model, r.durationMs, "timed out");
  // Claude prints a single result JSON object (may be preceded by warnings on stderr).
  let obj: Record<string, unknown> | null = null;
  try { obj = JSON.parse(r.stdout.trim()); } catch {
    const line = r.stdout.split("\n").reverse().find((l) => l.includes('"type":"result"'));
    if (line) { try { obj = JSON.parse(line); } catch {} }
  }
  if (!obj) return base("claude", opts.model, r.durationMs, r.stderr.slice(-300) || "no JSON output (code " + r.code + ")");
  const usage = (obj.usage ?? {}) as Record<string, number>;
  return {
    ok: obj.is_error !== true && obj.subtype === "success",
    text: String(obj.result ?? ""),
    usd: Number(obj.total_cost_usd ?? 0),
    inputTokens: Number(usage.input_tokens ?? 0) + Number(usage.cache_read_input_tokens ?? 0) + Number(usage.cache_creation_input_tokens ?? 0),
    outputTokens: Number(usage.output_tokens ?? 0),
    durationMs: r.durationMs,
    binary: "claude",
    model: opts.model,
    error: obj.is_error === true ? String(obj.result ?? "error") : undefined,
  };
}

/** Reasoning/thinking effort level (per-agent). Mapped to each CLI's native control where one exists. */
export type Effort = "low" | "medium" | "high" | "max";

/** Codex reasoning-effort as a global `-c` config override (accepts low|medium|high; "max" → high). */
function codexEffortArgs(effort?: Effort): string[] {
  if (!effort) return [];
  const lvl = effort === "max" ? "high" : effort;
  return ["-c", `model_reasoning_effort=${lvl}`];
}

/** Run Codex non-interactively; best-effort usage from its JSONL events. */
export async function runCodex(prompt: string, opts: { model?: string; orgId: string; timeoutMs?: number; token?: string; effort?: Effort }): Promise<CliResult> {
  const cwd = orgRoot(opts.orgId);
  mkdirSync(cwd, { recursive: true });
  const model = safeModel(opts.model);
  // `-c` is a GLOBAL option → it must precede the `exec` subcommand.
  const args = [...codexEffortArgs(opts.effort), "exec", "--json", "--skip-git-repo-check", "-s", codexSandbox()];
  if (model) args.push("-m", model);
  const r = await runProc("codex", args, prompt, cwd, opts.timeoutMs ?? 180_000, undefined, opts.token);
  if (r.cancelled) return base("codex", opts.model, r.durationMs, "stopped by operator", true);
  if (r.timedOut) return base("codex", opts.model, r.durationMs, "timed out");
  let text = "", inTok = 0, outTok = 0, usd = 0;
  for (const line of r.stdout.split("\n")) {
    const t = line.trim();
    if (!t.startsWith("{")) continue;
    try {
      const ev = JSON.parse(t) as Record<string, unknown>;
      const item = (ev.item ?? ev.msg ?? {}) as Record<string, unknown>;
      if (typeof item.text === "string" && item.text) text = item.text;
      if (typeof (ev as { text?: string }).text === "string") text = (ev as { text: string }).text;
      const usage = (ev.usage ?? (ev as { token_usage?: Record<string, number> }).token_usage ?? item.usage ?? {}) as Record<string, number>;
      if (usage.input_tokens) inTok = Number(usage.input_tokens);
      if (usage.output_tokens) outTok = Number(usage.output_tokens);
      if (typeof (ev as { cost_usd?: number }).cost_usd === "number") usd = (ev as { cost_usd: number }).cost_usd;
    } catch { /* skip non-JSON lines */ }
  }
  return { ok: r.code === 0, text, usd, inputTokens: inTok, outputTokens: outTok, durationMs: r.durationMs, binary: "codex", model: opts.model, error: r.code === 0 ? undefined : r.stderr.slice(-300) || "codex exit " + r.code };
}

// Binary VALUES are the actual executable names (so cliVersion/runProc use them directly):
// cursor's exe is `cursor-agent`, Kilo Code's is `kilocode`.
export type CliBinary =
  | "claude" | "codex" | "openclaw" | "hermes"
  | "aider" | "opencode" | "copilot" | "cursor-agent" | "cline" | "kilocode" | "grok";

/** Binaries that take a provider-prefixed `provider/model` id (vs. a bare model alias). */
const SLASH_MODEL_BINARIES = new Set<CliBinary>(["openclaw", "hermes", "opencode", "aider"]);

function base(binary: CliBinary, model: string | undefined, durationMs: number, error: string, cancelled?: boolean): CliResult {
  return { ok: false, text: "", usd: 0, inputTokens: 0, outputTokens: 0, durationMs, binary, model, error, cancelled };
}

/**
 * Run the Hermes (Nous Research) CLI headlessly: `hermes -z "<prompt>"` prints the final response text
 * on stdout (nothing else). Model via a `provider/model` id → `--provider/--model`. Hermes' headless
 * mode emits no token/cost, so those are recorded as 0 (honest). Runs in the agent's workspace cwd.
 */
export async function runHermes(prompt: string, opts: { model?: string; orgId: string; timeoutMs?: number; token?: string }): Promise<CliResult> {
  const cwd = orgRoot(opts.orgId);
  mkdirSync(cwd, { recursive: true });
  const model = safeModelSlash(opts.model);
  const args = ["-z", prompt];
  if (model) {
    const slash = model.indexOf("/");
    if (slash > 0) args.push("--provider", model.slice(0, slash), "--model", model.slice(slash + 1));
    else args.push("--model", model);
  }
  const r = await runProc("hermes", args, "", cwd, opts.timeoutMs ?? 180_000, undefined, opts.token);
  if (r.cancelled) return base("hermes", opts.model, r.durationMs, "stopped by operator", true);
  if (r.timedOut) return base("hermes", opts.model, r.durationMs, "timed out");
  const text = (r.stdout || "").trim();
  return { ok: r.code === 0 && !!text, text, usd: 0, inputTokens: 0, outputTokens: 0, durationMs: r.durationMs, binary: "hermes", model: opts.model, error: r.code === 0 ? undefined : (r.stderr.slice(-300) || "hermes exit " + r.code) };
}

/** Extract the response text from an OpenClaw infer envelope's `outputs` (shape under-documented → defensive). */
function openClawText(outputs: unknown): string {
  if (!outputs) return "";
  if (typeof outputs === "string") return outputs;
  if (Array.isArray(outputs)) {
    return outputs.map((o) => {
      if (typeof o === "string") return o;
      if (o && typeof o === "object") { const x = o as Record<string, unknown>; return String(x.text ?? x.content ?? x.output ?? x.message ?? ""); }
      return "";
    }).filter(Boolean).join("\n");
  }
  if (typeof outputs === "object") { const x = outputs as Record<string, unknown>; return String(x.text ?? x.content ?? ""); }
  return "";
}

/**
 * Run the OpenClaw CLI headlessly: `openclaw infer model run --prompt "<prompt>" --json` returns a
 * JSON envelope `{ok, provider, model, outputs, error}`. Model via `--model provider/model`. No
 * token/cost in the envelope → recorded as 0 (honest). NOTE: `infer` is inference-oriented; whether it
 * edits files in the workspace depends on OpenClaw's tool config.
 */
export async function runOpenClaw(prompt: string, opts: { model?: string; orgId: string; timeoutMs?: number; token?: string }): Promise<CliResult> {
  const cwd = orgRoot(opts.orgId);
  mkdirSync(cwd, { recursive: true });
  const model = safeModelSlash(opts.model);
  const args = ["infer", "model", "run", "--prompt", prompt, "--json"];
  if (model) args.push("--model", model);
  const r = await runProc("openclaw", args, "", cwd, opts.timeoutMs ?? 180_000, undefined, opts.token);
  if (r.cancelled) return base("openclaw", opts.model, r.durationMs, "stopped by operator", true);
  if (r.timedOut) return base("openclaw", opts.model, r.durationMs, "timed out");
  let text = "", ok = r.code === 0, error: string | undefined;
  try {
    const obj = JSON.parse(r.stdout.trim()) as Record<string, unknown>;
    ok = obj.ok !== false && r.code === 0;
    text = openClawText(obj.outputs);
    if (obj.error) error = String((obj.error as { message?: string })?.message ?? obj.error);
  } catch {
    text = r.stdout.trim();
    if (r.code !== 0) { ok = false; error = r.stderr.slice(-300) || "openclaw exit " + r.code; }
  }
  if (!text && !error) error = r.stderr.slice(-300) || "no output (code " + r.code + ")";
  return { ok: ok && !!text, text, usd: 0, inputTokens: 0, outputTokens: 0, durationMs: r.durationMs, binary: "openclaw", model: opts.model, error };
}

/**
 * Generic headless coding-CLI runner for the provider-routed agents (Aider, OpenCode, Copilot,
 * Cursor, Cline, Kilo). Runs `<binary> <args>` in the agent's workspace cwd. These CLIs authenticate
 * via their OWN config/login (their env keys / `auth login`) — Constella drives them, never holds
 * their keys. Output handling is defensive: parse a JSON envelope's text-ish field when present
 * (cursor/cline), else use raw stdout. Headless modes don't emit token/cost → recorded as 0 (honest).
 */
function genericCliText(stdout: string): string {
  const t = stdout.trim();
  if (!t) return "";
  // JSON envelope (cursor --output-format json, cline --json): pull the obvious text field.
  if (t.startsWith("{") || t.startsWith("[")) {
    try {
      const obj = JSON.parse(t) as Record<string, unknown>;
      const cand = obj.result ?? obj.text ?? obj.response ?? obj.content ?? obj.message ?? obj.output;
      if (typeof cand === "string" && cand) return cand;
      if (cand && typeof cand === "object") { const x = cand as Record<string, unknown>; const s = x.text ?? x.content; if (typeof s === "string") return s; }
    } catch { /* not JSON after all — fall through to raw */ }
  }
  return t;
}

async function runGenericCli(binary: CliBinary, args: string[], opts: { orgId: string; model?: string; timeoutMs?: number; token?: string }): Promise<CliResult> {
  const cwd = orgRoot(opts.orgId);
  mkdirSync(cwd, { recursive: true });
  const r = await runProc(binary, args, "", cwd, opts.timeoutMs ?? 180_000, undefined, opts.token);
  if (r.cancelled) return base(binary, opts.model, r.durationMs, "stopped by operator", true);
  if (r.timedOut) return base(binary, opts.model, r.durationMs, "timed out");
  const text = genericCliText(r.stdout);
  const error = r.code === 0 ? (text ? undefined : (r.stderr.slice(-300) || "no output (code " + r.code + ")"))
    : (r.stderr.slice(-300) || `${binary} exit ${r.code}`);
  return { ok: r.code === 0 && !!text, text, usd: 0, inputTokens: 0, outputTokens: 0, durationMs: r.durationMs, binary, model: opts.model, error };
}

/** Aider — one-shot edit: `aider --message <p> --yes-always --no-auto-commits [--model m]`. Provider-routed
 *  via its own env keys (OPENAI_API_KEY / ANTHROPIC_API_KEY / …). No token/cost emitted → 0. */
export async function runAider(prompt: string, opts: { model?: string; orgId: string; timeoutMs?: number; token?: string }): Promise<CliResult> {
  const model = safeModelSlash(opts.model);
  const args = ["--message", prompt, "--yes-always", "--no-auto-commits", "--no-stream"];
  if (model) args.push("--model", model);
  return runGenericCli("aider", args, opts);
}

/** OpenCode — headless: `opencode run <p> [--model provider/model]`. Configure providers via `opencode auth login`. */
export async function runOpenCode(prompt: string, opts: { model?: string; orgId: string; timeoutMs?: number; token?: string }): Promise<CliResult> {
  const model = safeModelSlash(opts.model);
  const args = ["run", prompt];
  if (model) args.push("--model", model);
  return runGenericCli("opencode", args, opts);
}

/** GitHub Copilot CLI — headless: `copilot -p <p> --allow-all-tools [--model m]`. Auth via the Copilot login. */
export async function runCopilot(prompt: string, opts: { model?: string; orgId: string; timeoutMs?: number; token?: string }): Promise<CliResult> {
  const model = safeModelSlash(opts.model);
  const args = ["-p", prompt, "--allow-all-tools"];
  if (model) args.push("--model", model);
  return runGenericCli("copilot", args, opts);
}

/** Cursor CLI — headless: `cursor-agent -p <p> --output-format json [--model m]`. `-p` can hang on some
 *  versions -> shorter default timeout (the runner's forced timeout kill still applies). Auth via `cursor-agent login`. */
export async function runCursor(prompt: string, opts: { model?: string; orgId: string; timeoutMs?: number; token?: string }): Promise<CliResult> {
  const model = safeModelSlash(opts.model);
  const args = ["-p", prompt, "--output-format", "json"];
  if (model) args.push("--model", model);
  return runGenericCli("cursor-agent", args, { ...opts, timeoutMs: opts.timeoutMs ?? 150_000 });
}

/** Cline CLI — headless: `cline --json -y <p> [--model m]`. Provider-routed via its own config. */
export async function runCline(prompt: string, opts: { model?: string; orgId: string; timeoutMs?: number; token?: string }): Promise<CliResult> {
  const model = safeModelSlash(opts.model);
  const args = ["--json", "-y", prompt];
  if (model) args.push("--model", model);
  return runGenericCli("cline", args, opts);
}

/** Kilo Code CLI — headless autonomous run: `kilocode --yes <p> [--model m]`. Provider-routed via its own config. */
export async function runKilo(prompt: string, opts: { model?: string; orgId: string; timeoutMs?: number; token?: string }): Promise<CliResult> {
  const model = safeModelSlash(opts.model);
  const args = ["--yes", prompt];
  if (model) args.push("--model", model);
  return runGenericCli("kilocode", args, opts);
}

function rpcErr(m: Record<string, unknown>): string {
  const e = m.error as { message?: string } | undefined;
  return (e?.message || "error").slice(0, 200);
}

/**
 * Grok Build — xAI's terminal coding agent — driven over its ACP (Agent Client Protocol) JSON-RPC stdio mode
 * (`grok agent stdio`). The prompt travels in the JSON body over stdin, so there is NO command-line length
 * limit and NO cmd.exe arg mangling — the reason grok's inline `-p/--single` mode failed on our large assembled
 * prompts ("Argument list too long" on Linux; "unexpected argument 'task,'" split by cmd.exe on Windows).
 * Sequence: initialize → (authenticate) → session/new → session/prompt; we accumulate the streamed
 * `agent_message_chunk` text and answer the agent's fs read/write + permission requests (auto-approve, jailed to
 * the workspace) so it can actually edit files. Auth: prior `grok` sign-in (SuperGrok / X Premium+) or the
 * GROK_CODE_XAI_API_KEY env. No token/cost emitted → 0 (honest). Newline-delimited JSON framing.
 */
export async function runGrok(prompt: string, opts: { model?: string; orgId: string; timeoutMs?: number; token?: string }): Promise<CliResult> {
  const cwd = orgRoot(opts.orgId);
  mkdirSync(cwd, { recursive: true });
  const start = Date.now();
  const rootReal = resolve(cwd);
  // Keep the agent's fs read/write inside the workspace jail (ACP fs paths are absolute).
  const jail = (p: unknown): string | null => {
    if (typeof p !== "string" || !p) return null;
    const r = resolve(isAbsolute(p) ? p : join(cwd, p));
    return (r === rootReal || r.startsWith(rootReal + sep)) ? r : null;
  };
  return new Promise<CliResult>((done) => {
    // shell:false — grok is a compiled binary; no cmd.exe (its splitting/8 KB cap is exactly what we're avoiding).
    const child = spawn("grok", ["agent", "stdio"], { cwd, shell: false, windowsHide: true, env: process.env, detached: !IS_WIN && !!opts.token });
    registerChild(opts.token, child);
    let buf = "", text = "", stderr = "", settled = false, rid = 100;
    const pending = new Map<number, (m: Record<string, unknown>) => void>();
    const wasCancelled = () => (opts.token ? isAbortRequested(opts.token) || ACTIVE.get(opts.token)?.cancelled === true : false);
    const cancelPoll = startCancelPoll(opts.token, child);
    const write = (o: Record<string, unknown>) => { try { child.stdin.write(JSON.stringify(o) + "\n"); } catch { /* pipe closed */ } };
    const rpc = (method: string, params: Record<string, unknown>) => new Promise<Record<string, unknown>>((res) => { const id = rid++; pending.set(id, res); write({ jsonrpc: "2.0", id, method, params }); });

    function finish(ok: boolean, error?: string, timedOut = false) {
      if (settled) return; settled = true;
      clearTimeout(timer); if (cancelPoll) clearInterval(cancelPoll);
      const cancelled = wasCancelled();
      unregisterChild(opts.token);
      try { killTree(child); } catch { /* already dead */ }
      done({ ok: ok && !!text.trim(), text, usd: 0, inputTokens: 0, outputTokens: 0, durationMs: Date.now() - start, binary: "grok", model: opts.model, error: cancelled ? "stopped by operator" : timedOut ? "timed out" : error, cancelled });
    }
    const timer = setTimeout(() => finish(false, "timed out", true), opts.timeoutMs ?? 240_000);

    function onMessage(m: Record<string, unknown>) {
      const mid = m.id as number | undefined;
      if (mid != null && (m.result !== undefined || m.error !== undefined) && pending.has(mid)) {
        const cb = pending.get(mid)!; pending.delete(mid); cb(m); return; // response to our request
      }
      const method = m.method as string | undefined;
      const params = (m.params ?? {}) as Record<string, unknown>;
      if (method === "session/update") { // streamed agent text
        const u = (params.update ?? {}) as Record<string, unknown>;
        if (u.sessionUpdate === "agent_message_chunk") { const c = (u.content ?? {}) as Record<string, unknown>; if (typeof c.text === "string") text += c.text; }
        return;
      }
      if (method && mid != null) { // a REQUEST FROM the agent — must answer or it hangs
        if (method === "fs/read_text_file") {
          const fp = jail(params.path);
          if (!fp) return write({ jsonrpc: "2.0", id: mid, error: { code: -32602, message: "path outside workspace" } });
          try { return write({ jsonrpc: "2.0", id: mid, result: { content: readFileSync(fp, "utf8") } }); }
          catch { return write({ jsonrpc: "2.0", id: mid, error: { code: -32000, message: "read failed" } }); }
        }
        if (method === "fs/write_text_file") {
          const fp = jail(params.path);
          if (!fp) return write({ jsonrpc: "2.0", id: mid, error: { code: -32602, message: "path outside workspace" } });
          try { mkdirSync(dirname(fp), { recursive: true }); writeFileSync(fp, String(params.content ?? ""), "utf8"); return write({ jsonrpc: "2.0", id: mid, result: {} }); }
          catch { return write({ jsonrpc: "2.0", id: mid, error: { code: -32000, message: "write failed" } }); }
        }
        if (method === "session/request_permission") { // auto-approve
          const options = (params.options ?? []) as Record<string, unknown>[];
          const allow = options.find((o) => /allow/i.test(String(o.kind ?? o.optionId ?? ""))) ?? options[0];
          return write({ jsonrpc: "2.0", id: mid, result: allow ? { outcome: { outcome: "selected", optionId: allow.optionId } } : { outcome: { outcome: "cancelled" } } });
        }
        return write({ jsonrpc: "2.0", id: mid, result: {} }); // unknown request → empty result so it proceeds
      }
    }

    child.stdout.on("data", (d) => {
      buf += d.toString();
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
        if (!line.startsWith("{")) continue;
        try { onMessage(JSON.parse(line) as Record<string, unknown>); } catch { /* skip partial/non-JSON */ }
      }
    });
    child.stderr.on("data", (d) => { stderr += d.toString(); });
    child.stdin.on("error", () => {});
    child.on("error", (e) => finish(false, String(e)));
    child.on("close", () => finish(!!text.trim(), stderr.trim().slice(-300) || "grok exited before replying"));

    void (async () => {
      try {
        const init = await rpc("initialize", { protocolVersion: 1, clientCapabilities: { fs: { readTextFile: true, writeTextFile: true } } });
        if (init.error) return finish(false, "initialize: " + rpcErr(init));
        const authMethods = ((init.result as Record<string, unknown> | undefined)?.authMethods ?? []) as Record<string, unknown>[];
        if (authMethods.length) {
          const methodId = (authMethods.find((a) => /api.?key/i.test(String(a.id ?? "")))?.id ?? authMethods[0].id) as string;
          await rpc("authenticate", { methodId, _meta: { headless: true } }).catch(() => ({})); // best-effort (may already be signed in)
        }
        const ns = await rpc("session/new", { cwd, mcpServers: [] });
        if (ns.error) return finish(false, "session/new: " + rpcErr(ns));
        const sessionId = (ns.result as Record<string, unknown> | undefined)?.sessionId as string | undefined;
        if (!sessionId) return finish(false, "no sessionId from grok");
        const pr = await rpc("session/prompt", { sessionId, prompt: [{ type: "text", text: prompt }] });
        if (pr.error) return finish(false, "prompt: " + rpcErr(pr));
        finish(true); // session/prompt resolved with a stopReason → the turn is complete
      } catch (e) { finish(false, String(e)); }
    })();
  });
}

/**
 * Live model list for a CLI binary that exposes one (real — runs the CLI's list command). Returns
 * provider/model (or bare) ids, or [] when the CLI has no clean list (cursor/cline/kilo/copilot →
 * those fall back to models.dev / the static options). Never throws.
 */
export async function cliModels(binary: CliBinary): Promise<string[]> {
  try {
    if (binary === "opencode") {
      // `opencode models` prints one `provider/model` per line.
      const r = await runProc("opencode", ["models"], "", process.cwd(), 20_000);
      if (r.code !== 0) return [];
      return r.stdout.split("\n").map((l) => l.trim()).filter((l) => /^[\w.-]+\/[\w./:-]+$/.test(l)).slice(0, 200);
    }
    if (binary === "aider") {
      // `aider --list-models <q>` needs a query; "/" matches the provider-prefixed ids it prints.
      const r = await runProc("aider", ["--list-models", "/"], "", process.cwd(), 25_000);
      if (r.code !== 0) return [];
      return r.stdout.split("\n").map((l) => l.replace(/^[-*\s]+/, "").trim())
        .filter((l) => /^[\w.-]+\/[\w./:-]+$/.test(l)).slice(0, 200);
    }
  } catch { /* honest empty */ }
  return [];
}

/**
 * Run an arbitrary local tool (git, gh, …) inside a directory. Honest result, never
 * throws; pass `env` to inject e.g. GH_TOKEN for `gh` without persisting it anywhere.
 */
export async function runCommand(cmd: string, args: string[], opts: { cwd: string; input?: string; timeoutMs?: number; env?: Record<string, string> }): Promise<ProcResult> {
  // shell:false — git/gh are real executables (resolved via PATHEXT); never route their
  // (often client-influenced: branch/message/diff-path) args through a shell.
  return runProc(cmd, args, opts.input ?? "", opts.cwd, opts.timeoutMs ?? 60_000, opts.env ? { ...process.env, ...opts.env } : undefined, undefined, false);
}

/** Real availability check for a CLI binary (e.g. `claude --version`). */
export async function cliVersion(binary: CliBinary): Promise<string | null> {
  const r = await runProc(binary, ["--version"], "", process.cwd(), 15_000);
  if (r.code === -1) return null; // spawn error (ENOENT) is the ONLY "not installed" signal — some CLIs print
  // their version to stderr and/or exit non-zero, so any clean spawn (even a non-zero exit) means it exists.
  return (r.stdout || r.stderr).trim().split("\n")[0] || "ok";
}

export type AuthState = "ready" | "needs_login" | "needs_key" | "unknown";

/** The command/action that authenticates each CLI (shown in the UI when auth isn't detected). */
export const LOGIN_HINTS: Record<CliBinary, string> = {
  claude: "sign in to Claude Code", codex: "codex login",
  openclaw: "openclaw infer model auth login", hermes: "hermes model",
  aider: "set OPENAI_API_KEY / ANTHROPIC_API_KEY env", opencode: "opencode auth login",
  copilot: "copilot → /login", "cursor-agent": "cursor-agent login",
  cline: "configure cline providers", kilocode: "configure kilocode providers",
  grok: "run `grok` to sign in (SuperGrok / X Premium+), or set GROK_CODE_XAI_API_KEY",
};

/**
 * Best-effort auth detection for a CLI brain. Heuristic + honest: a real probe where cheap
 * (`opencode auth list`), an env-key check (aider), else the presence of the CLI's auth/config
 * file. Returns "unknown" when it genuinely can't tell (never fabricates "ready"). Bounded; never throws.
 */
export async function detectCliAuth(binary: CliBinary): Promise<AuthState> {
  const home = homedir();
  const has = (...rel: string[]) => rel.some((r) => existsSync(join(home, r)));
  try {
    switch (binary) {
      case "claude": return has(".claude/.credentials.json", ".claude.json", ".config/claude") ? "ready" : "needs_login";
      case "codex": return has(".codex/auth.json", ".codex") ? "ready" : "needs_login";
      case "aider":
        return (process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.DEEPSEEK_API_KEY
          || process.env.GEMINI_API_KEY || process.env.OPENROUTER_API_KEY || process.env.GROQ_API_KEY) ? "ready" : "needs_login";
      case "opencode": {
        const r = await runProc("opencode", ["auth", "list"], "", process.cwd(), 8_000);
        if (r.code === 0 && /\w/.test(r.stdout) && !/\b(no|none|not)\b.*(auth|provider|credential|logged)/i.test(r.stdout)) return "ready";
        return has(".local/share/opencode/auth.json", ".config/opencode") ? "ready" : "needs_login";
      }
      case "copilot": return has(".config/github-copilot/apps.json", ".config/github-copilot", ".copilot") ? "ready" : "needs_login";
      case "cursor-agent": return has(".config/cursor-agent", ".cursor-agent", ".cursor") ? "ready" : "needs_login";
      case "grok":
        return (process.env.GROK_CODE_XAI_API_KEY || process.env.XAI_API_KEY) ? "ready"
          : has(".grok", ".config/grok") ? "ready" : "needs_login";
      case "openclaw": return has(".openclaw", ".config/openclaw") ? "ready" : "unknown";
      case "hermes": return has(".hermes", ".config/hermes") ? "ready" : "unknown";
      case "cline": return has(".cline", ".config/cline") ? "ready" : "unknown";
      case "kilocode": return has(".kilocode", ".config/kilocode") ? "ready" : "unknown";
    }
  } catch { /* fall through */ }
  return "unknown";
}

/** Fixed model lists the local CLIs expose (real — set by the installed CLI/subscription). For the
 *  provider-routed CLIs, `(default)` means "use whatever the CLI is configured with" (omit --model). */
export const CLI_MODELS: Record<string, string[]> = {
  cli_claude_code: ["opus", "sonnet", "haiku", "fable"],
  cli_codex: ["gpt-5-codex", "gpt-5", "o3", "o4-mini"],
  cli_aider: ["(default)", "anthropic/claude-sonnet-4-6", "openai/gpt-5.2", "deepseek/deepseek-chat"],
  cli_opencode: ["(default)", "anthropic/claude-sonnet-4-6", "openai/gpt-5.2"],
  cli_copilot: ["(default)", "claude-sonnet-4.5", "gpt-5"],
  cli_cursor: ["(default)", "claude-4.5-sonnet", "gpt-5"],
  cli_cline: ["(default)"],
  cli_kilo: ["(default)"],
  cli_grok: ["(default)", "grok-code-fast-1", "grok-4.5", "grok-build-0.1"],
};

/**
 * Validate an adapter + model against the CLI allowlist before persisting an agent. `pickBinary` silently
 * falls back to `claude` for an unknown adapter, so without this an arbitrary `adapter` could be stored
 * (and later spawned). `safeModelSlash` already defends the model arg against injection; this adds the
 * allowlist gate the "Hire Agent" UI relies on. `"(default)"` is always allowed (the CLI uses its own).
 */
export function validateAdapterModel(adapter: string, model: string): { ok: boolean; error?: string } {
  const models = CLI_MODELS[adapter];
  // Reject an unknown adapter that isn't a recognized cli_* (pickBinary silently falls back to claude).
  if (!models && !adapter.startsWith("cli_")) return { ok: false, error: `Unknown adapter "${adapter}".` };
  if (model === "(default)" || models?.includes(model)) return { ok: true };
  // The dropdowns now serve REAL ids fetched live from the binary, so the curated allowlist can't enumerate
  // them — accept any safe id (safeModelSlash still guards the model arg against shell injection at argv).
  if (/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,79}$/.test(model)) return { ok: true };
  return { ok: false, error: `Invalid model id "${model}".` };
}

/** Pick the execution binary for an agent given its provider adapter / model id. */
export function pickBinary(adapter?: string | null, model?: string | null): CliBinary {
  if (adapter === "cli_codex" || adapter === "cli_codex_cli") return "codex";
  if (adapter === "cli_openclaw") return "openclaw";
  if (adapter === "cli_hermes") return "hermes";
  if (adapter === "cli_aider") return "aider";
  if (adapter === "cli_opencode") return "opencode";
  if (adapter === "cli_copilot" || adapter === "cli_copilot_cli") return "copilot";
  if (adapter === "cli_cursor" || adapter === "cli_cursor_cli") return "cursor-agent";
  if (adapter === "cli_cline" || adapter === "cli_cline_cli") return "cline";
  if (adapter === "cli_kilo" || adapter === "cli_kilo_code") return "kilocode";
  if (adapter === "cli_grok" || adapter === "cli_grok_build") return "grok";
  if (adapter === "cli_claude_code") return "claude";
  const m = (model ?? "").toLowerCase();
  if (m.startsWith("codex") || m.startsWith("gpt") || m.startsWith("o1") || m.startsWith("o3") || m.startsWith("o4")) return "codex";
  return "claude";
}

/** The strongest / most-capable model for an agent's PROVIDER — used where quality matters most
 *  (code review, security, final validation). The reviewer should default to the best model of its
 *  selected provider, not whatever cheap tier it's configured with. */
export function strongestModelFor(adapter?: string | null): string | undefined {
  const binary = pickBinary(adapter);
  if (binary === "claude") return "opus";
  if (binary === "codex") return undefined; // codex ignores --model; it uses its own strongest default
  const list = CLI_MODELS[adapter ?? ""] ?? [];
  return list.find((m) => m !== "(default)"); // first real (strongest) entry for provider-routed CLIs
}

/** Dispatch a prompt to the right CLI for an agent. */
export async function runAgent(prompt: string, opts: { orgId: string; binary?: CliBinary; model?: string; timeoutMs?: number; token?: string; agentId?: string; agentHandle?: string }): Promise<CliResult> {
  const binary = opts.binary ?? "claude";
  const a = { model: opts.model, orgId: opts.orgId, timeoutMs: opts.timeoutMs, token: opts.token, agentId: opts.agentId, agentHandle: opts.agentHandle };
  if (binary === "codex") return runCodex(prompt, a);
  if (binary === "openclaw") return runOpenClaw(prompt, a);
  if (binary === "hermes") return runHermes(prompt, a);
  if (binary === "aider") return runAider(prompt, a);
  if (binary === "opencode") return runOpenCode(prompt, a);
  if (binary === "copilot") return runCopilot(prompt, a);
  if (binary === "cursor-agent") return runCursor(prompt, a);
  if (binary === "cline") return runCline(prompt, a);
  if (binary === "kilocode") return runKilo(prompt, a);
  if (binary === "grok") return runGrok(prompt, a);
  return runClaude(prompt, a);
}

/* ----------------------------------------------------------------- streaming */
export type StreamEvent = { kind: "read" | "create" | "edit" | "run" | "search" | "thinking" | "text" | "done"; target?: string; detail?: string };

function mapTool(name: string, input: Record<string, unknown>): StreamEvent {
  const s = (v: unknown) => String(v ?? "");
  if (name === "Read") return { kind: "read", target: s(input.file_path) };
  if (name === "Write") return { kind: "create", target: s(input.file_path), detail: s(input.content).slice(0, 4000) };
  if (name === "Edit" || name === "NotebookEdit") {
    // Real diff payload: the exact lines the agent removed (−) then added (+), so the
    // Team Room work-card can render a true diff-view (not fabricated). Bounded to 80 lines.
    const oldL = s(input.old_string).split("\n");
    const newL = s(input.new_string).split("\n");
    const diff = [...oldL.map((l) => "-" + l), ...newL.map((l) => "+" + l)].slice(0, 80).join("\n");
    return { kind: "edit", target: s(input.file_path), detail: diff };
  }
  if (name === "Bash" || name === "PowerShell") return { kind: "run", target: s(input.command).slice(0, 200) };
  if (name === "Glob" || name === "Grep") return { kind: "search", target: s(input.pattern) };
  return { kind: "read", target: name };
}

/**
 * Stream a Claude Code run, emitting an event per tool_use as it happens (verified
 * stream-json schema). Returns the same CliResult as runClaude when finished.
 */
export async function runClaudeStream(prompt: string, opts: { model?: string; orgId: string; timeoutMs?: number; token?: string; agentId?: string; agentHandle?: string }, onEvent: (e: StreamEvent) => void): Promise<CliResult> {
  const cwd = orgRoot(opts.orgId);
  mkdirSync(cwd, { recursive: true });
  const model = safeModel(opts.model);
  // `--include-partial-messages` makes Claude emit token-level `content_block_delta`
  // events → we stream the reply as it's typed (debounced), not one block at a time.
  const agentDir = (lockHookOn() || guardHookOn()) ? agentClaudeDir() : null; // resolve ONCE per spawn
  const args = ["-p", "--output-format", "stream-json", "--include-partial-messages", "--verbose", ...claudeSettingsArgs(agentDir), ...claudePermArgs(), ...claudeWebArgs()];
  if (model) args.push("--model", model);
  return new Promise((resolve) => {
    const start = Date.now();
    // detached only on POSIX (see runProc): on Windows it flashes a console + breaks stdin.
    const child = spawn("claude", args, { cwd, shell: IS_WIN, windowsHide: true, env: claudeEnv(opts, agentDir), detached: !IS_WIN && !!opts.token });
    registerChild(opts.token, child);
    let buf = "", text = "", usd = 0, inTok = 0, outTok = 0, ok = false, error: string | undefined, subtype: string | undefined;
    // Live-text accumulator. We emit DELTAS (only the new chars since the last emit),
    // not the cumulative reply — persisting the cumulative prefix every 40 chars was
    // O(N²) DB writes. Debounced to ~120 chars; the dock concatenates the deltas.
    let streamBuf = "", lastEmitLen = 0, gotDelta = false;
    const flushText = () => { if (streamBuf.length > lastEmitLen) { onEvent({ kind: "text", detail: streamBuf.slice(lastEmitLen, lastEmitLen + 8000) }); lastEmitLen = streamBuf.length; } };
    const timer = setTimeout(() => killTree(child), opts.timeoutMs ?? 240_000);

    function handle(ev: Record<string, unknown>) {
      if (ev.type === "stream_event") {
        const se = ev.event as { type?: string; delta?: { type?: string; text?: string }; content_block?: { type?: string } } | undefined;
        if (se?.type === "content_block_start" && se.content_block?.type === "text" && streamBuf) streamBuf += "\n\n";
        else if (se?.type === "content_block_delta" && se.delta?.type === "text_delta" && se.delta.text) {
          gotDelta = true;
          streamBuf += se.delta.text;
          if (streamBuf.length - lastEmitLen >= 120) flushText(); // debounced live emit (delta)
        }
      } else if (ev.type === "assistant") {
        const content = (ev.message as { content?: { type: string; text?: string; name?: string; input?: Record<string, unknown>; thinking?: string }[] })?.content ?? [];
        for (const c of content) {
          if (c.type === "tool_use" && c.name) onEvent(mapTool(c.name, c.input ?? {}));
          // Final text of this block. If partial-message deltas are streaming, they
          // already drove the live bubble; otherwise (flag unsupported) emit the whole
          // block once as a fallback so the reply still appears progressively.
          else if (c.type === "text" && c.text) { text = c.text; if (!gotDelta) onEvent({ kind: "text", detail: c.text.slice(0, 8000) }); }
          else if (c.type === "thinking" && c.thinking) onEvent({ kind: "thinking", detail: c.thinking.slice(0, 200) });
        }
        flushText();
      } else if (ev.type === "result") {
        ok = ev.is_error !== true && ev.subtype === "success";
        if (typeof ev.subtype === "string") subtype = ev.subtype;
        if (typeof ev.result === "string") text = ev.result;
        usd = Number(ev.total_cost_usd ?? 0);
        const u = (ev.usage ?? {}) as Record<string, number>;
        inTok = Number(u.input_tokens ?? 0) + Number(u.cache_read_input_tokens ?? 0) + Number(u.cache_creation_input_tokens ?? 0);
        outTok = Number(u.output_tokens ?? 0);
        if (ev.is_error) error = String(ev.result ?? "error");
      }
    }

    child.stdout.on("data", (d) => {
      buf += d.toString();
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
        if (!line.startsWith("{")) continue;
        try { handle(JSON.parse(line)); } catch { /* skip partial/non-JSON */ }
      }
    });
    const wasCancelled = () => (opts.token ? isAbortRequested(opts.token) || ACTIVE.get(opts.token)?.child === child && ACTIVE.get(opts.token)?.cancelled === true : false);
    const cancelPoll = startCancelPoll(opts.token, child);
    const fin = () => { if (cancelPoll) clearInterval(cancelPoll); unregisterChild(opts.token); };
    child.on("error", (e) => {
      clearTimeout(timer);
      const cancelled = wasCancelled();
      fin();
      resolve(base("claude", opts.model, Date.now() - start, cancelled ? "stopped by operator" : String(e), cancelled));
    });
    child.on("close", () => {
      clearTimeout(timer);
      const cancelled = wasCancelled();
      fin();
      onEvent({ kind: "done" });
      resolve({ ok, text, usd, inputTokens: inTok, outputTokens: outTok, durationMs: Date.now() - start, binary: "claude", model: opts.model, error: cancelled ? "stopped by operator" : error, cancelled, subtype });
    });
    child.stdin.on("error", () => {});
    try { child.stdin.write(prompt); child.stdin.end(); } catch { /* close/error resolves the run */ }
  });
}

// Backoff schedule for transient provider failures (rate limit / quota / overloaded / network). 1min · 5min · 15min.
const AGENT_RETRY_BACKOFF_MS = [60_000, 300_000, 900_000];
const agentSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Provider-side TRANSIENT failures worth retrying (rate limit, quota, overloaded, 5xx, network). NOT a process
 *  timeout / operator cancellation - those are long tasks or operator cancellations and must never auto-retry. */
export function isRetryableAgentError(err?: string): boolean {
  if (!err) return false;
  return /(\b429\b|overloaded|rate[\s_-]?limit|usage limit|\bquota\b|too many requests|service unavailable|\b50[0-3]\b|\bupstream\b|fetch failed|network error|econnreset|enotfound|etimedout|econnrefused|socket hang up)/i.test(err);
}

/** Stream a run with automatic retry on transient provider failures: instead of dying on a 429 / quota / network
 *  blip, it waits (1→5→15 min) and re-runs, surfacing a "retrying…" status on the live stream. A non-retryable
 *  error or a success returns immediately; operator cancellations never retry. */
export async function runAgentStream(prompt: string, opts: { orgId: string; binary?: CliBinary; model?: string; timeoutMs?: number; token?: string; agentId?: string; agentHandle?: string; effort?: Effort }, onEvent: (e: StreamEvent) => void): Promise<CliResult> {
  let last: CliResult | null = null;
  for (let attempt = 0; attempt <= AGENT_RETRY_BACKOFF_MS.length; attempt++) {
    const r = await runAgentStreamOnce(prompt, opts, onEvent);
    if (r.cancelled || r.ok || !isRetryableAgentError(r.error)) return r; // an operator Stop never retries
    last = r;
    if (attempt < AGENT_RETRY_BACKOFF_MS.length) {
      const waitMs = AGENT_RETRY_BACKOFF_MS[attempt];
      onEvent({ kind: "thinking", target: `Provider limit / network — retrying in ${Math.round(waitMs / 60_000)} min (attempt ${attempt + 2}/${AGENT_RETRY_BACKOFF_MS.length + 1})…`, detail: (r.error || "").slice(0, 160) });
      await agentSleep(waitMs);
    }
  }
  return last!;
}

/** One streamed run (no retry). Stream when on Claude; fall back to a single non-streamed run otherwise.
 *  `token` (= taskId/runId) registers the child so Stop can interrupt it mid-flight. */
async function runAgentStreamOnce(prompt: string, opts: { orgId: string; binary?: CliBinary; model?: string; timeoutMs?: number; token?: string; agentId?: string; agentHandle?: string; effort?: Effort }, onEvent: (e: StreamEvent) => void): Promise<CliResult> {
  const binary = opts.binary ?? "claude";
  if (binary === "claude") return runClaudeStream(prompt, { model: opts.model, orgId: opts.orgId, timeoutMs: opts.timeoutMs, token: opts.token, agentId: opts.agentId, agentHandle: opts.agentHandle }, onEvent);
  const a = { model: opts.model, orgId: opts.orgId, timeoutMs: opts.timeoutMs, token: opts.token, effort: opts.effort };
  const r = binary === "openclaw" ? await runOpenClaw(prompt, a)
    : binary === "hermes" ? await runHermes(prompt, a)
    : binary === "aider" ? await runAider(prompt, a)
    : binary === "opencode" ? await runOpenCode(prompt, a)
    : binary === "copilot" ? await runCopilot(prompt, a)
    : binary === "cursor-agent" ? await runCursor(prompt, a)
    : binary === "cline" ? await runCline(prompt, a)
    : binary === "kilocode" ? await runKilo(prompt, a)
    : binary === "grok" ? await runGrok(prompt, a)
    : await runCodex(prompt, a);
  onEvent({ kind: "done" });
  return r;
}
