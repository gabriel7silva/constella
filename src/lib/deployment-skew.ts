// Deployment / version skew handling.
//
// When a browser tab stays open across a redeploy — most commonly Constella's own in-app self-update, which
// restarts the server on a NEW build — the tab is still running the OLD client bundle. Its server-action IDs
// and chunk names no longer exist on the server, so the next call throws "Failed to find Server Action … from
// an older or newer deployment" (or a chunk-load error), which bubbles up as the root crash
// "invariant expected layout router to be mounted". The only cure is a HARD reload to fetch the matching
// bundle — React's error `reset()` keeps the stale bundle and just skews again.
//
// This module centralises detection + a loop-guarded reload, used by the root error boundary, a global
// listener, and the update badge.

const SKEW = /Failed to find Server Action|older or newer deployment|ChunkLoadError|Loading chunk [\w-]+ failed|error loading dynamically imported module/i;

// The App Router throws this from inside a scheduled commit when its internal LayoutRouter context is
// momentarily null — most often a `router.refresh()` (e.g. the runner heartbeat) landing on a mismatched RSC
// payload right after the server restarted on a new build, or a transient hydration glitch. It is NOT a skew
// *message*, but it is the same recoverable situation: a hard reload onto the fresh bundle clears it every
// time. Matched here so the error boundary + global listener can self-heal instead of stranding the user.
const NAV_INVARIANT = /invariant expected layout router to be mounted/i;

function msgOf(err: unknown): string {
  if (!err) return "";
  return err instanceof Error ? `${err.name} ${err.message}` : typeof err === "string" ? err : String((err as { message?: unknown })?.message ?? err);
}

/** True when an error looks like client/server version skew (stale tab after a redeploy/self-update). */
export function isDeploymentSkew(err: unknown): boolean {
  return SKEW.test(msgOf(err));
}

/**
 * True for any client crash a reload reliably fixes: version skew OR the App Router "layout router" invariant.
 * Used by the error boundary and the global listener to auto-recover (loop-guarded by reloadOnceForSkew).
 */
export function isRecoverableClientCrash(err: unknown): boolean {
  const m = msgOf(err);
  return SKEW.test(m) || NAV_INVARIANT.test(m);
}

/**
 * Hard-reload to pick up the new bundle — but at most once per 20s window, so a genuinely broken build can't
 * spin in a reload loop (after which the user sees the normal error UI and can act). No-op outside the browser.
 */
export function reloadOnceForSkew(): void {
  if (typeof window === "undefined") return;
  try {
    const KEY = "cn-skew-reload-at";
    const last = Number(window.sessionStorage.getItem(KEY) || 0);
    if (Date.now() - last < 20_000) return; // already tried just now → don't loop
    window.sessionStorage.setItem(KEY, String(Date.now()));
  } catch { /* storage blocked — fall through and reload once */ }
  // Cache-busting navigation, not a plain reload: forces a fresh document fetch so the tab can't re-load a
  // stale cached HTML that still points at the old build's chunks. The transient `_r` param is harmless.
  try {
    const url = new URL(window.location.href);
    url.searchParams.set("_r", String(Date.now()));
    window.location.replace(url.toString());
  } catch { window.location.reload(); }
}
