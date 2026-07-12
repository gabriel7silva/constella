import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { launchDir } from "@/lib/runtime-root";

export const PKG_NAME = "constellai";

/**
 * The installed Constella version, read at runtime (bundling-safe).
 *  1. `CONSTELLA_VERSION` — set by the CLI from its own package.json (reliable for global/npx/portable/vps).
 *  2. the launch-dir package.json (dev / `next start` from the project root).
 *  3. "0.0.0" when nothing is readable.
 */
export function currentVersion(): string {
  if (process.env.CONSTELLA_VERSION) return process.env.CONSTELLA_VERSION;
  try {
    const p = JSON.parse(readFileSync(join(launchDir(), "package.json"), "utf8"));
    if (p?.version) return p.version as string;
  } catch { /* fall through */ }
  return "0.0.0";
}
