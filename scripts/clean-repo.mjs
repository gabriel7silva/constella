#!/usr/bin/env node
// Remove dead/scratch artifacts from the repo root before commit/publish. Idempotent + safe:
// only touches a known pattern set, never source/config. Run: `npm run clean`.
import { readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const EXACT = new Set(["Constella App.html", "extracted_design_system.css", "tsconfig.tsbuildinfo"]);
const matches = (name) =>
  EXACT.has(name) || /^temp_.*\.(jsx?|tsx?|html|css)$/i.test(name);

let removed = 0;
for (const name of readdirSync(ROOT)) {
  if (!matches(name)) continue;
  const p = join(ROOT, name);
  try {
    if (statSync(p).isFile()) { rmSync(p, { force: true }); console.log("removed", name); removed++; }
  } catch { /* skip */ }
}
console.log(removed ? `\nClean: removed ${removed} artifact(s).` : "Clean: nothing to remove.");
