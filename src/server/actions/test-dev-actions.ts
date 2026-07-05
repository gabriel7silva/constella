"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/workspace";
import { startProjectServer, stopProjectServer, serverStatus, type DevServerStatus } from "@/server/devserver";
import { ensureInspectProxy, stopInspectProxy } from "@/server/design/live-inspect-proxy";
import { runTestDev, routesForIssue, type TestResult } from "@/server/test-harness";
import { pushInbox } from "@/server/inbox";
import { notifyOps } from "@/lib/notify";

/** Start the project's dev server (boots + installs if needed). */
export async function startDevServerAction(): Promise<DevServerStatus> {
  const { org, workspace } = await requireWorkspace();
  const s = await startProjectServer(workspace.id, org.id);
  revalidatePath("/test-dev");
  return s;
}

export async function stopDevServerAction(): Promise<DevServerStatus> {
  const { workspace } = await requireWorkspace();
  const s = await stopProjectServer(workspace.id);
  revalidatePath("/test-dev");
  return s;
}

export async function devServerStatusAction(): Promise<DevServerStatus> {
  const { workspace } = await requireWorkspace();
  return serverStatus(workspace.id);
}

/** Phase 3b — start the Live-app INSPECT proxy in front of the running dev server and return its local URL.
 *  The Design Live canvas points its iframe at this URL while "Inspect" is on, so clicking a real element maps
 *  back to context Grace can edit. Ensures the dev server is up first. */
export async function startLiveInspectAction(): Promise<{ ok: boolean; url?: string; error?: string }> {
  const { org, workspace } = await requireWorkspace();
  let s = serverStatus(workspace.id);
  if (s.status !== "running" && s.status !== "starting") s = await startProjectServer(workspace.id, org.id);
  if (!s.url || (s.status !== "running" && s.status !== "starting")) return { ok: false, error: "The dev server isn't running — start the app first." };
  const p = await ensureInspectProxy(workspace.id, s.url);
  if (!p) return { ok: false, error: "Could not start the inspect proxy." };
  return { ok: true, url: p.url };
}

/** Stop this workspace's inspect proxy (Inspect toggled off / leaving Live mode). */
export async function stopLiveInspectAction(): Promise<{ ok: boolean }> {
  const { workspace } = await requireWorkspace();
  stopInspectProxy(workspace.id);
  return { ok: true };
}

/** Can the running app be shown in the preview iframe? A server-side header probe: an app that sends
 *  `X-Frame-Options: DENY/SAMEORIGIN` or a `CSP frame-ancestors` that excludes our cross-origin frame
 *  (the security-hardening task commonly adds these) blocks the iframe with ERR_BLOCKED_BY_RESPONSE.
 *  Detecting it lets the UI show a friendly "open in new tab" card instead of a scary browser error. */
export async function previewFrameableAction(url: string): Promise<{ frameable: boolean }> {
  await requireWorkspace();
  // Only ever probe the LOCAL dev server. Parse structurally (never regex a URL): a prefix-only regex like
  // `^https?://127\.0\.0\.1` would let `http://127.0.0.1.evil.com/` through (SSRF). Require an http(s) scheme
  // AND an EXACT loopback hostname; anything else → skip the probe (behave as "frameable", the old default).
  let target: URL;
  try { target = new URL(url); } catch { return { frameable: true }; }
  const okScheme = target.protocol === "http:" || target.protocol === "https:";
  const okHost = target.hostname === "127.0.0.1" || target.hostname === "localhost";
  if (!okScheme || !okHost) return { frameable: true };
  try {
    const r = await fetch(target.toString(), { redirect: "manual", signal: AbortSignal.timeout(3000) });
    const xfo = (r.headers.get("x-frame-options") || "").toLowerCase();
    const csp = (r.headers.get("content-security-policy") || "").toLowerCase();
    const fa = /frame-ancestors\s+([^;]+)/.exec(csp)?.[1] ?? "";
    const xfoBlocks = xfo.includes("deny") || xfo.includes("sameorigin"); // our preview is CROSS-origin
    const cspBlocks = fa ? !/(\*|localhost|127\.0\.0\.1)/.test(fa) : false; // 'none'/'self' (no localhost) blocks it
    return { frameable: !(xfoBlocks || cspBlocks) };
  } catch { return { frameable: true }; } // can't tell → let the iframe try
}

/** Run the Test Dev harness on demand (operator). */
export async function runTestDevAction(opts?: { goalId?: string; issueId?: string }): Promise<TestResult> {
  const { org, workspace } = await requireWorkspace();
  const routes = opts?.issueId ? await routesForIssue(workspace.id, opts.issueId) : undefined;
  const r = await runTestDev(workspace.id, org.id, { goalId: opts?.goalId, issueId: opts?.issueId, routes, by: "operator" });
  revalidatePath("/test-dev");
  return r;
}

/** Agent/operator asks the operator to validate a feature → lands in the Inbox. */
export async function requestValidation(issueKey: string, detail: string): Promise<{ ok: boolean }> {
  const { workspace } = await requireWorkspace();
  await pushInbox(workspace.id, { kind: "validation", refType: "validation", refId: issueKey, title: `Validate ${issueKey}`, detail: detail.slice(0, 500) });
  await notifyOps(workspace.id, { kind: "review", text: `Validation requested — ${issueKey}`, detail: detail.slice(0, 300) });
  revalidatePath("/inbox");
  return { ok: true };
}
