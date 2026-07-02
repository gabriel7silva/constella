export type RunMode = "start" | "auth" | "vps" | "portable";

const VALID: readonly RunMode[] = ["start", "auth", "vps", "portable"];

/**
 * The launch flag the server was started with (`CONSTELLA_RUN_MODE`). Authentication is ALWAYS required —
 * this is no longer an "auth mode". It only selects network binding (start → 127.0.0.1; vps/portable →
 * 0.0.0.0), the update/run-context (Docker vs npm vs USB), agent sandboxing, and the 24/7 boot sync.
 */
export function getRunMode(): RunMode {
  const m = process.env.CONSTELLA_RUN_MODE as RunMode | undefined;
  return m && VALID.includes(m) ? m : "start";
}
