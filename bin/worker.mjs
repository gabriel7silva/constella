// Headless 24/7 runner + workspace file-watcher. Runs independent of any browser, alongside the web
// server. Self-contained: imports only node built-ins + chokidar and talks to the running server over
// HTTP — so it ships in the compiled distribution with no `src/` source. Started by:
//   - bin/constella.mjs (the published CLI launch), and
//   - scripts/start-all.mjs (dev `pnpm start`).
import { homedir } from "node:os";
import { join, relative, sep, isAbsolute, resolve } from "node:path";
import { setMaxListeners } from "node:events";
import chokidar from "chokidar";

// Raise Node's default 10-listener ceiling: undici registers a per-request "terminated" listener on
// its shared internal `[Fetch]` controller, so the tick + telegram + sync fetches trip a benign
// MaxListenersExceededWarning under load. Bounded (not 0) so a real leak still surfaces.
setMaxListeners(64);

const BASE = process.env.CONSTELLA_BASE_URL ?? "http://localhost:3000";
const SECRET = process.env.CONSTELLA_WORKER_SECRET ?? "";
const INTERVAL = Number(process.env.CONSTELLA_WORKER_INTERVAL_MS ?? 60_000);
// Anchor a relative CONSTELLA_HOME to the launch dir (INIT_CWD), exactly like the app's
// resolveRuntimePath — otherwise the worker watches a different tree than the app reads/writes.
const _rawHome = process.env.CONSTELLA_HOME;
const HOME = _rawHome
  ? (isAbsolute(_rawHome) ? _rawHome : resolve(process.env.INIT_CWD || process.cwd(), _rawHome))
  : join(homedir(), ".constella");
const ORGS = join(HOME, "organizations");

// SSRF / secret-exfil guard: the worker attaches the privileged x-worker-secret to every call, so it
// must only ever talk to the local server. Whoever controls the env (systemd unit, Docker env, shell)
// could otherwise point CONSTELLA_BASE_URL at an attacker host and harvest the secret. The launcher
// always sets BASE=http://127.0.0.1:<port> (loopback even in vps/portable), so loopback-only breaks
// nothing legitimate; a genuine remote worker must opt in explicitly.
const ALLOW_REMOTE = process.env.CONSTELLA_ALLOW_REMOTE_WORKER_BASE_URL === "1";
let baseHost = "";
try { baseHost = new URL(BASE).hostname; }
catch { console.error("✖ Invalid CONSTELLA_BASE_URL:", BASE); process.exit(1); }
const isLoopback = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(baseHost);
if (!isLoopback && !ALLOW_REMOTE) {
  console.error(`✖ Refusing to send the worker secret to a non-loopback host (${baseHost}). Set CONSTELLA_ALLOW_REMOTE_WORKER_BASE_URL=1 to override.`);
  process.exit(1);
}
if (!isLoopback && ALLOW_REMOTE && new URL(BASE).protocol !== "https:") {
  console.warn(`• CONSTELLA_BASE_URL is a remote http:// host (${baseHost}) — the worker secret will travel in cleartext. Use https://.`);
}
if (!SECRET) console.error("✖ CONSTELLA_WORKER_SECRET is empty — every privileged worker call (tick · sync · telegram) will be rejected (401) and nothing scheduled will run. Set it in ~/.constella/.env, then restart.");
const headers = (SECRET && (isLoopback || ALLOW_REMOTE)) ? { "x-worker-secret": SECRET } : {};

/* ---- 24/7 tick ---- */
async function tick() {
  try {
    const res = await fetch(BASE + "/api/cron/tick", { method: "POST", headers });
    const body = await res.json().catch(() => ({}));
    console.log(new Date().toISOString(), "tick", res.status, JSON.stringify(body).slice(0, 200));
  } catch (e) {
    console.error(new Date().toISOString(), "tick failed:", e?.message ?? e);
  }
}

/* ---- file-watcher: disk -> DB index ---- */
// Only these prefixes are indexed (skills/agents/docs/PO/reports as Markdown).
const INDEXED = /^(\.claude\/skills\/.+\.md|\.claude\/agents\/[^/]+\/(Agent|skills)\.md|DOCS\/.+\.md|PO\/.+\.md|Reports\/.+\.md)$/;

function parse(abs) {
  const r = relative(ORGS, abs);                 // <orgId>/workspace/<rel...>
  if (r.startsWith("..")) return null;
  const parts = r.split(sep);
  if (parts.length < 3 || parts[1] !== "workspace") return null;
  const orgId = parts[0];
  const rel = parts.slice(2).join("/");
  if (!INDEXED.test(rel)) return null;
  return { orgId, rel };
}

const pending = new Map();

// Cap concurrent sync POSTs. A workspace seed (onboarding) creates HUNDREDS of files at once; without a cap
// the debounced flush fans out hundreds of simultaneous fetch()es and exhausts undici's socket pool → a flood
// of "sync failed: fetch failed". Cap to a handful, queue the rest, and retry transient failures (the file is
// on disk regardless; retrying keeps the DB index correct without the noise).
const SYNC_CONCURRENCY = 8;
let syncActive = 0;
const syncQueue = [];
function pumpSync() {
  while (syncActive < SYNC_CONCURRENCY && syncQueue.length) {
    syncActive++;
    syncQueue.shift()().finally(() => { syncActive--; pumpSync(); });
  }
}
function enqueueSync(orgId, rel, event) { syncQueue.push(() => syncFile(orgId, rel, event)); pumpSync(); }

async function syncFile(orgId, rel, event) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(BASE + "/api/sync/file", {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({ orgId, rel, event }),
      });
      console.log(new Date().toISOString(), "sync", event, rel, res.status);
      return;
    } catch (e) {
      if (attempt === 3) { console.error(new Date().toISOString(), "sync failed:", e?.message ?? e); return; }
      await new Promise((r) => setTimeout(r, 250 * attempt)); // brief backoff, then retry the POST
    }
  }
}
function schedule(abs, event) {
  const hit = parse(abs);
  if (!hit) return;
  const key = hit.orgId + "::" + hit.rel;
  clearTimeout(pending.get(key));
  pending.set(key, setTimeout(() => { pending.delete(key); enqueueSync(hit.orgId, hit.rel, event); }, 400));
}

function startWatcher() {
  const watcher = chokidar.watch(ORGS, {
    ignoreInitial: true,
    ignored: /(^|[/\\])(\.git|node_modules)([/\\]|$)/,
    awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
  });
  watcher
    .on("add", (p) => schedule(p, "add"))
    .on("change", (p) => schedule(p, "change"))
    .on("unlink", (p) => schedule(p, "unlink"))
    .on("ready", () => console.log("watching", ORGS))
    .on("error", (e) => console.error("watcher error:", e?.message ?? e));
}

/* ---- Telegram bot poll (long-poll loop; getUpdates waits ~25s server-side) ---- */
async function telegramLoop() {
  for (;;) {
    try {
      const res = await fetch(BASE + "/api/telegram/poll", { method: "POST", headers });
      if (res.status === 401) { await new Promise((r) => setTimeout(r, 30_000)); continue; } // not configured/secret
      const body = await res.json().catch(() => ({}));
      if (body?.updates) console.log(new Date().toISOString(), "telegram", body.updates, "update(s)");
    } catch (e) {
      console.error(new Date().toISOString(), "telegram poll failed:", e?.message ?? e);
      await new Promise((r) => setTimeout(r, 5_000));
    }
    await new Promise((r) => setTimeout(r, 1_000)); // brief gap between long-polls
  }
}

/* ---- wait for the web server before the first tick ---- */
// The launcher starts us a beat after `next start`, but Next can still be warming up — firing the
// first tick into a not-yet-listening server printed an alarming "fetch failed". Probe quietly until
// the server answers (any HTTP status = up), THEN start ticking. Bounded so we never hang forever.
async function waitForServer() {
  for (let i = 0; i < 90; i++) {
    try { await fetch(BASE, { method: "GET" }); return true; } // any response means it's listening
    catch { await new Promise((r) => setTimeout(r, 1000)); }
  }
  return false; // give up after ~90s — tick()'s own error handling takes over
}

console.log(`Constella worker → tick ${BASE}/api/cron/tick every ${INTERVAL}ms; telegram poll; watching ${ORGS}`);
(async () => {
  await waitForServer();
  startWatcher(); // start watching only after the server can accept POSTs — no boot-time "sync failed: fetch failed"
  tick();
  setInterval(tick, INTERVAL);
  telegramLoop();
})();
