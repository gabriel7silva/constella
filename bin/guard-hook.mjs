#!/usr/bin/env node
/**
 * Claude Code PreToolUse hook — destructive-command guard.
 *
 * Injected (when cmdGuard is on — opt-in, default off) into the agent's clean CLAUDE_CONFIG_DIR by
 * src/server/adapters/cli.ts. Before any Bash run it checks the command against a small deny-list of
 * clearly-catastrophic operations and BLOCKS them (exit 2 + a reason the model reads) so an agent can't
 * wipe the machine, force-push to a remote, or brick a disk. It is intentionally NARROW — only
 * unambiguously destructive patterns — and fails OPEN on anything else, so it never hard-stalls a legit
 * run. Self-contained (node built-ins only); makes no network calls.
 */
import { readFileSync, appendFileSync, mkdirSync } from "node:fs";

let ev = {};
try { ev = JSON.parse(readFileSync(0, "utf8")); } catch { process.exit(0); }
if (ev.tool_name !== "Bash") process.exit(0);
const cmd = String((ev.tool_input && ev.tool_input.command) || "");
if (!cmd.trim()) process.exit(0);

// [pattern, human reason]. Conservative: only catastrophic, low-false-positive shapes.
const DENY = [
  [/\brm\s+-[a-z]*r[a-z]*f[a-z]*\s+(?:-[a-z]+\s+)*(?:\/|~|\$HOME|\/\*|\.\.?)(?:\s|\/|$)/i, "recursive force-delete of a root / home / cwd path"],
  [/\brm\s+-[a-z]*f[a-z]*r[a-z]*\s+(?:-[a-z]+\s+)*(?:\/|~|\$HOME|\/\*|\.\.?)(?:\s|\/|$)/i, "recursive force-delete of a root / home / cwd path"],
  [/\bgit\s+push\b[^\n]*\s(?:--force\b|-f\b|--force-with-lease\b)/i, "force-push to a git remote"],
  [/\bgit\s+reset\s+--hard\b[^\n]*\borigin\//i, "hard reset onto a remote ref"],
  [/:\s*\(\s*\)\s*\{\s*:\s*\|\s*:\s*&?\s*\}\s*;\s*:/, "fork bomb"],
  [/\bmkfs(?:\.\w+)?\b/i, "filesystem format (mkfs)"],
  [/\bdd\b[^\n]*\bof=\/dev\//i, "raw write to a device (dd of=/dev/…)"],
  [/>\s*\/dev\/(?:sd|nvme|hd|disk|mapper)\w*/i, "redirect over a raw disk device"],
  [/\bchmod\s+-[a-z]*R[a-z]*\s+0?00\b/i, "recursive chmod 000"],
  [/\b(?:shutdown|reboot|halt|poweroff)\b/i, "power / shutdown command"],
  [/\b(?:curl|wget)\b[^\n|]*\|\s*(?:sudo\s+)?(?:sh|bash|zsh)\b/i, "pipe a downloaded script straight into a shell"],
];

for (const [re, why] of DENY) {
  if (re.test(cmd)) {
    // Bridge the denial to the server Inbox: append it to a workspace log the runner reads + clears
    // after the task. RAG indexes only .md, so this .jsonl never pollutes retrieval. Best-effort.
    try { mkdirSync(".claude", { recursive: true }); appendFileSync(".claude/guard-denials.jsonl", JSON.stringify({ at: new Date().toISOString(), why, cmd: cmd.slice(0, 300) }) + "\n"); } catch { /* ignore */ }
    process.stderr.write(`🛑 Blocked by Constella's safety guard (${why}). Do NOT run destructive system commands. Stay inside the project workspace; if you genuinely need this, stop and ask the operator instead of forcing it.\n`);
    process.exit(2); // block; Claude Code feeds stderr back to the model
  }
}
process.exit(0);
