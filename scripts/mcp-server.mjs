#!/usr/bin/env node
// Constella MCP server — exposes the public REST API (v1) as MCP tools so an AI client
// (Claude Desktop / Cursor / any MCP host) can drive Constella. Authenticates to Constella with a
// Personal Access Token. Self-contained: a hand-rolled JSON-RPC-over-stdio MCP server using only
// Node built-ins + global fetch (Node 18+), so it ships in the compiled distribution with no deps.
//
// Configure in an MCP client (env):
//   CONSTELLA_PAT       cn_… token from Profile → Personal access tokens (REQUIRED; use a write token
//                       to allow approve/execution/new-work, a read token for read-only)
//   CONSTELLA_BASE_URL  default http://localhost:3000
//   CONSTELLA_ORG       optional orgId (multi-org users) → sent as X-Constella-Org
//
// This is the OUTBOUND-to-Constella direction (an AI drives Constella). Constella's own agents
// consuming EXTERNAL MCPs is the other direction and works via the claude CLI's ~/.claude config.

import { createInterface } from "node:readline";

const PAT = process.env.CONSTELLA_PAT || "";
const BASE = (process.env.CONSTELLA_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
const ORG = process.env.CONSTELLA_ORG || "";
const SERVER_INFO = { name: "constella", version: "1.0.0" };

// ---- tools: thin maps onto the REST routes. `build(args)` → { method, path, body? }. ----
const S = (props = {}, required = []) => ({ type: "object", properties: props, required });
const TOOLS = [
  { name: "constella_status", description: "Counts of goals, issues, tasks and the plan state.", inputSchema: S(), build: () => ({ method: "GET", path: "/status" }) },
  { name: "constella_review", description: "A readable summary of the plan, issues, tasks and next steps.", inputSchema: S(), build: () => ({ method: "GET", path: "/review" }) },
  { name: "constella_goals", description: "List goals.", inputSchema: S(), build: () => ({ method: "GET", path: "/goals" }) },
  { name: "constella_issues", description: "List issues.", inputSchema: S(), build: () => ({ method: "GET", path: "/issues" }) },
  { name: "constella_tasks", description: "List tasks.", inputSchema: S(), build: () => ({ method: "GET", path: "/tasks" }) },
  { name: "constella_specs", description: "List specs.", inputSchema: S(), build: () => ({ method: "GET", path: "/specs" }) },
  { name: "constella_kb", description: "Ask the Knowledge Base a question.", inputSchema: S({ q: { type: "string", description: "the question" } }, ["q"]), build: (a) => ({ method: "POST", path: "/kb", body: { q: a.q } }) },
  { name: "constella_approve_plan", description: "Approve the pending plan and queue tasks (write scope).", inputSchema: S(), build: () => ({ method: "POST", path: "/plan/approve" }) },
  { name: "constella_reject_plan", description: "Send the plan back to the CEO for revision (write scope).", inputSchema: S({ reason: { type: "string", description: "why" } }), build: (a) => ({ method: "POST", path: "/plan/reject", body: { reason: a.reason } }) },
  { name: "constella_set_execution", description: "Turn 24/7 autonomous execution on or off (write scope).", inputSchema: S({ on: { type: "boolean" } }, ["on"]), build: (a) => ({ method: "POST", path: "/execution", body: { on: a.on !== false } }) },
  { name: "constella_new_work", description: "Start a new unit of work — the CEO drafts specs/issues for approval (write scope).", inputSchema: S({ brief: { type: "string" }, title: { type: "string" } }, ["brief"]), build: (a) => ({ method: "POST", path: "/work", body: { brief: a.brief, title: a.title } }) },
  { name: "constella_cancel_goal", description: "Cancel a goal by id (write scope).", inputSchema: S({ id: { type: "string" } }, ["id"]), build: (a) => ({ method: "POST", path: `/goals/${encodeURIComponent(a.id)}/cancel` }) },
  { name: "constella_archive_goal", description: "Archive a goal by id (write scope).", inputSchema: S({ id: { type: "string" } }, ["id"]), build: (a) => ({ method: "POST", path: `/goals/${encodeURIComponent(a.id)}/archive` }) },
];
const TOOL_BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));

async function callApi(method, path, body) {
  if (!PAT) return { ok: false, error: "CONSTELLA_PAT is not set" };
  const headers = { authorization: `Bearer ${PAT}` };
  if (ORG) headers["x-constella-org"] = ORG;
  if (body !== undefined) headers["content-type"] = "application/json";
  try {
    const res = await fetch(`${BASE}/api/v1${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30_000) });
    const json = await res.json().catch(() => ({ ok: false, error: `non-JSON response (http ${res.status})` }));
    return json;
  } catch (e) {
    return { ok: false, error: String(e?.message ?? e) };
  }
}

// ---- JSON-RPC over stdio (newline-delimited) ----
function send(msg) { process.stdout.write(JSON.stringify(msg) + "\n"); }
function result(id, r) { send({ jsonrpc: "2.0", id, result: r }); }
function error(id, code, message) { send({ jsonrpc: "2.0", id, error: { code, message } }); }

async function handle(msg) {
  const { id, method, params } = msg;
  const isRequest = id !== undefined && id !== null;
  switch (method) {
    case "initialize":
      return result(id, {
        protocolVersion: params?.protocolVersion || "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      });
    case "notifications/initialized":
      return; // notification, no reply
    case "ping":
      return result(id, {});
    case "tools/list":
      return result(id, { tools: TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })) });
    case "tools/call": {
      const tool = TOOL_BY_NAME.get(params?.name);
      if (!tool) return error(id, -32602, `unknown tool: ${params?.name}`);
      const req = tool.build(params?.arguments ?? {});
      const data = await callApi(req.method, req.path, req.body);
      const text = JSON.stringify(data, null, 2);
      return result(id, { content: [{ type: "text", text }], isError: data && data.ok === false });
    }
    default:
      if (isRequest) return error(id, -32601, `method not found: ${method}`);
  }
}

const rl = createInterface({ input: process.stdin });
rl.on("line", (line) => {
  const s = line.trim();
  if (!s) return;
  let msg;
  try { msg = JSON.parse(s); } catch { return; } // ignore non-JSON lines
  Promise.resolve(handle(msg)).catch((e) => {
    if (msg && msg.id !== undefined && msg.id !== null) error(msg.id, -32603, String(e?.message ?? e));
  });
});
rl.on("close", () => process.exit(0));
