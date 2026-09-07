import "server-only";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { runCommand } from "@/server/adapters/cli";

export type SecretFinding = { file: string; line: number; kind: string; preview: string };

/** Files that must NEVER be committed regardless of content (env/keys/dumps/local db). */
const SENSITIVE_FILE = /(^|\/)(\.env(\.[\w.-]+)?|id_[rd]sa\w*|.*\.(pem|key|p12|pfx|keystore|jks|ppk|asc)|credentials?\.json|service[-_]?account[\w.-]*\.json|.*\.(sql|dump|bak|sqlite3?|db)|npm-debug\.log|.*\.local)$/i;
/** …except the harmless templates. */
const ALLOW_FILE = /(\.env\.(example|sample|template|dist)|\.env-example)$/i;

/** High-confidence secret patterns (content). */
const PATTERNS: { kind: string; re: RegExp }[] = [
  { kind: "AWS access key", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { kind: "GitHub token", re: /\bgh[posru]_[A-Za-z0-9]{30,}\b/ },
  { kind: "GitHub fine-grained PAT", re: /\bgithub_pat_[A-Za-z0-9_]{40,}\b/ },
  { kind: "OpenAI/Anthropic key", re: /\bsk-[A-Za-z0-9_-]{20,}\b/ },
  { kind: "Google API key", re: /\bAIza[0-9A-Za-z_-]{30,}\b/ },
  { kind: "Slack token", re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { kind: "Private key", re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/ },
  { kind: "JWT", re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{6,}\b/ },
  { kind: "DB URL with credentials", re: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp):\/\/[^\s:@/]+:[^\s:@/]+@/i },
  { kind: "Telegram bot token", re: /\b\d{6,}:[A-Za-z0-9_-]{35,}\b/ },
  { kind: "Hardcoded secret", re: /\b(password|passwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|private[_-]?key)\b\s*[:=]\s*['"][^'"\n]{6,}['"]/i },
];
/** Skip obvious placeholders so the generic pattern doesn't block every commit. */
const PLACEHOLDER = /(your[_-]?|xxx+|<[^>]+>|change[_-]?me|example|placeholder|\*{3,}|•|dummy|todo|redacted|\.\.\.)/i;
const SKIP_DIR = /(^|\/)(node_modules|\.git|\.next|dist|build|out|\.turbo|coverage|uploads|archives|\.testdev|vendor)\//;

function redact(s: string): string { return s.length <= 10 ? "•••" : s.slice(0, 4) + "•••" + s.slice(-2); }

/**
 * Scan the files that WOULD be committed (working-tree changes; gitignored files are already
 * excluded by git status) for secrets, credentials, and must-never-commit files. Returns the
 * findings — the caller blocks the commit + routes them to the Inbox.
 */
export async function scanForSecrets(cwd: string): Promise<{ findings: SecretFinding[]; scanned: number; files: number }> {
  const st = await runCommand("git", ["status", "--porcelain", "-z", "--untracked-files=all"], { cwd });
  if (st.code !== 0) return { findings: [], scanned: 0, files: 0 };
  const files: string[] = [];
  const fields = st.stdout.split("\0");
  for (let i = 0; i < fields.length; i++) {
    const e = fields[i];
    if (!e || e.length < 3) continue;
    const x = e[0], y = e[1];
    const p = e.slice(3);
    if (x === "R" || x === "C" || y === "R" || y === "C") i++; // consume old-path field
    if (x === "D" || y === "D") continue; // deletions — nothing to scan
    if (!p || SKIP_DIR.test(p + "/")) continue;
    files.push(p);
  }

  const findings: SecretFinding[] = [];
  let scanned = 0;
  for (const rel of files.slice(0, 3000)) {
    if (SENSITIVE_FILE.test(rel) && !ALLOW_FILE.test(rel)) findings.push({ file: rel, line: 0, kind: "must-not-commit file", preview: rel.split("/").pop() ?? rel });
    const abs = join(cwd, rel);
    let size = 0;
    try { size = statSync(abs).size; } catch { continue; }
    if (size > 2 * 1024 * 1024) continue; // skip huge files
    let content = "";
    try { content = readFileSync(abs, "utf8"); } catch { continue; }
    if (content.includes("\0")) continue; // binary
    scanned++;
    const lines = content.split("\n");
    for (let i = 0; i < lines.length && findings.length < 300; i++) {
      const ln = lines[i];
      if (ln.length > 4000) continue;
      for (const { kind, re } of PATTERNS) {
        const m = re.exec(ln);
        if (!m) continue;
        if (kind === "Hardcoded secret" && PLACEHOLDER.test(m[0])) continue; // ignore placeholders, keep checking other patterns
        findings.push({ file: rel, line: i + 1, kind, preview: redact(m[0]) });
        break;
      }
    }
  }
  return { findings, scanned, files: files.length };
}
