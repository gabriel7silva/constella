// Runs once when the server process starts (dev, `next start`, and the standalone server).
// We use it to reconcile stale runtime state left by a previous process — agents marked
// "working" and tasks stuck "doing" that have no live run after a restart.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return; // skip the edge runtime
  // Raise Node's default 10-listener ceiling. The cron tick + model-catalog/provider refresh fan out
  // many concurrent `fetch()` calls; undici registers a per-request "terminated" listener on its
  // internal shared `[Fetch]` controller, so >10 in flight floods the console with a benign
  // MaxListenersExceededWarning (the listeners ARE freed when each request settles). Bounded, not 0,
  // so a genuine listener leak elsewhere still surfaces.
  const { default: EventEmitter } = await import("node:events");
  EventEmitter.defaultMaxListeners = 64;

  // Blanket structured-log filter: agent/tool output can flow into console; redact known secret shapes
  // from every logged string at one choke-point. Idempotent (a global flag) so a hot-reload / a second
  // register() never double-wraps.
  const g = globalThis as Record<string, unknown>;
  if (!g.__constellaLogScrub) {
    g.__constellaLogScrub = true;
    const { redactForLog } = await import("@/lib/scrub");
    for (const m of ["log", "info", "warn", "error", "debug"] as const) {
      const orig = console[m].bind(console);
      console[m] = (...args: unknown[]) => orig(...args.map((a) => (typeof a === "string" ? redactForLog(a) : a)));
    }
  }

  const { reconcileOnBoot } = await import("@/server/boot");
  await reconcileOnBoot();
}
