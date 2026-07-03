#!/usr/bin/env node
/**
 * Claude Code PreToolUse hook — per-file lock for safe PARALLEL agents.
 *
 * Injected (only when CONSTELLA_AGENT_LOCK_HOOK=1) into the agent's clean CLAUDE_CONFIG_DIR by
 * src/server/adapters/cli.ts. Before any Write/Edit/MultiEdit/NotebookEdit it asks the Constella
 * web server (loopback, worker-secret) to lock that file for this task/agent. If another agent holds
 * the file, it BLOCKS the tool (exit 2 + a reason the model reads) so the agent edits something else.
 *
 * Fails OPEN on anything unexpected (no context, network glitch, non-edit tool) — a hook problem must
 * never hard-stall a run.
 */
import { readFileSync } from "node:fs";

let ev = {};
try { ev = JSON.parse(readFileSync(0, "utf8")); } catch { process.exit(0); }

const EDIT_TOOLS = new Set(["Write", "Edit", "MultiEdit", "NotebookEdit"]);
if (!EDIT_TOOLS.has(ev.tool_name)) process.exit(0);

const input = ev.tool_input || {};
const file = input.file_path || input.notebook_path || "";
if (!file) process.exit(0);

const base = process.env.CONSTELLA_BASE_URL;
const secret = process.env.CONSTELLA_WORKER_SECRET;
const orgId = process.env.CONSTELLA_ORG_ID;
if (!base || !secret || !orgId) process.exit(0); // not enough context → allow

try {
  const res = await fetch(base.replace(/\/$/, "") + "/api/locks/acquire", {
    method: "POST",
    headers: { "content-type": "application/json", "x-worker-secret": secret },
    body: JSON.stringify({
      orgId, path: file,
      taskId: process.env.CONSTELLA_TASK_ID || "",
      agentId: process.env.CONSTELLA_AGENT_ID || "",
      agentHandle: process.env.CONSTELLA_AGENT_HANDLE || "",
    }),
    signal: AbortSignal.timeout(4000),
  });
  if (res.status === 423) {
    const j = await res.json().catch(() => ({}));
    const who = j && j.heldBy && j.heldBy.handle ? "@" + j.heldBy.handle : "another agent";
    process.stderr.write(`🔒 ${file} is being edited by ${who} right now — do NOT edit it. Work on a DIFFERENT file, or complete the other parts of your task and return to this file later.\n`);
    process.exit(2); // block; Claude Code feeds stderr back to the model
  }
} catch { /* network/timeout → fail open (allow the edit) */ }
process.exit(0);
