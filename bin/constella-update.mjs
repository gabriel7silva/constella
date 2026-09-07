#!/usr/bin/env node
/**
 * Constella self-updater — a STANDALONE script that stops the running server, installs the latest npm
 * release, and relaunches. It runs as its own process (NOT a child the server can take down with it), so
 * it can kill every node process the server owns, replace the in-use package files, and bring Constella
 * back on the new version. Two callers:
 *
 *   • the in-app "Update now" button → spawns this detached + hidden with `--quiet`;
 *   • `constella update` → runs it inline so you can update by hand from any terminal.
 *
 * Order matters: it INSTALLS FIRST, with the server still running. A live Constella does NOT lock the
 * global package files (verified on Windows — `npm i -g` succeeds with the server up), so installing first
 * just works, and if it can't we haven't taken the host down. Only THEN does it restart the server to load
 * the new code: stop the process tree (the launcher AND its web + worker children — on Windows
 * `process.kill` is an uncatchable terminate that does NOT cascade, so they're killed explicitly by PID,
 * launcher first so its supervisor can't resurrect them) and relaunch. Stopping the server BEFORE npm is
 * what made earlier updates fail ("installs but loops, never lands"); it survives here only as a fallback
 * for a host where a live process really does hold the files. POSIX restarts via a SIGTERM cascade.
 *
 * The running server is discovered from ~/.constella/run.json (written by the launcher) or, failing that,
 * from whoever is LISTENing on the port — so a manual run recovers a stuck instance of ANY version.
 *
 * Manual use:
 *   node bin/constella-update.mjs                 # auto-detect the running server, update, relaunch
 *   node bin/constella-update.mjs --mode start --port 3000
 */
import { spawnSync, spawn, execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir, tmpdir } from "node:os";

const PKG = "constellai";
const WIN = process.platform === "win32";

// CRITICAL: run from a directory OUTSIDE the package being replaced. npm's global install is atomic — it
// RENAMES the existing `…/node_modules/constellai` dir aside before swapping in the new one, and on Windows
// you cannot rename a directory tree that contains the npm process's own current working directory. This
// updater is spawned by the web server, whose cwd is the install dir (`next start` runs with cwd=PKG_ROOT),
// and npm inherits that cwd → `EBUSY: rename …/constellai`. Stepping out to the OS temp dir lets the rename
// succeed even with the server fully up. (The real fix for the "installs but loops" bug — not killing files.)
const SAFE_CWD = tmpdir();
try { process.chdir(SAFE_CWD); } catch { /* keep current cwd if temp is unavailable */ }
const has = (n) => process.argv.includes(n);
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };

const HOME = process.env.CONSTELLA_HOME || arg("--home") || join(homedir(), ".constella");
const RESULT = join(HOME, "backups", "last-update.json");
const PIDFILE = join(HOME, "run.json");
const QUIET = has("--quiet"); // in-app run is detached → no stdout

let state = {};
try { state = JSON.parse(readFileSync(PIDFILE, "utf8")); } catch { /* no pidfile → discover by port */ }
const MODE = arg("--mode") || process.env.CONSTELLA_RUN_MODE || state.mode || "start";
const PORT = String(arg("--port") || process.env.PORT || state.port || "3000");
let LAUNCHER = Number(arg("--pid") || process.env.CONSTELLA_LAUNCHER_PID || state.launcherPid || 0);

const log = (...a) => { if (!QUIET) console.log(...a); };
const sleep = (ms) => {
  try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); return; } catch { /* no SAB → busy-wait */ }
  // Fallback when SharedArrayBuffer is unavailable (sandbox / hardened runtime): a real blocking wait. The old
  // no-op return made the graceful-shutdown loops spin instantly → an immediate SIGKILL that skipped run.json
  // cleanup + the child-kill cascade.
  const end = Date.now() + ms; while (Date.now() < end) { /* block */ }
};
const alive = (p) => { try { process.kill(p, 0); return true; } catch { return false; } };
const psout = (s) => { try { return execFileSync("powershell", ["-NoProfile", "-Command", s], { timeout: 9000, windowsHide: true }).toString(); } catch { return ""; } };
const ints = (s) => s.split(/\r?\n/).map((x) => +x.trim()).filter((n) => n > 0);
function result(o) { try { mkdirSync(join(HOME, "backups"), { recursive: true }); writeFileSync(RESULT, JSON.stringify({ ...o, at: new Date().toISOString() })); } catch { /* best-effort */ } }

// Windows process helpers (no /T anywhere — we kill by explicit PID so we never terminate ourselves).
const winKids = (pid) => ints(psout(`Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq ${pid} } | Select-Object -ExpandProperty ProcessId`));
const winParent = (pid) => ints(psout(`Get-CimInstance Win32_Process -Filter "ProcessId=${pid}" | Select-Object -ExpandProperty ParentProcessId`))[0] || 0;
const winPortPid = (port) => ints(psout(`Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess`))[0] || 0;
function kill(pid) { if (!pid) return; try { if (WIN) execFileSync("taskkill", ["/F", "/PID", String(pid)], { stdio: "ignore", windowsHide: true }); else process.kill(pid, "SIGTERM"); } catch { /* already gone */ } }

/** Stop the running Constella so `npm i -g` can overwrite the package. Returns true if it killed one. */
function stopServer() {
  if (WIN) {
    // Resolve the launcher: an explicit/persisted pid, else derive it from the port listener (web → parent).
    if (!LAUNCHER || !alive(LAUNCHER)) { const web = winPortPid(PORT); if (web) LAUNCHER = winParent(web) || web; }
    if (!LAUNCHER) { log("• No running server found — updating in place."); return false; }
    log(`• Stopping Constella (launcher pid ${LAUNCHER})…`);
    const kids = winKids(LAUNCHER); // web + worker — capture BEFORE the launcher dies
    kill(LAUNCHER);                 // launcher first → its supervisor can't auto-restart the children
    for (const k of kids) kill(k);  // then the orphaned web + worker (release the native SQLite lock)
    const stale = winPortPid(PORT); if (stale) kill(stale); // belt + suspenders: free the port no matter what
    return true;
  }
  if (!LAUNCHER) { try { LAUNCHER = ints(execFileSync("sh", ["-c", `lsof -ti tcp:${PORT} 2>/dev/null || true`], { timeout: 8000 }).toString())[0] || 0; } catch { /* no lsof */ } }
  if (!LAUNCHER) { log("• No running server found — updating in place."); return false; }
  log(`• Stopping Constella (pid ${LAUNCHER})…`);
  try { process.kill(LAUNCHER, "SIGTERM"); } catch { /* gone */ } // launcher shutdown() cascades on POSIX
  for (let i = 0; i < 300 && alive(LAUNCHER); i++) sleep(100);    // wait up to ~30s for a graceful exit
  if (alive(LAUNCHER)) { try { process.kill(LAUNCHER, "SIGKILL"); } catch { /* gone */ } }
  return true;
}

function update() {
  // Install the EXACT version when known (--version), else @latest. Pinning the resolved version dodges a
  // CDN-lagged npm `latest` tag that briefly serves an older build than the one being offered.
  const target = `${PKG}@${arg("--version") || "latest"}`;
  // cwd: SAFE_CWD is the fix — never run npm from inside the dir it's about to rename (EBUSY on Windows).
  const opt = { stdio: QUIET ? "ignore" : "inherit", shell: true, windowsHide: true, cwd: SAFE_CWD };
  for (let i = 0; i < 4; i++) {
    log(`• npm install -g ${target}  (attempt ${i + 1}/4)…`);
    const r = spawnSync("npm", ["install", "-g", target], opt);
    if (r.status === 0) return true;
    sleep(3000); // transient hiccup — back off and retry
  }
  return false;
}

function relaunch() {
  log(`• Relaunching: constella --${MODE}`);
  try { spawn("constella", ["--" + MODE], { detached: true, stdio: "ignore", shell: true, windowsHide: true, env: { ...process.env, CONSTELLA_HOME: HOME } }).unref(); } catch { /* user can start it by hand */ }
}

// ── VPS path ─────────────────────────────────────────────────────────────────────────────────────────────
// A VPS runs under systemd as a non-root service user, so it CANNOT touch the root-owned global package or
// `systemctl` on its own. The installer (vps-install.sh) drops a tightly-scoped /etc/sudoers.d/constella that
// grants NOPASSWD for EXACTLY two commands: `npm install -g constellai[@*]` and `systemctl restart constella`.
// So here we update via `sudo -n` and then let systemd cycle the unit (it stops this whole cgroup — us
// included — and starts fresh on the new code). No kill-by-pid, no relaunch: systemd owns the process.
const SERVICE = process.env.CONSTELLA_SERVICE || "constella";
// Invoke the SAME absolute npm/systemctl the sudoers rule was written with (vps-install.sh passes them via the
// service env), so `sudo -n` matches the NOPASSWD entry even when sudo's secure_path resolves a bare `npm`/
// `systemctl` to a different path. Falls back to the bare name (unchanged behavior) when the env isn't set.
const NPM = process.env.CONSTELLA_NPM_PATH || "npm";
const SYSTEMCTL = process.env.CONSTELLA_SYSTEMCTL_PATH || "systemctl";

function vpsInstall(target) {
  const opt = { stdio: QUIET ? "ignore" : "inherit", windowsHide: true, cwd: SAFE_CWD };
  for (let i = 0; i < 4; i++) {
    log(`• sudo ${NPM} install -g ${target}  (attempt ${i + 1}/4)…`);
    // Prefer passwordless sudo (root-owned global prefix). Fall back to plain npm in case the prefix is
    // already user-writable (a user-level npm prefix) — then no sudo is needed at all.
    let r = spawnSync("sudo", ["-n", NPM, "install", "-g", target], opt);
    if (r.status === 0) return true;
    r = spawnSync(NPM, ["install", "-g", target], { ...opt, shell: true });
    if (r.status === 0) return true;
    sleep(3000);
  }
  return false;
}

function restartUnit() {
  log(`• Restarting the ${SERVICE} systemd service…`);
  // Self-restart: systemd SIGTERMs this cgroup (incl. this updater) then starts the unit fresh on the new
  // code. The result file is already "done", so the reconnecting UI sees success. If sudo/systemctl isn't
  // available (a non-systemd container), this no-ops and the host keeps running the old code until a manual
  // restart — `Restart=always` does NOT help here because we didn't crash.
  try { spawnSync("sudo", ["-n", SYSTEMCTL, "restart", SERVICE], { stdio: QUIET ? "ignore" : "inherit" }); } catch { /* manual restart needed */ }
}

if (MODE === "vps") {
  result({ status: "running" });
  if (QUIET) sleep(1200);                  // let the UI receive the response + start polling
  // Always @latest on a VPS: the NOPASSWD sudoers rule is scoped to EXACTLY `constellai@latest` (no `@*`
  // wildcard that could span into extra args), and the button only ever wants the newest release.
  const target = `${PKG}@latest`;
  const okv = vpsInstall(target);
  result({ status: okv ? "done" : "error" });
  log(okv ? "✓ Installed — restarting the service." : "✖ Update failed — run by hand: sudo npm i -g constellai@latest && sudo systemctl restart constella");
  if (okv) restartUnit();
  process.exit(okv ? 0 : 1);
}

result({ status: "running" });
if (QUIET) sleep(1200);                  // let the UI receive the response + start polling

// 1. Install FIRST, with the server still running. The live server does NOT lock the global package files
//    (verified on Windows), so this just succeeds — and if it can't, the host stays up. Stopping the server
//    BEFORE npm is exactly what broke earlier updates; we only do it as a fallback below.
let ok = update();

// 2. Fallback for any host where a live process DOES hold the files: stop the server and retry once.
let stopped = false;
if (!ok) { log("• Install failed with the server up — stopping it and retrying…"); stopped = stopServer(); if (stopped) sleep(2500); ok = update(); }

result({ status: ok ? "done" : "error" });
log(ok ? "✓ Installed the latest version." : "✖ Update failed — retry, or run `npm i -g constellai@latest` by hand.");

// 3. Load the new version: the running server still holds the OLD code in memory, so restart it — stop the
//    process tree, then relaunch on the same mode. Skipped when nothing was running (a bare manual update).
if (!stopped) stopped = stopServer();
if (stopped) { sleep(1500); relaunch(); }
process.exit(ok ? 0 : 1);
