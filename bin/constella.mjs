#!/usr/bin/env node
/**
 * Constella launcher — installs/boots the local-first runtime, the way `claude` and `codex` do:
 * everything lives under the user-home runtime root (override with CONSTELLA_HOME).
 *
 *   npx constellai --onboarding     # force the first-time setup wizard
 *   npx constellai --start          # local mode (auto-login, 127.0.0.1)
 *   npx constellai --auth           # real email + password (127.0.0.1)
 *   npx constellai --vps            # server over Tailscale, in Docker (0.0.0.0)
 *   npx constellai --portable [--path <drive>]   # run from a USB drive (0.0.0.0)
 *   npx constellai update [--check] # detect/apply a new version
 *   (after `npm i -g constellai`, the short command `constella` works too)
 *
 * The launch flag picks the run mode (the UI never picks it in a public build). Network modes
 * (auth/vps/portable) generate + persist a real BETTER_AUTH_SECRET so boot never uses a public key.
 */
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { mkdirSync, existsSync, readFileSync, writeFileSync, chmodSync, readdirSync, rmSync } from "node:fs";
import { spawnSync, spawn, execFileSync } from "node:child_process";
import { createInterface } from "node:readline";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

// Find a dependency's install dir by walking the node_modules chain up from the constella package —
// so it works whether the dep is nested under constella OR hoisted to the install root (the flat
// `npm i` layout) OR symlinked (the dev pnpm tree). `require.resolve` is NOT used: a package's
// `exports` map can hide deep subpaths (drizzle-kit hides ./bin.cjs), which broke a clean `npm i`.
function pkgDir(pkg) {
  let dir = PKG_ROOT;
  for (;;) {
    const cand = join(dir, "node_modules", pkg);
    if (existsSync(join(cand, "package.json"))) return cand;
    const parent = dirname(dir);
    if (parent === dir) return null; // hit the filesystem root
    dir = parent;
  }
}
// Resolve a dependency's CLI entry to an absolute JS path so we can run it with `node` directly —
// no `shell: true`, no bare-name PATH lookup (a hijacked `npx`/`next`/`drizzle-kit` can't shadow it).
// Reads the REAL `bin` field from the package's package.json (robust to `exports` + hoisting).
function resolveBin(pkg, binName) {
  const d = pkgDir(pkg);
  if (!d) return null;
  try {
    const b = JSON.parse(readFileSync(join(d, "package.json"), "utf8")).bin;
    const rel = typeof b === "string" ? b : (b?.[binName] ?? b?.[pkg]);
    return rel ? join(d, rel) : null;
  } catch { return null; }
}

const nativeRequire = createRequire(import.meta.url);

/**
 * Self-heal the native SQLite addon. `better-sqlite3` is a compiled module: its binary must match the
 * running Node's ABI. It can be wrong when the package was installed under a different Node than the one
 * now running, OR when an `allow-scripts`/`ignore-scripts` npm policy blocked the prebuild fetch at
 * install time — both surface at boot as `NODE_MODULE_VERSION … / ERR_DLOPEN_FAILED`, which then makes
 * the drizzle migrate fail. We fetch the correct prebuilt binary ourselves, **directly** (not via an npm
 * lifecycle script), so it works even when install scripts are disabled — no manual `npm rebuild` needed.
 */
function ensureNativeRuntime() {
  // NOTE: better-sqlite3 loads its native addon lazily — in the Database constructor, NOT at require().
  // So we must actually OPEN a db to trigger the dlopen and surface an ABI mismatch.
  const tryLoad = () => { try { const D = nativeRequire("better-sqlite3"); new D(":memory:").close(); return null; } catch (e) { return e; } };
  const first = tryLoad();
  if (!first) return; // already loads — nothing to do
  const msg = String((first && first.message) || first);
  // Only act on a native-binary mismatch; let any other error surface through the normal flow.
  if (!/NODE_MODULE_VERSION|ERR_DLOPEN_FAILED|different Node\.js version|was compiled|invalid ELF|not a valid Win32|cannot open shared object|\.node/i.test(msg)) return;

  const bsDir = pkgDir("better-sqlite3");
  if (!bsDir) return;
  console.log(`• SQLite native module doesn't match Node ${process.version} — fetching the correct build (one-time)…`);

  // 1) prebuild-install — download the prebuilt binary for this exact Node/ABI (fast, no compiler).
  let piBin = resolveBin("prebuild-install", "prebuild-install");
  if (!piBin) { try { piBin = nativeRequire.resolve("prebuild-install/bin.js", { paths: [bsDir, PKG_ROOT] }); } catch { /* not resolvable */ } }
  if (!piBin) { const nested = join(bsDir, "node_modules", "prebuild-install", "bin.js"); if (existsSync(nested)) piBin = nested; }
  if (piBin) spawnSync(process.execPath, [piBin], { cwd: bsDir, stdio: "inherit" });
  if (!tryLoad()) { console.log("• SQLite native module ready."); return; }

  // 2) Fallback — recompile from source (needs a C/C++ toolchain). Run directly via node-gyp if present.
  const gyp = resolveBin("node-gyp", "node-gyp");
  if (gyp) spawnSync(process.execPath, [gyp, "rebuild"], { cwd: bsDir, stdio: "inherit" });
  if (!tryLoad()) { console.log("• SQLite native module ready."); return; }

  // Still broken — fail with a clear, actionable message instead of a raw dlopen stack later.
  console.error(`✖ Could not load the native SQLite module for Node ${process.version}.`);
  console.error("  Use Node 20 or 22 LTS, or rebuild it:  npm rebuild -g better-sqlite3");
  process.exit(1);
}

/** Free bytes on the volume holding `p` (dependency-free; df / Get-PSDrive). 0 if the probe fails. */
function freeBytes(p) {
  try {
    if (process.platform === "win32") {
      const d = (p[0] || "C").toUpperCase();
      const drive = /^[A-Z]$/.test(d) ? d : "C";
      const out = execFileSync("powershell", ["-NoProfile", "-Command", `(Get-PSDrive ${drive}).Free`], { timeout: 6000 }).toString().trim();
      return Number(out.replace(/[^\d]/g, "")) || 0;
    }
    const out = execFileSync("df", ["-k", p], { timeout: 5000 }).toString().trim();
    const parts = (out.split("\n").pop() || "").split(/\s+/);
    return (Number(parts[3]) || 0) * 1024;
  } catch { return 0; }
}

/** Enumerate mounted REMOVABLE (USB) drives → [{ mount, label, freeBytes }]. Dependency-free, per-OS. */
function detectRemovableDrives() {
  try {
    if (process.platform === "win32") {
      const ps = `Get-CimInstance Win32_Volume -Filter "DriveType=2" | Where-Object { $_.DriveLetter } | ForEach-Object { "$($_.DriveLetter)|$($_.Label)|$($_.FreeSpace)" }`;
      const out = execFileSync("powershell", ["-NoProfile", "-Command", ps], { timeout: 8000 }).toString().trim();
      return out.split(/\r?\n/).filter(Boolean).map((l) => {
        const [letter, label, free] = l.split("|");
        const mount = letter.endsWith(":") ? letter + "\\" : letter + ":\\";
        return { mount, label: label || "USB", freeBytes: Number(free) || 0 };
      });
    }
    if (process.platform === "darwin") {
      return readdirSync("/Volumes").map((n) => join("/Volumes", n)).filter((v) => {
        try { const info = execFileSync("diskutil", ["info", v], { timeout: 5000 }).toString(); return /(Removable Media:\s*(Removable|Yes))|(Protocol:\s*USB)/i.test(info) && !/Internal:\s*Yes/i.test(info); }
        catch { return false; }
      }).map((v) => ({ mount: v, label: v.split("/").pop() || "USB", freeBytes: freeBytes(v) }));
    }
    // linux: lsblk RM=1 (removable) + a mountpoint
    const out = execFileSync("lsblk", ["-rpno", "NAME,RM,MOUNTPOINT,LABEL"], { timeout: 6000 }).toString().trim();
    return out.split(/\r?\n/).map((l) => l.split(/\s+/)).filter((p) => p[1] === "1" && p[2]).map((p) => ({ mount: p[2], label: p[3] || "USB", freeBytes: freeBytes(p[2]) }));
  } catch { return []; }
}

/** Portable + no --path: detect USB drives and let the user pick one → returns the chosen .constella root. */
async function pickUsbHome() {
  const drives = detectRemovableDrives();
  if (!drives.length) { console.error("✖ Portable mode: no removable USB drive detected. Insert a pen-drive (or pass --path <drive>)."); process.exit(1); }
  let chosen;
  if (drives.length === 1) {
    chosen = drives[0];
    console.log(`• Using the only USB drive: ${chosen.label} (${chosen.mount}, ${(chosen.freeBytes / 1e9).toFixed(1)} GB free)`);
  } else {
    console.log("Detected USB drives:");
    drives.forEach((d, i) => console.log(`  [${i + 1}] ${d.label}  ${d.mount}  ·  ${(d.freeBytes / 1e9).toFixed(1)} GB free`));
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const ans = await new Promise((res) => rl.question(`Choose a drive [1-${drives.length}]: `, res));
    rl.close();
    chosen = drives[parseInt(ans, 10) - 1] ?? drives[0];
  }
  return join(chosen.mount, ".constella");
}

const PKG = "constellai"; // npm package name (the CLI command/bin stays `constella`)
const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const flag = (f) => { const i = args.indexOf(f); if (i < 0) return undefined; const v = args[i + 1]; return v && !v.startsWith("-") ? v : undefined; }; // a value-less option (e.g. `--port --onboarding`) must not swallow the next flag as its value
const rawCmd = args.find((a) => !a.startsWith("-")); // the bare subcommand the user typed (if any)
const cmd = rawCmd ?? "";

// ---- resolve the launch flag. Authentication is ALWAYS required — these flags only pick the network bind
// (start → 127.0.0.1; vps/portable → 0.0.0.0) and the storage root, never whether you log in. `--auth` is a
// deprecated alias of `--start` (auth is universal now). `runMode` stays undefined when no launch flag /
// subcommand was given, so a bare `constella` does NOT silently start (enforced below). ----
const LAUNCH = ["start", "vps", "portable"];
// `--auth` is accepted as a silent back-compat alias of `--start` (it isn't advertised — auth is always
// required now, so there is no separate auth mode).
const flagMode = [...LAUNCH, "auth"].filter((m) => has(`--${m}`)).map((m) => (m === "auth" ? "start" : m));
if (flagMode.length > 1) console.warn(`• multiple mode flags given; using --${flagMode[0]}`);
const subMode = rawCmd && [...LAUNCH, "auth"].includes(rawCmd) ? (rawCmd === "auth" ? "start" : rawCmd) : undefined;
const bind = flag("--bind");
const bindMode = bind === "tailnet" ? "vps" : bind === "portable" ? "portable" : bind === "local" ? "start" : undefined;
let runMode = flagMode[0] ?? subMode ?? bindMode; // undefined → no explicit launch request

// ---- `constella update` — detect + apply a new version (runs outside the server) ----
function localVersion() {
  try { return JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version ?? "0.0.0"; }
  catch { return "0.0.0"; }
}
async function latestVersion() {
  try {
    const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 4000);
    const r = await fetch(`https://registry.npmjs.org/${PKG}/latest`, { signal: ac.signal });
    clearTimeout(t);
    return r.ok ? ((await r.json()).version ?? null) : null;
  } catch { return null; }
}
if (cmd === "update") {
  const current = localVersion();
  const latest = await latestVersion();
  console.log(`Constella ${current}${latest ? ` · latest ${latest}` : " · (npm registry unavailable)"}`);
  if (has("--check")) process.exit(0);
  if (!latest) { console.log("Couldn't reach the npm registry — try again later."); process.exit(0); }
  if (latest === current) { console.log("✓ Already up to date."); process.exit(0); }
  const fromSource = existsSync(join(process.cwd(), ".git")) && existsSync(join(process.cwd(), "src"));
  if (fromSource) { console.log("Running from source — update with: git pull && pnpm install && pnpm build"); process.exit(0); }
  console.log(`Updating ${current} → ${latest} … (stopping the running server, installing, relaunching)`);
  // Delegate to the standalone self-updater script: it stops a running instance (found via run.json or
  // the port listener) so `npm i -g` can replace the in-use files, installs the latest, and relaunches it
  // on the same mode. Works whether or not a server is currently up — a bare update just installs in place.
  const updater = fileURLToPath(new URL("./constella-update.mjs", import.meta.url));
  const r = spawnSync(process.execPath, [updater, "--version", latest], { stdio: "inherit" });
  process.exit(r.status === 0 ? 0 : 1);
}

// ---- a bare `constella` (no launch flag, no subcommand) must NOT start a server — starting is explicit ----
const wantsOnboarding = has("--onboarding") || cmd === "onboard" || cmd === "onboarding";
if (!runMode && !wantsOnboarding) {
  console.log(
`Constella ${localVersion()}

Usage:
  constella --start        Start the server locally (http://127.0.0.1:3000)
  constella --vps          Start for a VPS (binds 0.0.0.0, joins your Tailscale tailnet)
  constella --portable     Start from a USB drive (runtime root on the drive)
  constella --onboarding   Start and re-run the setup wizard
  constella update         Check for / install a new version

Authentication is always required — the first run lets you create your account, then you log in.`);
  process.exit(1);
}
if (!runMode) runMode = "start"; // e.g. `--onboarding` with no network flag → local

// ---- runtime root: explicit (CONSTELLA_HOME / --path) wins; portable with no path → pick a USB drive ----
const explicitHome = process.env.CONSTELLA_HOME ?? flag("--path");
let HOME = explicitHome ?? join(homedir(), ".constella");
if (runMode === "portable" && !explicitHome) HOME = await pickUsbHome();
mkdirSync(join(HOME, "organizations"), { recursive: true });
process.env.CONSTELLA_HOME = HOME;

// The installed package's OWN root — where the compiled `.next`, the `drizzle/` migrations and the
// configs live. When Constella runs as an npm package these are NOT in the user's CWD, so `next` and
// `drizzle-kit` must run from here (CWD = the launch dir, which has none of them).
const PKG_ROOT = fileURLToPath(new URL("../", import.meta.url));
// Absolute JS entries for the tools we boot — run with `node`, never via a shell or a bare PATH name.
const NEXT_BIN = resolveBin("next", "next");
const DRIZZLE_BIN = resolveBin("drizzle-kit", "drizzle-kit");
// Pin the DB to an ABSOLUTE path under the runtime root so `drizzle-kit migrate` (run from PKG_ROOT)
// and the app (which else defaults it to <launch dir>/.constella) open the SAME database file.
if (!process.env.DATABASE_URL) process.env.DATABASE_URL = "file:" + join(HOME, "constella.db");
// The bundled `skills/` library + other package assets live under the PACKAGE root, NOT the launch
// dir. Export it so the server can find them when installed (the loader falls back to launchDir for
// the dev tree). Without this, an installed run found zero library skills.
process.env.CONSTELLA_PKG_ROOT = PKG_ROOT;

const host = flag("--host") ?? (runMode === "vps" || runMode === "portable" ? "0.0.0.0" : "127.0.0.1");
const port = flag("--port") ?? process.env.PORT ?? "3000";
function normalizeOrigin(value) {
  if (!value) return null;
  try { return new URL(value).origin; } catch { return null; }
}
function addTrustedAuthOrigin(value, { makeBase = false } = {}) {
  const origin = normalizeOrigin(value);
  if (!origin) return;
  const existing = (process.env.CONSTELLA_TRUSTED_ORIGINS ?? "").split(",").map((v) => v.trim()).filter(Boolean);
  if (!existing.includes(origin)) process.env.CONSTELLA_TRUSTED_ORIGINS = [...existing, origin].join(",");
  if (makeBase && !process.env.BETTER_AUTH_URL) process.env.BETTER_AUTH_URL = origin;
  if (makeBase && !process.env.NEXT_PUBLIC_BETTER_AUTH_URL) process.env.NEXT_PUBLIC_BETTER_AUTH_URL = origin;
}
addTrustedAuthOrigin(`http://127.0.0.1:${port}`);
if (host !== "0.0.0.0") addTrustedAuthOrigin(`http://${host}:${port}`);
process.env.CONSTELLA_RUN_MODE = runMode;
process.env.CONSTELLA_PUBLIC = "1"; // a CLI launch IS the public runtime → the UI mode picker is hidden
process.env.CONSTELLA_VERSION = localVersion(); // reliable installed version for the in-app Update check
// The web/worker children inherit this — the in-app updater SIGTERMs this pid to stop the server (so a
// global `npm i -g` can replace the in-use package files on Windows) before relaunching.
process.env.CONSTELLA_LAUNCHER_PID = String(process.pid);
// Persist where/how this instance runs so the self-updater (and a manual `constella update`) can find and
// stop it without guessing — read back in bin/constella-update.mjs. Best-effort; the updater also falls
// back to the port listener. Refreshed every boot, removed on a clean shutdown.
try { writeFileSync(join(HOME, "run.json"), JSON.stringify({ launcherPid: process.pid, mode: runMode, port: String(port), version: localVersion() }), { mode: 0o600 }); } catch { /* best-effort */ }
if (has("--onboarding") || cmd === "onboard" || cmd === "onboarding") process.env.CONSTELLA_FORCE_ONBOARDING = "1";

// ---- secrets persisted under the runtime root (network modes need a real signing key) ----
const ENV_FILE = join(HOME, ".env");
function readEnvFile() {
  const out = {};
  if (!existsSync(ENV_FILE)) return out;
  for (const line of readFileSync(ENV_FILE, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m) out[m[1]] = m[2];
  }
  return out;
}
function ensureSecret(vars, name, gen) {
  if (process.env[name]) { vars[name] = process.env[name]; return false; }     // env wins
  if (vars[name] && !/^(changeme|placeholder)?$/i.test(vars[name])) { process.env[name] = vars[name]; return false; } // reuse persisted
  vars[name] = gen(); process.env[name] = vars[name]; return true;             // generate once
}
// EVERY mode persists a real BETTER_AUTH_SECRET, vault key and worker secret under the runtime root.
// `next start` runs under NODE_ENV=production, where better-auth THROWS on its default secret — so even
// local `start` mode needs a real one (the vault needs CONSTELLA_VAULT_KEY to encrypt provider keys,
// and the worker fails CLOSED without CONSTELLA_WORKER_SECRET). Persisted (not ephemeral) so login
// sessions + the encrypted vault survive a restart. The server + worker inherit this process.env.
{
  const vars = readEnvFile();
  let changed = false;
  changed = ensureSecret(vars, "BETTER_AUTH_SECRET", () => randomBytes(32).toString("base64url")) || changed;
  changed = ensureSecret(vars, "CONSTELLA_VAULT_KEY", () => randomBytes(32).toString("base64")) || changed;
  changed = ensureSecret(vars, "CONSTELLA_WORKER_SECRET", () => randomBytes(24).toString("base64url")) || changed;
  if (changed) {
    writeFileSync(ENV_FILE, Object.entries(vars).map(([k, v]) => `${k}=${v}`).join("\n") + "\n", { mode: 0o600 });
    try { chmodSync(ENV_FILE, 0o600); } catch { /* best-effort on Windows */ }
  }
  console.log(`• Secrets ready (stored in ${ENV_FILE}, never printed).`);
}

// Portable: validate the drive BEFORE installing/booting (minimum 32 GB free; no upper recommendation).
if (runMode === "portable") {
  const free = freeBytes(HOME);
  const gb = Math.round((free / 1e9) * 10) / 10;
  if (free && free < 32e9) { console.error(`✖ Portable needs at least 32 GB free — only ${gb} GB on ${HOME}. Use a bigger drive.`); process.exit(1); }
  else if (free) console.log(`• ${gb} GB free on the drive — good (32 GB minimum; more headroom only helps if you carry local models).`);
}

// VPS on a HOST: one-command setup — ensure Tailscale is installed and joined, so the `0.0.0.0` bind is
// reachable privately on your tailnet (the `npx constellai --vps` quick path). Skipped when
// CONSTELLA_SKIP_TAILSCALE=1 (the systemd service sets it — vps-install.sh already joined the tailnet) and
// on Windows. Best-effort — never blocks boot; the server binds 0.0.0.0 regardless.
if (runMode === "vps" && process.env.CONSTELLA_SKIP_TAILSCALE !== "1") {
  if (process.platform === "win32") {
    console.log("• VPS on Windows → set up Tailscale manually (host Tailscale auto-setup is Linux-only). Skipping.");
  } else {
    const root = typeof process.getuid === "function" && process.getuid() === 0;
    const sh = (cmd) => { try { execFileSync("sh", ["-c", cmd], { stdio: "inherit" }); } catch { /* best-effort */ } };
    const tsOk = () => { try { return spawnSync("tailscale", ["version"], { stdio: "ignore" }).status === 0; } catch { return false; } };
    if (!tsOk()) { console.log("• Installing Tailscale…"); sh(`curl -fsSL https://tailscale.com/install.sh | ${root ? "" : "sudo "}sh`); }
    if (tsOk()) {
      console.log("• Joining your tailnet (a browser auth URL prints if this host isn't joined yet)…");
      sh(`${root ? "" : "sudo "}tailscale up`);
      try {
        const ip = execFileSync("tailscale", ["ip", "-4"], { timeout: 5000 }).toString().trim().split(/\s+/)[0];
        if (ip) {
          const origin = `http://${ip}:${port}`;
          addTrustedAuthOrigin(origin, { makeBase: true });
          console.log(`• VPS reachable on your tailnet at:  ${origin}`);
        }
      } catch { /* ip probe best-effort */ }
    } else {
      console.log("• Tailscale unavailable — the server still binds 0.0.0.0; put it behind Tailscale or a firewall.");
    }
  }
}

console.log(`Constella runtime root : ${HOME}`);
console.log(`Mode                   : ${runMode}  ·  ${host}:${port}`);

// Make sure the native SQLite addon matches THIS Node before drizzle-kit loads it (self-heals a binary
// installed under a different Node, or one whose prebuild fetch was blocked by an allow-scripts policy).
ensureNativeRuntime();

// ---- DB schema: apply the shipped migrations to the (fresh) DB. The compiled distribution ships
// generated SQL migrations in drizzle/, so a brand-new end-user database is built WITHOUT any source
// schema file. `migrate` is idempotent — already-applied migrations are skipped. ----
const dbExisted = existsSync(join(HOME, "constella.db"));
if (!DRIZZLE_BIN) {
  console.error("✖ drizzle-kit not found in the install — cannot apply the database schema. Reinstall the package.");
  process.exit(1);
}
const schema = spawnSync(process.execPath, [DRIZZLE_BIN, "migrate", "--config", join(PKG_ROOT, "drizzle.config.mjs")], { stdio: "inherit", cwd: PKG_ROOT });
if (schema.status !== 0) {
  // A fresh DB that fails to migrate has NO tables → the app would 500 on every request. Fail loud
  // instead of "continuing". An already-built DB tolerates a no-op/failed re-run.
  if (!dbExisted) { console.error("✖ Database schema migration failed on a fresh database — aborting (the app needs its tables)."); process.exit(1); }
  console.warn("• schema migrate skipped/failed on an existing DB — continuing");
}

// Post-migrate schema sanity. A migration can exit 0 (or fail on an "existing" DB) yet leave the schema
// INCOMPLETE — e.g. on a Node major better-sqlite3 doesn't support yet, the native addon loads (passes the
// :memory: self-heal check) but silently fails mid-DDL, creating only a partial subset of tables. The app
// would then 500 with `no such table: user` on every request. Verify the canonical `user` table exists; if
// not, abort LOUD with the likely cause instead of booting a tableless app.
try {
  const probe = new (nativeRequire("better-sqlite3"))(join(HOME, "constella.db"), { readonly: true });
  const hasUser = probe.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='user'").get();
  probe.close();
  if (!hasUser) {
    console.error(`✖ Database schema is INCOMPLETE after migration (no 'user' table) on Node ${process.version}.`);
    console.error("  This usually means the native SQLite module can't finish the schema on this Node version.");
    console.error("  Fix: use Node 20 or 22 LTS (not a brand-new major), remove the runtime DB, and start again:");
    console.error(`    del "${join(HOME, "constella.db")}*"   (or rm)   then   constella --start`);
    process.exit(1);
  }
} catch (e) {
  console.error(`✖ Could not verify the database schema after migration: ${e?.message ?? e}`);
  console.error("  Use Node 20 or 22 LTS and try again.");
  process.exit(1);
}

// ---- build-on-first-run (fallback only) ----
// The published package ships a prebuilt .next under PKG_ROOT, so this is skipped. It only triggers
// when running from a source tree without a build, where the toolchain is present.
let built = existsSync(join(PKG_ROOT, ".next", "BUILD_ID"));
if (!built) {
  console.log("• No build found — building (first run, one-time)…");
  spawnSync(process.execPath, [NEXT_BIN, "build"], { stdio: "inherit", cwd: PKG_ROOT });
  built = existsSync(join(PKG_ROOT, ".next", "BUILD_ID"));
  if (!built) {
    // Every `bin/constella.mjs` launch is a public/production run (CONSTELLA_PUBLIC=1). Never
    // silently downgrade to the unhardened `next dev` server — fail closed unless a developer
    // explicitly opts in with CONSTELLA_DEV=1 (a source tree without a build).
    if (process.env.CONSTELLA_DEV !== "1") {
      console.error("✖ No production build and the build failed. Install a built package or run `pnpm build`. Refusing to start a dev server in a public/network mode.");
      process.exit(1);
    }
    console.warn("• build failed — falling back to the dev server (CONSTELLA_DEV=1).");
  }
}

// ---- boot: the web server + the 24/7 worker, each SUPERVISED so a crash doesn't take the whole
// system down. A "24/7" runtime must survive a transient web/worker crash (e.g. an agent run exhausts
// memory and the OS kills next start) — the supervisor auto-restarts the dead child instead of exiting.
// A rolling-window cap stops a genuine crash-loop from spinning forever. (Mirrors scripts/start-all.mjs
// for the dual-process shape, plus restart.) ----
if (!NEXT_BIN) { console.error("✖ next not found in the install — cannot start the web server. Reinstall the package."); process.exit(1); }

let shuttingDown = false;
let webChild = null;
let workerChild = null;
function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const c of [webChild, workerChild]) { try { c?.kill(); } catch { /* already gone */ } }
  try { rmSync(join(HOME, "run.json"), { force: true }); } catch { /* best-effort */ }
  process.exit(code);
}
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

// Crash-loop guard: at most MAX_RESTARTS within WINDOW_MS per child, else give up (real, repeated
// crash → don't mask it forever). Opt-in heap bump for the web via CONSTELLA_WEB_HEAP_MB.
const MAX_RESTARTS = 5, WINDOW_MS = 60_000;
const HEAP_MB = Number(process.env.CONSTELLA_WEB_HEAP_MB) || 0; // 0 = Node default (a JS-heap OOM prints FATAL; a silent kill is usually OS-level)

/** Spawn a supervised child; on an unexpected exit, auto-restart (bounded) instead of shutting down. */
function supervise(name, makeChild, onExitInfo) {
  const restarts = [];
  const launch = () => {
    const child = makeChild();
    child.on("error", (e) => console.error(`[${name}] failed to start:`, e.message));
    child.on("exit", (code) => {
      if (shuttingDown) return;
      const now = Date.now();
      while (restarts.length && now - restarts[0] > WINDOW_MS) restarts.shift();
      if (restarts.length >= MAX_RESTARTS) {
        console.error(`✖ [${name}] exited (${code}) and crashed ${restarts.length}x within ${WINDOW_MS / 1000}s — giving up.${onExitInfo ? " " + onExitInfo : ""}`);
        return shutdown(code ?? 1);
      }
      restarts.push(now);
      console.warn(`• [${name}] exited (${code}) — auto-restarting in 2s (${restarts.length}/${MAX_RESTARTS} within ${WINDOW_MS / 1000}s).`);
      setTimeout(() => { if (!shuttingDown) launch(); }, 2000);
    });
    return child;
  };
  return launch();
}

const start = built ? [NEXT_BIN, "start", "-H", host, "-p", port] : [NEXT_BIN, "dev", "-H", host, "-p", port];
// `--no-deprecation` keeps the end-user console clean: this is the public runtime, where Node's internal
// deprecation notices (e.g. DEP0190 from a `shell: true` agent spawn on Windows, DEP0176 fs.R_OK) are
// noise the operator can't act on. Applied to the supervised web + worker children, not to dev.
const nodeArgs = ["--no-deprecation", ...(HEAP_MB > 0 ? [`--max-old-space-size=${HEAP_MB}`] : [])];
console.log(`• Starting: next ${start.slice(1).join(" ")}  (from ${PKG_ROOT}${HEAP_MB ? `, heap ${HEAP_MB}MB` : ""})  +  worker`);
webChild = supervise("web",
  () => (webChild = spawn(process.execPath, [...nodeArgs, ...start], { stdio: "inherit", cwd: PKG_ROOT })),
  "Likely OS-level OOM (agent runs exhausting RAM) or a native crash — cap concurrent agents, or raise CONSTELLA_WEB_HEAP_MB if it's a JS-heap OOM.");

// The worker connects back to the server over localhost (127.0.0.1, even when the server binds
// 0.0.0.0 for vps/portable) and self-retries until it answers. It survives a web restart on its own
// (its tick just fails until the web is back), so a web crash restarts ONLY the web — the worker stays.
const workerPath = fileURLToPath(new URL("./worker.mjs", import.meta.url));
setTimeout(() => {
  if (shuttingDown) return;
  workerChild = supervise("worker",
    () => (workerChild = spawn(process.execPath, ["--no-deprecation", workerPath], {
      stdio: "inherit",
      env: { ...process.env, CONSTELLA_BASE_URL: process.env.CONSTELLA_BASE_URL ?? `http://127.0.0.1:${port}` },
    })));
}, 1500);
