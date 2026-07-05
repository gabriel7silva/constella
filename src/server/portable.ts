import "server-only";
import { statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import os from "node:os";

/**
 * Portable-mode safety helpers: free-space validation and downloaded-file-size verification, so a USB
 * install never starts on a too-small drive and never installs a truncated/corrupt download. Reuses
 * the same OS disk-free probe as detectHardware (df / Get-PSDrive), no shell interpolation.
 */
export const PORTABLE_MIN_GB = 32;
// Minimum == recommended: 32 GB is enough to run Constella from a drive. More headroom only helps if you
// carry local models — it is not a requirement, so there is no separate "recommended" gate above the minimum.
export const PORTABLE_RECOMMENDED_GB = 32;

/** Free bytes on the volume that holds `path` (0 if the probe fails). */
export function freeBytes(path: string): number {
  try {
    if (os.platform() === "win32") {
      const d = (path[0] || "C").toUpperCase();
      const drive = /^[A-Z]$/.test(d) ? d : "C";
      const out = execFileSync("powershell", ["-NoProfile", "-Command", `(Get-PSDrive ${drive}).Free`], { timeout: 6000, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
      return Number(out.replace(/[^\d]/g, "")) || 0;
    }
    // df -k → column 4 = available in 1024-byte blocks (POSIX, macOS + Linux)
    const out = execFileSync("df", ["-k", path], { timeout: 5000, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    const lines = out.split("\n");
    const parts = (lines[lines.length - 1] ?? "").split(/\s+/);
    const availK = Number(parts[3]);
    return availK ? availK * 1024 : 0;
  } catch { return 0; }
}

export type UsbSpace = { ok: boolean; warn: boolean; freeGb: number; minGb: number; recommendedGb: number; message: string };

/** Validate a drive for a portable install: refuse < 32 GB (the minimum). */
export function checkUsbFreeSpace(path: string): UsbSpace {
  const freeGb = Math.round((freeBytes(path) / 1e9) * 10) / 10;
  const ok = freeGb >= PORTABLE_MIN_GB;
  const warn = ok && freeGb < PORTABLE_RECOMMENDED_GB; // always false (min == recommended); kept for API stability
  const message = !ok
    ? `Only ${freeGb} GB free — portable needs at least ${PORTABLE_MIN_GB} GB. Use a bigger drive (more headroom only helps if you carry local models).`
    : `${freeGb} GB free — good.`;
  return { ok, warn, freeGb, minGb: PORTABLE_MIN_GB, recommendedGb: PORTABLE_RECOMMENDED_GB, message };
}

export type SizeCheck = { ok: boolean; actual: number; expected: number; message: string };

/** Verify a downloaded file isn't truncated/incomplete. `expected` should be the HTTP Content-Length
 *  (the real size) — pass 0 when unknown to skip. Small tolerance catches truncation. */
export function verifyDownloadedFileSize(path: string, expected: number, tolerance = 0.02): SizeCheck {
  let actual = 0;
  try { actual = statSync(path).size; } catch { return { ok: false, actual: 0, expected, message: "file missing after download" }; }
  if (!expected || expected <= 0) return { ok: true, actual, expected, message: "size ok (no expected size)" };
  const ratio = actual / expected;
  const ok = ratio >= 1 - tolerance && ratio <= 1 + tolerance;
  return { ok, actual, expected, message: ok ? "size verified" : `size mismatch — got ${actual} bytes, expected ~${expected} (truncated/corrupt)` };
}
