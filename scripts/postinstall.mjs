// Make the launcher executable on POSIX. The package is published from Windows, where the filesystem
// doesn't track the Unix executable bit — so on a Linux/macOS install the bins can land as 0644 and a
// global install fails with "/usr/bin/constella: Permission denied". This restores 0755. No-op on
// Windows (the bit is irrelevant there) and best-effort everywhere (never fails the install).
import { chmodSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

if (process.platform !== "win32") {
  const here = dirname(fileURLToPath(import.meta.url)); // …/scripts
  for (const rel of ["../bin/constella.mjs", "../bin/worker.mjs"]) {
    try { chmodSync(join(here, rel), 0o755); } catch { /* best-effort — never block the install */ }
  }
}
