// Runs on `prepack` (npm pack / npm publish): strip the parts of `.next` that `next start` does NOT
// need, so the published tarball ships only the production runtime. The dev-server artifacts
// (.next/dev — turbopack output + a multi-GB development log), the build cache, and trace files are
// regenerated locally by `next dev`/`next build` and must never travel to end users.
//
// npm's `files` allowlist re-includes the whole `.next` dir and overrides nested .npmignore rules, so
// deleting these on disk before packing is the reliable way to keep the package small + clean.
import { rmSync, existsSync } from "node:fs";
import { join } from "node:path";

const NEXT = join(process.cwd(), ".next");
if (!existsSync(NEXT)) {
  console.error("• trim-next: no .next/ — nothing to trim (skipping).");
  process.exit(0);
}
for (const sub of ["dev", "cache", "trace"]) {
  const p = join(NEXT, sub);
  if (existsSync(p)) {
    rmSync(p, { recursive: true, force: true });
    console.error(`• trim-next: removed .next/${sub}`);
  }
}
console.error("• trim-next: .next trimmed to the production runtime.");
