import "server-only";
import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { constellaHome } from "@/lib/fs-workspace";
import { detectRunContext } from "@/lib/run-context";
import { checkForUpdate } from "@/server/update-check";

export type UpdateResult = {
  ok: boolean;
  started?: boolean;
  context: string;
  command: string;
  message: string;
  backupDir?: string;
  needsRestart?: boolean;
  blocked?: boolean; // refused because an agent is actively working (a restart would kill its run)
};

const stamp = () => new Date().toISOString().replace(/[:.]/g, "-");
const resultFile = () => join(constellaHome(), "backups", "last-update.json");

/** Copy the important local config before updating (best-effort). */
export function backupBeforeUpdate(): string | null {
  try {
    const home = constellaHome();
    const dir = join(home, "backups", stamp());
    mkdirSync(dir, { recursive: true });
    for (const f of [".env", "constella.db", "constella.db-wal", "constella.db-shm"]) {
      const src = join(home, f);
      if (existsSync(src)) { try { copyFileSync(src, join(dir, f)); } catch { /* skip */ } }
    }
    return dir;
  } catch { return null; }
}

/** The detached updater's last result (UI polls this after starting a global update). */
export function getUpdateResult(): { status: "idle" | "running" | "done" | "error"; [k: string]: unknown } {
  try { return JSON.parse(readFileSync(resultFile(), "utf8")); } catch { return { status: "idle" }; }
}

/**
 * Apply the update for any global npm install, then restart — by launching the standalone self-updater
 * script (bin/constella-update.mjs) DETACHED + HIDDEN, so it survives the server going down and never
 * flashes a console window. The script stops the running Constella (killing the launcher AND its web +
 * worker children — REQUIRED on Windows, where `npm i -g` can't overwrite files the running process holds
 * open, and where process.kill neither cascades nor is catchable), runs `npm install -g <pkg>@latest`,
 * writes the result file the UI polls, then relaunches `constella --<mode>`. Keeping the logic in a real,
 * inspectable script — also runnable by hand via `constella update` — is more robust and debuggable than
 * an inline blob.
 */
/**
 * Apply the update on a VPS: spawn the standalone self-updater in `--mode vps` DETACHED, so it survives the
 * systemd unit being restarted. The script updates the global package via the NOPASSWD sudoers drop-in
 * (installed by vps-install.sh / vps-update.sh), writes the result the UI polls, then `systemctl restart`s
 * the unit — systemd cycles the whole cgroup onto the new code. The UI rides the brief downtime and reloads
 * once the server answers again. (Pre-0.3.4 installs that lack the sudoers drop-in must run the curl
 * one-liner once to get it; until then sudo -n fails and the result file reports an honest "error".)
 */
function spawnDetachedVpsUpdate(info: { latest: string | null }, command: string, backupDir?: string): UpdateResult {
  try {
    writeFileSync(resultFile(), JSON.stringify({ status: "running", to: info.latest, at: stamp() }));
    const home = constellaHome();
    const pkgRoot = process.env.CONSTELLA_PKG_ROOT || process.cwd();
    const script = join(pkgRoot, "bin", "constella-update.mjs");
    const verArgs = info.latest ? ["--version", info.latest] : [];
    const child = spawn(process.execPath, [script, "--quiet", "--mode", "vps", "--home", home, ...verArgs], { detached: true, stdio: "ignore", cwd: tmpdir() });
    child.unref();
    return { ok: true, started: true, needsRestart: true, context: "vps", command, backupDir, message: `Updating to ${info.latest} and restarting the service — this page reconnects in a few seconds.` };
  } catch (e) {
    return { ok: false, context: "vps", command, backupDir, message: "Couldn't launch the updater: " + String(e instanceof Error ? e.message : e) };
  }
}

function spawnDetachedNpmUpdate(info: { latest: string | null }, ctx: string, command: string, backupDir?: string): UpdateResult {
  try {
    writeFileSync(resultFile(), JSON.stringify({ status: "running", to: info.latest, at: stamp() }));
    const mode = process.env.CONSTELLA_RUN_MODE || "start";
    // The launcher exports its own pid; fall back to the parent pid for installs started before that existed.
    // The script also persists/derives this (run.json or the port listener), so a stale value still recovers.
    // Pass "0" (not process.ppid) when the launcher pid is unknown — on a global install ppid is the web
    // server's immediate parent (a shell/systemd), NOT the launcher; the updater then derives the real
    // launcher from the port listener, which is the reliable path.
    const launcherPid = process.env.CONSTELLA_LAUNCHER_PID || "0";
    const home = constellaHome();
    const port = process.env.PORT || "3000";
    const pkgRoot = process.env.CONSTELLA_PKG_ROOT || process.cwd();
    const script = join(pkgRoot, "bin", "constella-update.mjs");
    // cwd: tmpdir() — start the updater OUTSIDE the install dir so npm can rename `node_modules/constellai`
    // (it would inherit the server's cwd = the install dir otherwise → EBUSY on Windows). The script also
    // chdir()s to a safe dir itself; this is defense-in-depth.
    // Pass the EXACT version checkForUpdate resolved (not bare @latest) so a CDN-lagged npm `latest` tag can't
    // install an older build than the one the pill is offering.
    const verArgs = info.latest ? ["--version", info.latest] : [];
    const child = spawn(process.execPath, [script, "--quiet", "--pid", launcherPid, "--mode", mode, "--home", home, "--port", port, ...verArgs], { detached: true, stdio: "ignore", windowsHide: true, cwd: tmpdir() });
    child.unref();
    return { ok: true, started: true, needsRestart: true, context: ctx, command, backupDir, message: `Updating to ${info.latest} and restarting — this page reconnects in a few seconds.` };
  } catch (e) {
    return { ok: false, context: ctx, command, backupDir, message: "Couldn't launch the updater: " + String(e instanceof Error ? e.message : e) };
  }
}

/**
 * Apply an update using the method that fits how this process runs. Always backs up first; never
 * fabricates success. A global npm install — `--start` (local), host `--vps`, or `--portable` — updates
 * itself in the background (a detached `npm install -g` whose result the UI polls), then prompts a restart.
 * The cases that genuinely cannot self-update return the exact command instead: dev (from source), npx
 * (ephemeral), and a containerized `--vps` (the image is rebuilt from the host).
 */
export async function startUpdate(): Promise<UpdateResult> {
  const info = await checkForUpdate(true);
  const ctx = detectRunContext();
  const command = info.command;
  if (!info.updateAvailable) return { ok: true, context: ctx, command, message: "Already up to date." };

  const backupDir = backupBeforeUpdate() ?? undefined;

  if (ctx === "dev") return { ok: false, context: ctx, command, backupDir, message: "Running from source — update with: git pull && pnpm install && pnpm build" };
  if (ctx === "npx") return { ok: false, context: ctx, command, backupDir, message: "npx runs an ephemeral copy — re-run: npx constellai@latest" };
  // A VPS runs under a systemd service. We DON'T kill+relaunch by pid (systemd owns the process); instead the
  // detached updater installs the new package and `systemctl restart`s the unit, so this self-updates in place
  // from the button — same one-click flow as a global install. Needs the NOPASSWD sudoers drop-in from
  // vps-install.sh; the displayed command is the manual fallback if the updater can't launch.
  if (ctx === "vps") return spawnDetachedVpsUpdate(info, "bash scripts/vps-update.sh", backupDir);

  // global and --portable are global npm installs → self-update in the background.
  return spawnDetachedNpmUpdate(info, ctx, command, backupDir);
}
