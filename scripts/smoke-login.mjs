#!/usr/bin/env node
/**
 * Pre-publish smoke gate for the client runtime.
 *
 * The published 0.2.15 shipped an inconsistent `.next` artifact (incremental build over a stale
 * `.next/server` + `.next/static` under OneDrive) whose RSC/manifest referenced client-chunk state the emitted
 * static chunks didn't match. It looked fine on the server (HTML/chunks all 200) but crashed at HYDRATION with
 * "invariant expected layout router to be mounted" → the root "Something broke at the root" page. A server-side
 * check (curl) can't catch this — only loading the page in a real browser does.
 *
 * This boots the BUILT package in an isolated runtime and loads /login (both the signin and signup screens) in
 * headless Chrome, failing (exit 1) if the page crashes at hydration. Run it AFTER `npm run validate` (a clean
 * `build:release`) and BEFORE `npm publish`. See docs/{en,pt}/RELEASE_SMOKE.md.
 *
 *   npm run validate && npm run smoke && npm publish --access public --ignore-scripts
 */
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync, openSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const LAUNCHER = join(ROOT, "bin", "constella.mjs");
const WIN = process.platform === "win32";

if (!existsSync(join(ROOT, ".next", "BUILD_ID"))) {
  console.error("✖ smoke: no build found (.next/BUILD_ID). Run `npm run validate` first.");
  process.exit(1);
}

let chromium;
try { ({ chromium } = await import("@playwright/test")); }
catch { try { ({ chromium } = await import("playwright")); } catch { console.error("✖ smoke: Playwright not installed (devDependency)."); process.exit(1); } }

// Real-but-throwaway secrets so the launcher boots without generating/persisting into a real home.
const SECRETS = [
  "BETTER_AUTH_SECRET=smoke_secret_0123456789abcdef0123456789abcdef",
  "CONSTELLA_VAULT_KEY=c21va2V2YXVsdGtleXNtb2tldmF1bHRrZXlzbW9rZTAwMA==",
  "CONSTELLA_WORKER_SECRET=smoke_worker_secret_0123456789abcdef",
].join("\n");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitReady(url, ms = 90_000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { const r = await fetch(url); if (r.ok) return true; } catch { /* not up yet */ }
    await sleep(1000);
  }
  return false;
}

function killPort(port) {
  try {
    if (WIN) {
      const out = spawnSyncText("powershell", ["-NoProfile", "-Command",
        `Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess`]);
      out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean).forEach((pid) => {
        try { spawn("taskkill", ["/F", "/T", "/PID", pid], { stdio: "ignore" }); } catch { /* gone */ }
      });
    }
  } catch { /* best-effort */ }
}
function spawnSyncText(cmd, args) {
  try { return execFileSync(cmd, args, { timeout: 9000, windowsHide: true }).toString(); } catch { return ""; }
}

function killTree(child) {
  try { if (WIN) spawn("taskkill", ["/F", "/T", "/PID", String(child.pid)], { stdio: "ignore" }); else process.kill(-child.pid, "SIGKILL"); }
  catch { /* already gone */ }
}

async function launchBrowser() {
  for (const channel of ["chrome", "msedge"]) {
    try { return await chromium.launch({ channel, headless: true }); } catch { /* try next */ }
  }
  try { return await chromium.launch({ headless: true }); }
  catch (e) { console.error("✖ smoke: could not launch a browser (install Chrome/Edge, or `npx playwright install chromium`):", e.message); process.exit(2); }
}

async function checkScreen(label, pwSet, port) {
  killPort(port);
  const home = join(tmpdir(), `constella-smoke-${label}-${port}`);
  rmSync(home, { recursive: true, force: true });
  mkdirSync(join(home, "organizations"), { recursive: true });
  writeFileSync(join(home, ".env"), `${SECRETS}\nCONSTELLA_OPERATOR_PW_SET=${pwSet}\n`, { mode: 0o600 });
  const logPath = join(home, "boot.log");
  const logFd = openSync(logPath, "a");

  const child = spawn(process.execPath, [LAUNCHER, "--start"], {
    cwd: ROOT,
    env: { ...process.env, CONSTELLA_HOME: home, PORT: String(port) },
    stdio: ["ignore", logFd, logFd],
    detached: !WIN,
    windowsHide: true,
  });

  const url = `http://127.0.0.1:${port}/login`;
  try {
    if (!(await waitReady(url))) {
      console.error(`✖ smoke[${label}]: server never became ready on ${url}. boot.log tail:`);
      try { console.error(readFileSync(logPath, "utf8").split(/\r?\n/).slice(-12).join("\n")); } catch { /* no log */ }
      return false;
    }
    const browser = await launchBrowser();
    const errors = [];
    const page = await (await browser.newContext()).newPage();
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    page.on("pageerror", (e) => errors.push(String(e?.message || e)));
    let bodyText = "";
    try {
      const resp = await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
      if (!resp || resp.status() !== 200) errors.push("HTTP " + (resp ? resp.status() : "no-response"));
      await page.waitForTimeout(3500); // let hydration + the React scheduler (MessagePort) flush
      bodyText = await page.evaluate(() => document.body.innerText).catch(() => "");
    } catch (e) { errors.push("GOTO " + e.message); }
    await browser.close();

    const blob = `${errors.join("\n")}\n${bodyText}`;
    if (/invariant expected layout router|broke at the root|Failed to find Server Action/i.test(blob)) {
      console.error(`✖ smoke[${label}]: /login CRASHED at hydration.`);
      errors.slice(0, 6).forEach((e) => console.error("   " + String(e).slice(0, 200)));
      return false;
    }
    console.log(`✓ smoke[${label}]: /login hydrated clean (HTTP 200, no invariant).`);
    return true;
  } finally {
    killTree(child);
  }
}

console.log("• smoke: loading /login from the built package in headless Chrome…");
let ok = true;
ok = (await checkScreen("signin", 1, 3191)) && ok;
ok = (await checkScreen("signup", 0, 3192)) && ok;
console.log(ok ? "\n✓ smoke PASSED — safe to publish." : "\n✖ smoke FAILED — do NOT publish. Rebuild clean: `npm run validate` (full `.next` purge), then re-run `npm run smoke`.");
process.exit(ok ? 0 : 1);
