import "server-only";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createServer } from "node:net";
import { orgRoot } from "@/lib/fs-workspace";
import { stopInspectProxy, stopAllInspectProxies } from "@/server/design/live-inspect-proxy";

/**
 * Manages the PROJECT's own dev server (the app the agents are building) so Test Dev can boot it,
 * watch its console, and drive it with Playwright. One server per workspace, tracked in-memory.
 * Long-lived child process — process-tree killed on stop. NOT the Constella server.
 */

const IS_WIN = process.platform === "win32";
const LOG_CAP = 400;

export type ProjectKind = "node" | "python" | "go" | "rust" | "static";
export type DevServer = {
  proc: ChildProcess;
  port: number;
  url: string;
  status: "starting" | "running" | "stopped" | "error";
  dir: string;
  kind: ProjectKind;
  label: string;     // e.g. "npm run dev", "uvicorn", "go run"
  logs: { c: "out" | "err" | "info"; t: string }[];
  startedAt: number;
};

const SERVERS = new Map<string, DevServer>(); // workspaceId → server

/** A runnable project: how to install (optional) + run it, generalized across ecosystems. `runArgs`
 *  may contain a literal "$PORT" sentinel that startProjectServer replaces with the chosen port. */
export type ProjectInfo = {
  dir: string;
  kind: ProjectKind;
  name: string;
  label: string;
  install?: { cmd: string; args: string[] };
  runCmd: string;
  runArgs: string[];
};

/** Find a runnable project under the workspace, at the root or a common subdir. Supports Node
 *  (package.json + dev/start/serve), Python (FastAPI/Django/Flask/main.py), Go (go.mod) and Rust
 *  (Cargo.toml). Node always wins when more than one ecosystem is present. */
export function detectProject(orgId: string): ProjectInfo | null {
  const root = orgRoot(orgId);
  const candidates: string[] = [root];
  for (const sub of ["packages", "apps", "app", "web", "client", "frontend", "backend", "server", "api"]) {
    const p = join(root, sub);
    if (existsSync(p)) {
      try { for (const d of readdirSync(p, { withFileTypes: true })) if (d.isDirectory()) candidates.push(join(p, d.name)); } catch { /* skip */ }
    }
  }
  const PORT = "$PORT";
  // First pass: Node wins everywhere it exists.
  for (const dir of candidates) {
    const node = detectNode(dir);
    if (node) return node;
  }
  // Second pass: other ecosystems.
  for (const dir of candidates) {
    const has = (f: string) => existsSync(join(dir, f));
    const name = dir.split(/[\\/]/).pop() || "project";
    const pyInstall = has("requirements.txt") ? { cmd: "python", args: ["-m", "pip", "install", "-r", "requirements.txt"] } : undefined;
    if (has("manage.py")) return { dir, kind: "python", name, label: "django runserver", install: pyInstall, runCmd: "python", runArgs: ["manage.py", "runserver", `127.0.0.1:${PORT}`] };
    if (has("main.py")) {
      let body = ""; try { body = readFileSync(join(dir, "main.py"), "utf8"); } catch { /* skip */ }
      if (/FastAPI\s*\(/.test(body)) return { dir, kind: "python", name, label: "uvicorn", install: pyInstall, runCmd: "python", runArgs: ["-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", PORT] };
      return { dir, kind: "python", name, label: "python main.py", install: pyInstall, runCmd: "python", runArgs: ["main.py"] }; // the file reads PORT env
    }
    if (has("go.mod")) return { dir, kind: "go", name, label: "go run", runCmd: "go", runArgs: ["run", "."] };
    if (has("Cargo.toml")) return { dir, kind: "rust", name, label: "cargo run", runCmd: "cargo", runArgs: ["run"] };
    if (has("server.js")) return { dir, kind: "static", name, label: "node server.js", runCmd: "node", runArgs: ["server.js"] };
  }
  return null;
}

/** Node detection (package.json + a dev/start/serve script). Behavior identical to before. */
function detectNode(dir: string): ProjectInfo | null {
  const pkgPath = join(dir, "package.json");
  if (!existsSync(pkgPath)) return null;
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    const scripts = pkg.scripts ?? {};
    const script = scripts.dev ? "dev" : scripts.start ? "start" : scripts.serve ? "serve" : null;
    if (!script) return null;
    const pm: "pnpm" | "npm" | "yarn" = existsSync(join(dir, "pnpm-lock.yaml")) ? "pnpm" : existsSync(join(dir, "yarn.lock")) ? "yarn" : "npm";
    const runArgs = pm === "npm" ? ["run", script] : [script];
    const installNeeded = !existsSync(join(dir, "node_modules"));
    return {
      dir, kind: "node", name: pkg.name ?? "project", label: `${pm} ${script}`,
      install: installNeeded ? { cmd: pm, args: ["install"] } : undefined,
      runCmd: pm, runArgs,
    };
  } catch { return null; }
}

const toolProbe = new Map<string, { ok: boolean; at: number }>();
/** Best-effort check that a toolchain binary exists (cached 60s). Avoids a 30s boot wait + a
 *  confusing failure when python/go/cargo isn't installed for a non-Node starter. */
async function toolAvailable(cmd: string): Promise<boolean> {
  const cached = toolProbe.get(cmd);
  if (cached && Date.now() - cached.at < 60_000) return cached.ok;
  const ok = await new Promise<boolean>((resolve) => {
    try {
      const p = spawn(cmd, ["--version"], { shell: IS_WIN, windowsHide: true });
      let done = false; const fin = (v: boolean) => { if (!done) { done = true; resolve(v); } };
      // The binary EXISTING is the signal — not the exit code of `--version` (some toolchains print to stderr
      // and/or exit non-zero). ENOENT fires 'error' (→ not installed); any clean spawn (or a slow one we time
      // out) means it's present.
      p.on("error", () => fin(false));
      p.on("close", () => fin(true));
      setTimeout(() => { try { p.kill(); } catch {} fin(true); }, 8000);
    } catch { resolve(false); }
  });
  toolProbe.set(cmd, { ok, at: Date.now() });
  return ok;
}

/** Find a free TCP port in a range that avoids Constella's own :3000. */
function freePort(start = 4173, end = 4999): Promise<number> {
  return new Promise((resolve, reject) => {
    const tryPort = (p: number) => {
      if (p > end) return reject(new Error("no free port"));
      const srv = createServer();
      srv.once("error", () => tryPort(p + 1));
      srv.once("listening", () => srv.close(() => resolve(p)));
      srv.listen(p, "127.0.0.1");
    };
    tryPort(start);
  });
}

function push(s: DevServer, c: "out" | "err" | "info", t: string) {
  for (const line of t.split(/\r?\n/)) {
    const v = line.trimEnd();
    if (!v) continue;
    s.logs.push({ c, t: v });
    // ready detection: a dev server printing a localhost URL / "ready" / "listening"
    if (s.status === "starting" && /(ready|listening|localhost:|started server|compiled)/i.test(v)) s.status = "running";
  }
  if (s.logs.length > LOG_CAP) s.logs.splice(0, s.logs.length - LOG_CAP);
}

/** Start (or return) the project dev server for a workspace. Installs deps if needed. Supports
 *  Node/Python/Go/Rust; non-Node boots fail gracefully (clear message) when the toolchain is
 *  missing. Returns the live status. */
const BOOTING = new Map<string, Promise<DevServerStatus>>();
export async function startProjectServer(workspaceId: string, orgId: string): Promise<DevServerStatus> {
  const existing = SERVERS.get(workspaceId);
  if (existing && existing.status !== "stopped" && existing.status !== "error" && !existing.proc.killed) return statusOf(existing);
  // In-flight boot lock — a synchronous claim (no await between get() and set()) so two concurrent callers
  // (e.g. a boot gate + the Test Dev button) await the SAME boot instead of both spawning a child, orphaning
  // the first server + its port.
  const inflight = BOOTING.get(workspaceId);
  if (inflight) return inflight;
  const boot = bootProjectServer(workspaceId, orgId);
  BOOTING.set(workspaceId, boot);
  try { return await boot; } finally { BOOTING.delete(workspaceId); }
}

async function bootProjectServer(workspaceId: string, orgId: string): Promise<DevServerStatus> {
  const project = detectProject(orgId);
  if (!project) return { running: false, status: "error", logs: [{ c: "err", t: "No runnable project found (no package.json with a dev/start script, or a Python/Go/Rust project, under the workspace)." }] };

  // Toolchain pre-flight for non-Node kinds — fail fast + clearly instead of a 30s dead wait.
  if (project.kind !== "node" && project.kind !== "static") {
    if (!(await toolAvailable(project.runCmd))) {
      return { running: false, status: "error", port: undefined, url: undefined, project: project.label, logs: [{ c: "err", t: `Toolchain not found: '${project.runCmd}' is not installed or not on PATH. This ${project.kind} starter needs it to boot — install ${project.kind} (or pick a Node stack).` }] };
    }
  }

  let port: number;
  try { port = await freePort(); } catch { return { running: false, status: "error", logs: [{ c: "err", t: "No free port available." }] }; }

  const env = { ...process.env, PORT: String(port), BROWSER: "none", NODE_ENV: "development" } as NodeJS.ProcessEnv;
  const runArgs = project.runArgs.map((a) => a.includes("$PORT") ? a.replace("$PORT", String(port)) : a);

  const server: DevServer = {
    proc: null as unknown as ChildProcess, port, url: `http://127.0.0.1:${port}`, status: "starting",
    dir: project.dir, kind: project.kind, label: project.label, logs: [], startedAt: Date.now(),
  };
  push(server, "info", `project: ${project.name} · ${project.label} · :${port}`);

  const launch = () => {
    // detached on POSIX → the child is its own process-group LEADER, so stopProjectServer's
    // `process.kill(-pid)` signals the whole tree (the dev server + the grandchildren it forks). Without it
    // there is no group with id==pid and the real server (a grandchild) is orphaned, leaking the port. On
    // Windows we kill the tree with `taskkill /T` instead, so detached (a new console) is not used.
    const proc = spawn(project.runCmd, runArgs, { cwd: project.dir, env, shell: IS_WIN, windowsHide: true, detached: !IS_WIN });
    server.proc = proc;
    proc.stdout?.on("data", (d) => push(server, "out", d.toString()));
    proc.stderr?.on("data", (d) => push(server, "err", d.toString()));
    proc.on("error", (e) => {
      server.status = "error";
      const enoent = /ENOENT/.test(String(e));
      push(server, "err", enoent ? `'${project.runCmd}' not found — install the ${project.kind} toolchain or pick a Node stack.` : "spawn failed: " + String(e instanceof Error ? e.message : e));
    });
    proc.on("close", (code) => { if (server.status !== "stopped") { server.status = code === 0 ? "stopped" : "error"; push(server, "info", `process exited (${code})`); } });
    SERVERS.set(workspaceId, server);
  };

  // Install step (gated by kind): node → if node_modules missing; python → if requirements + no marker.
  const pyMarker = join(project.dir, ".constella-pyinstalled");
  const doInstall = project.install && (
    project.kind === "node" ? true /* detectNode only sets install when node_modules missing */ :
    project.kind === "python" ? !existsSync(pyMarker) : false);
  if (project.install && doInstall) {
    push(server, "info", `$ ${project.install.cmd} ${project.install.args.join(" ")}`);
    SERVERS.set(workspaceId, server);
    const inst = spawn(project.install.cmd, project.install.args, { cwd: project.dir, env, shell: IS_WIN, windowsHide: true });
    inst.stdout?.on("data", (d) => push(server, "out", d.toString()));
    inst.stderr?.on("data", (d) => push(server, "err", d.toString()));
    const code = await new Promise<number | null>((r) => { inst.on("close", r); inst.on("error", () => r(-1)); });
    if (project.kind === "python" && code === 0) { try { writeFileSync(pyMarker, "ok"); } catch { /* ignore */ } }
  }
  launch();

  // Wait until the port answers (or timeout). Non-Node first boot (go/rust compile) gets longer.
  const deadline = project.kind === "go" || project.kind === "rust" ? 120_000 : project.kind === "python" ? 60_000 : 30_000;
  await waitReachable(server.url, deadline).then((ok) => { if (ok && server.status === "starting") server.status = "running"; });
  return statusOf(server);
}

/**
 * Boot gate: the project MUST still boot. Cheap when a server is already live (a 3s reachability
 * ping); else (re)starts it (installs once, kept alive in SERVERS). Toolchain-missing → ok:true
 * ("can't validate, don't punish"); only ok:false on a DEFINITE failed boot.
 */
export async function ensureBootable(workspaceId: string, orgId: string): Promise<{ ok: boolean; detail: string }> {
  if (!detectProject(orgId)) return { ok: true, detail: "no runnable project to gate" };
  const live = serverStatus(workspaceId);
  if (live.status === "running" && live.url && await waitReachable(live.url, 3000)) return { ok: true, detail: "dev server still reachable" };
  if (live.status === "error" || live.status === "stopped") await stopProjectServer(workspaceId);
  const s = await startProjectServer(workspaceId, orgId);
  if ((s.status === "running" || s.status === "starting") && s.url && await waitReachable(s.url, 6000)) return { ok: true, detail: "booted" };
  const log = s.logs.map((l) => l.t).join(" | ");
  if (/Toolchain not found|not found —|not installed/.test(log)) return { ok: true, detail: "toolchain unavailable — boot gate skipped (cannot validate)" };
  return { ok: false, detail: s.logs.slice(-5).map((l) => l.t).join(" | ") || "dev server failed to boot" };
}

/** Stop the project dev server (process tree). */
export async function stopProjectServer(workspaceId: string): Promise<DevServerStatus> {
  const s = SERVERS.get(workspaceId);
  if (!s) return { running: false, status: "stopped", logs: [] };
  s.status = "stopped";
  try {
    if (s.proc?.pid) {
      if (IS_WIN) spawn("taskkill", ["/PID", String(s.proc.pid), "/T", "/F"], { windowsHide: true });
      else process.kill(-s.proc.pid, "SIGKILL"); // negative pid → process group (best-effort)
    }
  } catch { try { s.proc?.kill("SIGKILL"); } catch { /* ignore */ } }
  stopInspectProxy(workspaceId);   // the Live inspect proxy fronts this server — tear it down too
  push(s, "info", "server stopped");
  return statusOf(s);
}

export type DevServerStatus = {
  running: boolean;
  status: "starting" | "running" | "stopped" | "error" | "none";
  port?: number;
  url?: string;
  project?: string;
  logs: { c: "out" | "err" | "info"; t: string }[];
};

function statusOf(s: DevServer): DevServerStatus {
  return { running: s.status === "running" || s.status === "starting", status: s.status, port: s.port, url: s.url, project: s.label, logs: s.logs.slice(-120) };
}

export function serverStatus(workspaceId: string): DevServerStatus {
  const s = SERVERS.get(workspaceId);
  if (!s) return { running: false, status: "none", logs: [] };
  return statusOf(s);
}

/** The live server URL if one is running for this workspace. */
export function serverUrl(workspaceId: string): string | null {
  const s = SERVERS.get(workspaceId);
  return s && (s.status === "running" || s.status === "starting") ? s.url : null;
}

/** Poll a URL until it responds (any HTTP status) or the timeout elapses. */
export async function waitReachable(url: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { await fetch(url, { signal: AbortSignal.timeout(2000) }); return true; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

/** Kill every tracked dev server — called on boot reconcile so a restart leaves none orphaned. */
export function stopAllProjectServers(): void {
  for (const id of SERVERS.keys()) void stopProjectServer(id);
  SERVERS.clear();
  stopAllInspectProxies();
}
