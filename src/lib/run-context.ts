import "server-only";
import { launchDir } from "@/lib/runtime-root";
import { getRunMode } from "@/lib/run-mode";
import { isDevMode } from "@/lib/build-mode";

export type RunContext = "dev" | "global" | "npx" | "vps" | "portable";

/**
 * How is this Constella process running? Drives the correct UPDATE method:
 *  - dev      → from source (git pull, no npm update)
 *  - vps      → native on a server (npm global behind a systemd service + Tailscale)
 *  - portable → from a USB drive (space-checked, verified)
 *  - npx      → ephemeral (re-run `npx constellai@latest`)
 *  - global   → `npm i -g constellai@latest`
 */
export function detectRunContext(): RunContext {
  if (isDevMode()) return "dev";                                   // running from source
  if (getRunMode() === "vps") return "vps";
  if (getRunMode() === "portable") return "portable";
  if (/[\\/]_npx[\\/]/.test(launchDir())) return "npx";            // npm's npx cache dir
  return "global";
}
