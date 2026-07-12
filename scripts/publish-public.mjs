#!/usr/bin/env node
/**
 * Push the CLEAN, OPEN-SOURCE tree to the PUBLIC repo (`public` remote = gabriel7silva/constella).
 *
 * The public repo is now FULL SOURCE (open-source): `src/`, docs, the launcher (bin/), runtime scripts,
 * the native skills library, config, and the generated DB migrations (drizzle/) — but NOT test config
 * (e2e/tests/playwright) or the internal release guide (the per-locale PUBLISHING.md), and no committed build
 * (the compiled `.next` reaches users through the npm tarball, not git). This script builds that filtered
 * tree in a temporary git index, secret-scans exactly what it will publish, and REFUSES on any finding. It
 * force-pushes a single clean root commit (dev history stays private). It never runs automatically.
 *
 *   node scripts/publish-public.mjs            # scan only (dry run)
 *   node scripts/publish-public.mjs --push     # scan, then force-push the clean source tree to `public main`
 */
import { execSync } from "node:child_process";
import { readFileSync, statSync, mkdtempSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PUSH = process.argv.includes("--push");

// Tracked paths that must NEVER reach the public repo: test config + the INTERNAL release guide (it names the
// private dev backup remote). `src/` is now PUBLISHED (open-source) — only these stay private.
const EXCLUDE = [
  "playwright.config.ts", "e2e", "tests",
  "docs/en/PUBLISHING.md", "docs/pt/PUBLISHING.md", // internal release guide (names the private dev remote)
];

// Mirror of src/server/git-scan.ts — sensitive filenames + high-confidence inline secret patterns.
const SENSITIVE_FILE = /(^|\/)(\.env(\.[\w.-]+)?|id_[rd]sa\w*|.*\.(pem|key|p12|pfx|keystore|jks|ppk|asc)|credentials?\.json|service[-_]?account[\w.-]*\.json|.*\.(sql|dump|bak|sqlite3?|db)|npm-debug\.log|.*\.local)$/i;
const ALLOW_FILE = /(\.env\.(example|sample|template|dist)|\.env-example)$/i;
// Legit source that the SENSITIVE_FILE regex over-matches: Drizzle migrations are DDL, not DB dumps.
const ALLOW_PATH = /^drizzle\/.*\.sql$/i;
// Obvious placeholder credentials in doc/example connection strings — not real secrets.
const PLACEHOLDER = /^(user|username|admin|root|pass|password|pwd|secret|example|changeme|x{3,}|your|host|localhost|db|name|app|<)/i;
const SECRETS = [
  ["AWS access key", /\bAKIA[0-9A-Z]{16}\b/],
  ["GitHub token", /\bgh[posru]_[A-Za-z0-9]{30,}\b/],
  ["GitHub fine-grained PAT", /\bgithub_pat_[A-Za-z0-9_]{40,}\b/],
  ["OpenAI/Anthropic key", /\bsk-[A-Za-z0-9_-]{20,}\b/],
  ["Google API key", /\bAIza[0-9A-Za-z_-]{30,}\b/],
  ["Slack token", /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/],
  ["Private key block", /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/],
  ["JWT", /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{6,}\b/],
  // DB URL with creds — only flag when the user:pass aren't obvious placeholders.
  ["DB URL with creds", /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp):\/\/([^\s:@/]+):([^\s:@/]+)@/, (m) => !PLACEHOLDER.test(m[1]) && !PLACEHOLDER.test(m[2])],
  ["Telegram bot token", /\b\d{6,}:[A-Za-z0-9_-]{35,}\b/],
];
const TEXT = /\.(c?m?[jt]sx?|json|md|css|ya?ml|toml|sh|env|txt|html?)$/i; // c?m? also covers .cjs/.cts/.mjs/.mts (tracked skill helpers)

const isExcluded = (f) => EXCLUDE.some((p) => f === p || f.startsWith(p + "/"));

// 1) Ensure the generated migrations exist (the public repo ships them; they build a fresh end-user
//    DB via `drizzle-kit migrate`). Generated from src/db/schema.ts, which exists in this dev tree.
if (!existsSync("drizzle") || readdirSync("drizzle").filter((f) => f.endsWith(".sql")).length === 0) {
  console.log("• Generating DB migrations (drizzle/) from the schema…");
  execSync("npx drizzle-kit generate --config drizzle.config.mjs", { stdio: "inherit" });
}

// 2) Compute exactly the file list that will be published: tracked files minus EXCLUDE, plus the
//    on-disk drizzle/ migrations (gitignored in this dev repo, force-added to the public tree).
const tracked = execSync("git ls-files", { encoding: "utf8" }).split("\n").map((s) => s.trim()).filter(Boolean);
// drizzle/ is gitignored in the dev repo, so list it straight off disk (cross-platform fs walk) — these
// generated migrations are force-added into the public tree below.
function walkDir(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) out.push(...walkDir(p));
    else out.push(p);
  }
  return out;
}
const drizzleFiles = existsSync("drizzle") ? walkDir("drizzle") : [];
const publishFiles = [...new Set([...tracked.filter((f) => !isExcluded(f)), ...drizzleFiles])];

// 3) Secret-scan exactly that set.
const findings = [];
for (const f of publishFiles) {
  if (SENSITIVE_FILE.test(f) && !ALLOW_FILE.test(f) && !ALLOW_PATH.test(f)) { findings.push(`${f}: sensitive file`); continue; }
  if (!TEXT.test(f)) continue;
  let body;
  try { if (statSync(f).size > 512 * 1024) continue; body = readFileSync(f, "utf8"); } catch { continue; }
  for (const [name, re, valid] of SECRETS) {
    if (valid) {
      // Validated pattern (DB URL): scan ALL matches — a placeholder match first must not hide a REAL
      // credential later in the file. `match()` returns only the first occurrence, so iterate.
      const gre = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
      let hit = false;
      for (const m of body.matchAll(gre)) { if (valid(m)) { hit = true; break; } }
      if (hit) { findings.push(`${f}: ${name}`); break; }
    } else {
      const m = body.match(re);
      if (m) { findings.push(`${f}: ${name}`); break; }
    }
  }
}
// Belt-and-suspenders: make sure the internal release guide never slips through.
const leaked = publishFiles.filter((f) => /(^|\/)PUBLISHING\.md$/.test(f));
if (leaked.length) findings.push(`internal PUBLISHING.md leaked into the public tree (${leaked.join(", ")}) — aborting`);

if (findings.length) {
  console.error(`\n✖ Refusing to publish — ${findings.length} potential secret/sensitive finding(s):`);
  for (const x of findings.slice(0, 30)) console.error("  - " + x);
  process.exit(1);
}
console.log(`✓ Clean: ${publishFiles.length} files to publish (full source, no secrets). Migrations: ${publishFiles.filter((f) => f.startsWith("drizzle/")).length} file(s).`);

if (!PUSH) {
  console.log("\nDry run. To publish the clean source tree to the public repo, run:");
  console.log("  node scripts/publish-public.mjs --push");
  process.exit(0);
}

// 4) Build the filtered tree in a TEMP git index (HEAD minus EXCLUDE, plus drizzle/), then push it
//    as a fresh root commit. Force-push = the public repo is a clean mirror, not a shared history.
console.log("\nStaging the clean public tree…");
const TMP_INDEX = join(mkdtempSync(join(tmpdir(), "constella-public-")), "index");
const env = { ...process.env, GIT_INDEX_FILE: TMP_INDEX, GIT_TERMINAL_PROMPT: "0" };
execSync("git read-tree HEAD", { env, stdio: "inherit" });
for (const p of EXCLUDE) execSync(`git rm -r --cached --ignore-unmatch -- "${p}"`, { env, stdio: "ignore" });
if (existsSync("drizzle")) execSync("git add -f -- drizzle", { env, stdio: "inherit" });
const tree = execSync("git write-tree", { env }).toString().trim();
const commit = execSync(`git commit-tree ${tree} -m "Constella — public source release (open-source mirror; no test config / build)"`, { env }).toString().trim();

console.log(`Pushing clean tree (${commit.slice(0, 9)}) to \`public\` (gabriel7silva/constella)…`);
// Fully-qualify the destination ref: pushing a bare commit object to `main` fails on an empty remote
// (git can't guess the ref). `refs/heads/main` creates/overwrites the branch deterministically.
execSync(`git push -f public ${commit}:refs/heads/main`, { stdio: "inherit", env });
console.log("✓ Pushed. The npm tarball (with the prebuilt .next) is published separately via `npm publish`.");
