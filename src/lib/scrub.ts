import "server-only";

/**
 * Last-line secret scrub for anything an agent reply could echo to the operator. The model is already
 * told (prompt-injection clause) never to reveal secrets; this is belt-and-suspenders applied at every
 * agent-reply → operator sink (Telegram, team room, DMs, notifications, the public API). Strips known
 * env secrets passed by the caller + common high-confidence credential shapes. Never throws.
 */

const ENV_SECRET_KEYS = ["CONSTELLA_VAULT_KEY", "BETTER_AUTH_SECRET", "CONSTELLA_WORKER_SECRET"];

// High-confidence inline secret shapes (mirrors the git-scan / Telegram scrubber, expanded).
const SECRET_SHAPES = new RegExp(
  [
    "sk-[A-Za-z0-9_-]{16,}", // OpenAI / Anthropic
    "gh[posru]_[A-Za-z0-9]{20,}", // GitHub token
    "github_pat_[A-Za-z0-9_]{40,}", // GitHub fine-grained PAT
    "AKIA[0-9A-Z]{16}", // AWS access key
    "AIza[0-9A-Za-z_-]{30,}", // Google API key
    "xox[baprs]-[A-Za-z0-9-]{10,}", // Slack token
    "eyJ[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{6,}", // JWT
    "-----BEGIN[\\s\\S]*?PRIVATE KEY-----[\\s\\S]*?-----END[\\s\\S]*?-----", // PEM private key
    "\\bcn_[A-Za-z0-9_-]{24,}\\b", // Constella PAT
    "\\b\\d{6,}:[A-Za-z0-9_-]{30,}\\b", // Telegram bot token
  ].join("|"),
  "g",
);

/** Redact env secrets (caller-supplied `extra` + the standard env keys) and inline secret shapes. */
export function scrubSecrets(text: string, extra: (string | undefined | null)[] = []): string {
  if (!text) return text;
  let out = text;
  for (const v of [...extra, ...ENV_SECRET_KEYS.map((k) => process.env[k])]) {
    if (v && v.length >= 8) out = out.split(v).join("[redacted]");
  }
  return out.replace(SECRET_SHAPES, "[redacted]");
}

/** Same scrub, for log lines that may interpolate agent/tool output. */
export function redactForLog(text: unknown): string {
  return scrubSecrets(String(text ?? ""));
}
