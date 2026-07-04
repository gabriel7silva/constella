"use client";

import { useEffect, useRef } from "react";
import { reloadOnceForSkew } from "@/lib/deployment-skew";

/**
 * Auto-reload the tab when the server restarts. Polls /api/health (a cheap public endpoint that returns a
 * per-process `bootId`); the first id seen is the baseline, and when a later poll returns a DIFFERENT id the
 * server has restarted (manual `constella --start`, a crash-restart, or a self-update) → hard-reload onto the
 * fresh build. Failed polls (server down mid-restart) are ignored — the change is detected when it comes back
 * with a new id. Reuses reloadOnceForSkew() (cache-busting + 20s loop-guard). Renders nothing.
 */
export function ServerReloadGuard({ intervalMs = 5000 }: { intervalMs?: number }) {
  const baseline = useRef<string | null>(null);

  useEffect(() => {
    let stopped = false;
    async function poll() {
      if (stopped || document.hidden) return;
      try {
        const r = await fetch("/api/health", { cache: "no-store" });
        if (!r.ok) return;
        const { bootId } = (await r.json()) as { bootId?: string };
        if (!bootId) return;
        if (baseline.current == null) { baseline.current = bootId; return; }
        if (bootId !== baseline.current) reloadOnceForSkew(); // server restarted → onto the new build
      } catch { /* server down mid-restart → detected on the next successful poll */ }
    }
    poll();
    const id = setInterval(poll, intervalMs);
    const onVis = () => { if (!document.hidden) poll(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { stopped = true; clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
  }, [intervalMs]);

  return null;
}
