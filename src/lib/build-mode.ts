import "server-only";

/**
 * Is Constella running in DEVELOPER mode (running from source), vs a public/compiled build?
 *
 * This gates UI AFFORDANCES only — e.g. the run-mode picker on the login screen and the mode chips in
 * Config. It is NOT a security boundary: security stays enforced by `assertAuthSecret()` (boot) and
 * the run-mode-based auth gates. `import "server-only"` keeps this off the client (so `NODE_ENV`
 * isn't inlined into client bundles and `CONSTELLA_PUBLIC` is read server-side).
 *
 * Priority:
 *   1. CONSTELLA_PUBLIC=1  → false  (authoritative compiled/shipped marker; the CLI sets this)
 *   2. CONSTELLA_DEV=1     → true
 *   3. fallback: NODE_ENV !== "production"
 */
export function isDevMode(): boolean {
  if (process.env.CONSTELLA_PUBLIC === "1") return false;
  if (process.env.CONSTELLA_DEV === "1") return true;
  return process.env.NODE_ENV !== "production";
}
