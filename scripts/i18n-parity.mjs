#!/usr/bin/env node
/**
 * i18n parity guard. The `en` dict is the source of truth; `pt` is the runtime layer.
 * A missing `pt` key silently falls back to English (i18n.ts: `pt[key] ?? en[key] ?? key`),
 * so drift is invisible at runtime. This check fails CI when the two dicts diverge.
 *
 * Dependency-free on purpose: it parses src/lib/i18n.ts as text (the dicts are module-local
 * `const`s, not exported), so it runs under plain `node` with no build step.
 *
 * Usage: node scripts/i18n-parity.mjs   (wired as `pnpm parity` / part of `pnpm validate`)
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "src/lib/i18n.ts"), "utf8");

/** Slice the body of a `const <name>: Dict = { ... };` block and return its quoted keys. */
function keysOf(name, endMarker) {
  const start = src.indexOf(`const ${name}: Dict = {`);
  if (start === -1) throw new Error(`Could not find \`const ${name}: Dict = {\` in i18n.ts`);
  const end = src.indexOf("\n" + endMarker, start); // anchor to start-of-line so a translation VALUE containing the marker text can't truncate the key set
  if (end === -1) throw new Error(`Could not find end marker \`${endMarker}\` after \`${name}\``);
  const body = src.slice(start, end);
  const keys = new Set();
  const re = /^\s*"([^"]+)"\s*:/gm; // matches `  "some.key":` — comment lines (// …) never match
  let m;
  while ((m = re.exec(body))) keys.add(m[1]);
  return keys;
}

const en = keysOf("en", "const pt: Dict = {");
const pt = keysOf("pt", "const DICTS:");

const missingInPt = [...en].filter((k) => !pt.has(k)).sort();
const extraInPt = [...pt].filter((k) => !en.has(k)).sort();

console.log(`i18n parity: en=${en.size} keys, pt=${pt.size} keys`);

let failed = false;
if (missingInPt.length) {
  failed = true;
  console.error(`\n✗ ${missingInPt.length} key(s) in EN but MISSING in PT (would silently fall back to English):`);
  for (const k of missingInPt) console.error(`    ${k}`);
}
if (extraInPt.length) {
  failed = true;
  console.error(`\n✗ ${extraInPt.length} key(s) in PT but MISSING in EN (orphaned PT key):`);
  for (const k of extraInPt) console.error(`    ${k}`);
}

if (failed) {
  console.error(`\nFix: every key must exist in BOTH the en and pt dicts in src/lib/i18n.ts.`);
  process.exit(1);
}
console.log("✓ EN and PT dictionaries are in parity.");
