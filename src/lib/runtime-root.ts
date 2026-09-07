import { isAbsolute, resolve } from "node:path";

/**
 * The directory the process was LAUNCHED from. npm/pnpm/yarn set `INIT_CWD` to this, and it is
 * inherited even when the Next.js standalone server later `process.chdir()`s into
 * `.next/standalone/`. Anchoring relative runtime paths here (instead of `process.cwd()`) keeps
 * dev (`next dev`) and standalone prod (`node .next/standalone/server.js`) pointed at the SAME
 * `.constella` — otherwise prod silently forks its own database + workspace under the standalone
 * dir, and dev/prod diverge.
 */
let warned = false;
export function launchDir(): string {
  const cwd = process.cwd();
  // Bare `node .next/standalone/server.js` (Docker/systemd/PM2) doesn't set INIT_CWD; after the
  // server chdir's into `.next/standalone/`, a relative DB/CONSTELLA_HOME would fork a separate
  // store there. Warn loudly so this silent divergence is visible (the shipped `pnpm start`/CLI
  // paths set INIT_CWD and are unaffected).
  if (!process.env.INIT_CWD && !warned && /[\\/]\.next[\\/]standalone/.test(cwd)) {
    warned = true;
    console.warn("[runtime-root] INIT_CWD unset and cwd is inside .next/standalone — relative DATABASE_URL/CONSTELLA_HOME will resolve UNDER the standalone dir (separate DB!). Set absolute paths or launch via `pnpm start` (which sets INIT_CWD).");
  }
  return process.env.INIT_CWD || cwd;
}

/** Resolve a possibly-relative runtime path (DATABASE_URL, CONSTELLA_HOME) against the launch dir. */
export function resolveRuntimePath(p: string): string {
  return isAbsolute(p) ? p : resolve(launchDir(), p);
}
