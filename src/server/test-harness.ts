import "server-only";
import { randomUUID as uid } from "node:crypto";
import { mkdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { testRun, issue } from "@/db/schema";
import { orgRoot } from "@/lib/fs-workspace";
import { emit } from "@/server/events";
import { wake } from "@/server/bus";
import { startProjectServer, serverUrl, serverStatus } from "@/server/devserver";
import { ingestKnowledge } from "@/server/kb";
import { readDesignPromoted } from "@/server/design/context";

export type Finding = { severity: "high" | "med" | "low"; kind: "console" | "pageerror" | "request" | "security" | "boot" | "fidelity"; route: string; message: string };

// Phase 3a — visual fidelity. Compare the running app's route to the APPROVED design (the promoted screen file),
// in-browser (no extra deps): draw both PNGs onto fixed 1280×800 canvases and count pixels differing past a
// tolerance. Returns the differing fraction (0..1), or null on any failure (the check is always best-effort).
async function visualDiffFraction(ctx: import("@playwright/test").BrowserContext, baselineB64: string, actualB64: string): Promise<number | null> {
  const p = await ctx.newPage();
  try {
    return await p.evaluate(async (imgs: [string, string]) => {
      const load = (src: string) => new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
      const W = 1280, H = 800, tol = 32;
      const [ia, ib] = await Promise.all([load(imgs[0]), load(imgs[1])]);
      const draw = (img: HTMLImageElement) => { const c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d")!; x.drawImage(img, 0, 0, W, H); return x.getImageData(0, 0, W, H).data; };
      const a = draw(ia), b = draw(ib);
      let diff = 0;
      for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) > tol || Math.abs(a[i + 1] - b[i + 1]) > tol || Math.abs(a[i + 2] - b[i + 2]) > tol) diff++;
      return diff / (W * H);
    }, [`data:image/png;base64,${baselineB64}`, `data:image/png;base64,${actualB64}`] as [string, string]);
  } catch { return null; }
  finally { try { await p.close(); } catch { /* ignore */ } }
}
export type TestVerdict = "pass" | "fail" | "inconclusive";
export type TestResult = { id: string; status: TestVerdict; summary: string; findings: Finding[] };

// Sensitive paths that must NOT serve content unauthenticated. Probed against the LOCAL project
// dev server only — never an external host.
const SECURITY_PATHS = ["/.env", "/.env.local", "/.git/config", "/config.json", "/admin", "/api"];
const SECRET_RE = /(sk-[a-z0-9]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN (?:RSA |EC )?PRIVATE KEY-----|password["']?\s*[:=]\s*["'][^"']{4,})/i;

// `npm install @playwright/test` installs the LIBRARY but NOT the browser binary, so the first Test
// Dev run fails with "Couldn't launch chromium". Install it on demand (once per process), bounded.
let chromiumInstall: Promise<boolean> | null = null;
function ensureChromium(): Promise<boolean> {
  if (!chromiumInstall) {
    chromiumInstall = new Promise<boolean>((resolve) => {
      try {
        const npx = process.platform === "win32" ? "npx.cmd" : "npx";
        const p = spawn(npx, ["playwright", "install", "chromium"], { stdio: "ignore", windowsHide: true });
        const timer = setTimeout(() => { try { p.kill(); } catch { /* gone */ } resolve(false); }, 300_000);
        p.on("exit", (code) => { clearTimeout(timer); resolve(code === 0); });
        p.on("error", () => { clearTimeout(timer); resolve(false); });
      } catch { resolve(false); }
    });
  }
  return chromiumInstall;
}

function tlog(wsId: string, runId: string, kind: "thinking" | "text" | "done" | "error", target = "", detail = "") {
  void emit(wsId, { runId, channel: "testdev", agentId: null, kind, target, detail });
  wake(wsId);
}

/**
 * Run the Test Dev harness: ensure the project's dev server is up, drive it with a headless
 * browser (clicks/navigation), capture console errors/warnings, page errors, failed requests and
 * basic security probes, then return a verdict. Degrades to `inconclusive` (never a false `fail`)
 * when the project can't boot or Playwright/chromium isn't installed.
 */
export async function runTestDev(
  workspaceId: string,
  orgId: string,
  opts: { goalId?: string | null; issueId?: string | null; routes?: string[]; by?: "operator" | "agent"; noBoot?: boolean } = {},
): Promise<TestResult> {
  const runId = uid();
  await db.insert(testRun).values({ id: runId, workspaceId, goalId: opts.goalId ?? null, issueId: opts.issueId ?? null, status: "running", by: opts.by ?? "operator" });
  tlog(workspaceId, runId, "thinking", "Starting Test Dev…");

  const finish = async (status: TestVerdict, summary: string, findings: Finding[]): Promise<TestResult> => {
    await db.update(testRun).set({ status, summary: summary.slice(0, 600), findings: JSON.stringify(findings).slice(0, 20000), finishedAt: new Date() }).where(eq(testRun.id, runId));
    tlog(workspaceId, runId, "done", `${status} · ${findings.length} finding(s)`);
    return { id: runId, status, summary, findings };
  };

  // 1) Ensure the project dev server is running.
  let url = serverUrl(workspaceId);
  if (!url && opts.noBoot) {
    // Gate path: don't auto-install/boot a project mid-task — only validate when the operator
    // already has the dev server up in Test Dev. Otherwise pass through (inconclusive).
    return finish("inconclusive", "Dev server not running — start it in Test Dev to gate task completion.", []);
  }
  if (!url) {
    tlog(workspaceId, runId, "thinking", "Booting project dev server…");
    const s = await startProjectServer(workspaceId, orgId);
    if (!s.running || !s.url) {
      return finish("inconclusive", "No runnable project / dev server didn't boot — nothing to test yet.", [{ severity: "low", kind: "boot", route: "-", message: s.logs.slice(-3).map((l) => l.t).join(" | ") || "no project" }]);
    }
    url = s.url;
  }
  if (serverStatus(workspaceId).status !== "running") {
    // started but not reachable yet
    return finish("inconclusive", "Dev server is still starting — try again shortly.", [{ severity: "low", kind: "boot", route: "-", message: "server not reachable yet" }]);
  }

  // 2) Derive routes: caller-provided, else the home page (+ a couple common ones).
  const routes = (opts.routes && opts.routes.length ? opts.routes : ["/"]).slice(0, 8);

  // 3) Launch a headless browser. Missing Playwright/chromium → inconclusive (never blocks a task).
  let chromium: typeof import("@playwright/test").chromium;
  try {
    ({ chromium } = await import("@playwright/test"));
  } catch {
    return finish("inconclusive", "Playwright not available — install it (`npx playwright install chromium`) to enable browser tests.", []);
  }

  const findings: Finding[] = [];
  const shotDir = join(orgRoot(orgId), ".testdev");
  try { mkdirSync(shotDir, { recursive: true }); } catch { /* best-effort */ }

  let browser: import("@playwright/test").Browser | null = null;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (e) {
    // Browser binary missing → install chromium once, then retry. (npm doesn't fetch it.)
    tlog(workspaceId, runId, "thinking", "Installing the test browser (chromium, one-time ~150MB)…");
    const ok = await ensureChromium();
    if (ok) { try { browser = await chromium.launch({ headless: true }); } catch { /* fall through */ } }
    if (!browser) return finish("inconclusive", ok ? "Couldn't launch chromium after install — try again." : "Couldn't install/launch chromium. Run `npx playwright install chromium` in the install dir, then retry.", [{ severity: "low", kind: "boot", route: "-", message: String(e instanceof Error ? e.message : e).slice(0, 200) }]);
  }

  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    page.on("console", (m) => {
      const type = m.type();
      if (type === "error") findings.push({ severity: "high", kind: "console", route: page.url(), message: m.text().slice(0, 300) });
      else if (type === "warning") findings.push({ severity: "low", kind: "console", route: page.url(), message: m.text().slice(0, 300) });
    });
    page.on("pageerror", (e) => findings.push({ severity: "high", kind: "pageerror", route: page.url(), message: String(e.message ?? e).slice(0, 300) }));
    page.on("requestfailed", (r) => {
      const f = r.failure()?.errorText ?? "";
      if (!/ERR_ABORTED/.test(f)) findings.push({ severity: "med", kind: "request", route: page.url(), message: `${r.method()} ${r.url().slice(0, 160)} — ${f}` });
    });

    // Phase 3a — visual fidelity vs the approved design. Only when a static design was PROMOTED + served (the
    // public/ files the dev server renders), so a route maps to a design screen we can diff against. Best-effort.
    const promoted = readDesignPromoted(orgId);
    const doParity = !!promoted.served && !!promoted.target;
    const baselineDir = join(shotDir, "baseline");
    if (doParity) { try { mkdirSync(baselineDir, { recursive: true }); } catch { /* best-effort */ } }

    for (const route of routes) {
      tlog(workspaceId, runId, "text", `navigate ${route}`);
      try {
        const resp = await page.goto(url + route, { waitUntil: "domcontentloaded", timeout: 20_000 });
        if (resp && resp.status() >= 500) findings.push({ severity: "high", kind: "request", route, message: `${route} → HTTP ${resp.status()}` });
        await page.waitForTimeout(800);
        // best-effort interaction: click the first enabled button to exercise a flow
        const btn = page.locator("button:visible:not([disabled])").first();
        if (await btn.count()) { try { await btn.click({ timeout: 2000 }); await page.waitForTimeout(500); } catch { /* non-fatal */ } }
        // scan served HTML for leaked secrets
        const html = await page.content();
        if (SECRET_RE.test(html)) findings.push({ severity: "high", kind: "security", route, message: "Possible secret/credential present in served HTML/JS." });
        const key = route.replace(/[^a-z0-9]/gi, "_") || "root";
        try { await page.screenshot({ path: join(shotDir, `${runId}-${key}.png`) }); } catch { /* best-effort */ }
        // Visual-fidelity diff vs the approved design (best-effort — never breaks the gate).
        if (doParity) {
          try {
            const baseFile = join(baselineDir, `${key}.png`);
            if (!existsSync(baseFile)) {
              // Capture the baseline ONCE from the promoted design screen (rendered headless from file://).
              const rel = route === "/" ? "index.html" : route.replace(/^\//, "").replace(/\/+$/, "") + ".html";
              const designAbs = join(orgRoot(orgId), promoted.target as string, rel);
              if (existsSync(designAbs)) {
                const bp = await ctx.newPage();
                try { await bp.goto(pathToFileURL(designAbs).href, { waitUntil: "domcontentloaded", timeout: 15_000 }); await bp.waitForTimeout(400); await bp.screenshot({ path: baseFile }); }
                finally { try { await bp.close(); } catch { /* ignore */ } }
              }
            }
            if (existsSync(baseFile)) {
              const actualBuf = await page.screenshot();
              const frac = await visualDiffFraction(ctx, readFileSync(baseFile).toString("base64"), actualBuf.toString("base64"));
              if (frac != null) {
                const pct = Math.round(frac * 100);
                if (frac > 0.5) findings.push({ severity: "high", kind: "fidelity", route, message: `Visual fidelity: ${pct}% of the screen differs from the APPROVED design — it doesn't match; build ${route} to the design (zero drift).` });
                else if (frac > 0.12) findings.push({ severity: "med", kind: "fidelity", route, message: `Visual drift: ${pct}% differs from the approved design at ${route}.` });
              }
            }
          } catch { /* fidelity is best-effort */ }
        }
      } catch (e) {
        findings.push({ severity: "med", kind: "request", route, message: `navigation failed: ${String(e instanceof Error ? e.message : e).slice(0, 160)}` });
      }
    }

    // 4) Security probes — sensitive paths must not serve content unauthenticated.
    for (const p of SECURITY_PATHS) {
      try {
        const r = await fetch(url + p, { redirect: "manual", signal: AbortSignal.timeout(4000) });
        if (r.status === 200) {
          const body = await r.text().catch(() => "");
          const looksSensitive = p === "/api" ? false : body.length > 0;
          if (looksSensitive || SECRET_RE.test(body)) findings.push({ severity: "high", kind: "security", route: p, message: `${p} returns 200 with content unauthenticated.` });
        }
      } catch { /* unreachable path = fine */ }
    }

    await ctx.close();
  } finally {
    try { await browser.close(); } catch { /* ignore */ }
  }

  // 5) Verdict — only HARD failures (high-severity) block; warnings/low don't.
  const high = findings.filter((f) => f.severity === "high");
  const status: TestVerdict = high.length ? "fail" : "pass";
  const summary = status === "fail"
    ? `${high.length} blocking issue(s): ${high.slice(0, 3).map((f) => `${f.kind} @ ${f.route}`).join(", ")}`
    : `Passed — ${findings.length} note(s), no blocking issues. Navigated ${routes.length} route(s).`;
  // KB capture: the test verdict is durable knowledge (what passed/failed, where).
  void ingestKnowledge(orgId, [{
    type: "test", title: `Test Dev — ${status}`, summary,
    goalId: opts.goalId ?? null, issueId: opts.issueId ?? null,
    agentHandle: opts.by === "agent" ? "edsger" : "operator", sourceKind: "test", sourceRef: runId,
  }]).catch(() => {});
  return finish(status, summary, findings);
}

/** Resolve a few routes to test for an issue (best-effort) — its title may name a path. */
export async function routesForIssue(workspaceId: string, issueId: string): Promise<string[]> {
  const [i] = await db.select().from(issue).where(eq(issue.id, issueId));
  const routes = new Set<string>(["/"]);
  if (i) { const m = (i.title + " " + (i.key ?? "")).match(/\/[a-z0-9\-/]{2,}/gi); if (m) m.slice(0, 4).forEach((r) => routes.add(r)); }
  return [...routes];
}
