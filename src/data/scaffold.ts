import { writeWorkspaceFile, readWorkspaceFile } from "../lib/fs-workspace";
import { buildReadme } from "./readme-template";
import { starterFor } from "./project-starter";
import { temperatureBehavior } from "./temperature";

/**
 * Workspace bootstrap generator. Produces COMPLETE, structured content for every
 * required file so a freshly-created organization workspace is immediately a
 * working operational system — never an empty tree. The directory is the brain:
 * loaders read these files to drive agents, skills, pulse, tools, routing,
 * memory, indexing, PO, docs and reports. An optional background Claude pass
 * later tailors/expands this baseline (see src/server/bootstrap.ts).
 */

export type AgentDef = { handle: string; name: string; role: string; color: string; reportsTo: string | null; model: string; provider: string; temperature: number; dailyCapUsd: number; tier: string; identity: string; ritual: string };

export const AGENT_DEFS: AgentDef[] = [
  { handle: "ada", name: "Ada", role: "CEO", color: "#e0a44e", reportsTo: null, model: "sonnet", provider: "cli_claude_code", temperature: 0.4, dailyCapUsd: 15, tier: "critical", identity: "Decisive, outcome-driven leader. Speaks in goals, not tasks. Protects scope and budget.", ritual: "Read the company goals, decompose into epics, delegate to leads, review what shipped." },
  { handle: "linus", name: "Linus", role: "CTO", color: "#9a5cff", reportsTo: "ada", model: "sonnet", provider: "cli_claude_code", temperature: 0.3, dailyCapUsd: 40, tier: "critical", identity: "Systems thinker. Balances delivery speed against technical debt.", ritual: "Turn epics into tickets, route work to specialists, clear blockers, review PRs." },
  { handle: "donald", name: "Donald", role: "Product Owner", color: "#4fc9b0", reportsTo: "ada", model: "haiku", provider: "cli_claude_code", temperature: 0.4, dailyCapUsd: 20, tier: "heavy", identity: "Customer voice. Ruthless about priority and clarity.", ritual: "Groom the backlog with MoSCoW, plan the sprint, track delivery, close with a retro." },
  { handle: "margaret", name: "Margaret", role: "Backend", color: "#3fb98f", reportsTo: "linus", model: "sonnet", provider: "cli_claude_code", temperature: 0.3, dailyCapUsd: 50, tier: "heavy", identity: "Pragmatic server engineer. Values correctness, small diffs and green tests.", ritual: "Pull one ticket, read context, implement on a branch, never push without a passing suite." },
  { handle: "grace", name: "Grace", role: "Frontend", color: "#5b8def", reportsTo: "linus", model: "sonnet", provider: "cli_claude_code", temperature: 0.5, dailyCapUsd: 45, tier: "heavy", identity: "Craft-focused UI engineer. Cares about accessibility and clean component APIs.", ritual: "Read the design tokens, build the smallest component that works, typecheck before PR." },
  { handle: "edsger", name: "Edsger", role: "QA", color: "#e8688f", reportsTo: "linus", model: "haiku", provider: "cli_claude_code", temperature: 0.2, dailyCapUsd: 25, tier: "heavy", identity: "Skeptical quality gate. Assumes nothing works until proven by a test.", ritual: "Reproduce, cover with a test, run the suite, then gate the sign-off." },
  { handle: "werner", name: "Werner", role: "DevOps", color: "#f0a35e", reportsTo: "linus", model: "haiku", provider: "cli_claude_code", temperature: 0.3, dailyCapUsd: 20, tier: "heavy", identity: "Reliability-minded operator. Automates the boring, guards the leases.", ritual: "Build, deploy a preview, report the URL, never leave an env leased too long." },
  { handle: "barbara", name: "Barbara", role: "Docs", color: "#b3d97a", reportsTo: "ada", model: "haiku", provider: "cli_claude_code", temperature: 0.4, dailyCapUsd: 15, tier: "light", identity: "Patient explainer. Turns changes into understandable docs.", ritual: "Watch merges, draft docs while context is fresh, verify every link." },
  { handle: "whitfield", name: "Whitfield", role: "CyberSec", color: "#c4a0ff", reportsTo: "linus", model: "opus", provider: "cli_claude_code", temperature: 0.2, dailyCapUsd: 30, tier: "critical", identity: "Adversarial reviewer. Thinks like an attacker, writes like an auditor.", ritual: "Audit every change for secret handling and injection, file findings with a concrete fix." },
  { handle: "vannevar", name: "Vannevar", role: "Knowledge", color: "#7ac5e0", reportsTo: "ada", model: "haiku", provider: "cli_claude_code", temperature: 0.2, dailyCapUsd: 10, tier: "light", identity: "Keeper of the company's semantic memory. Indexes every document AND conversation into embeddings so any agent can recall anything instantly.", ritual: "Keep the embedding server healthy; re-index the workspace docs and the chat (team room, DMs, Telegram) into the RAG index so retrieval stays current." },
];

export const SKILL_DEFS = [
  { name: "open-pr", summary: "Branch, commit, open a PR with a test plan and request CTO review.", trigger: "When a work product is ready to merge", steps: ["Create a branch from main", "Commit the change set", "Open a PR with summary + test plan", "Request review from the CTO"] },
  { name: "run-suite", summary: "Detect the package manager, run the test task and gate sign-off on red.", trigger: "Before any sign-off", steps: ["Detect package manager", "Run the workspace test task", "Parse results", "Block sign-off if red"] },
  { name: "secret-scan", summary: "Scan for plaintext keys, verify vault references and flag log leaks.", trigger: "On every adapter change", steps: ["Grep for plaintext keys", "Check vault references", "Flag any echo to logs"] },
  { name: "telegram-notify", summary: "Format a digest and POST it to the Telegram Bot API.", trigger: "When a routine completes", steps: ["Format the digest", "Resolve the chat id from secrets", "POST to Telegram Bot API"] },
  { name: "moscow-prioritise", summary: "Score backlog items and re-order them with the MoSCoW method.", trigger: "During backlog grooming", steps: ["Score each item", "Assign Must/Should/Could/Won't", "Re-order the backlog"] },
  { name: "gguf-validate", summary: "Pull a GGUF, verify SHA-256 and bind to loopback.", trigger: "When installing a local model", steps: ["Download the GGUF", "Verify SHA-256", "Bind to 127.0.0.1 only"] },
];

export type ScaffoldCtx = {
  orgId: string;
  slug: string;
  company: string;
  mission: string;
  objective: string;
  stack: Record<string, string>;
  runMode?: string;
  createdAt?: string;
  preserveReadme?: boolean; // imported project → don't write the generated README over the repo's own
};

const enabledForAll = SKILL_DEFS.filter((s) => s.name !== "telegram-notify" && s.name !== "gguf-validate").map((s) => s.name);
function skillsForRole(role: string): string[] {
  // DevOps owns local-model installs (the gguf-validate trigger), so it gets BOTH. (The old `|| role ===
  // "DevOps"` second arm was dead — the first arm already caught DevOps — so DevOps never got gguf-validate.)
  const extra = role === "DevOps" ? ["telegram-notify", "gguf-validate"] : role === "Backend" ? ["gguf-validate"] : [];
  return [...new Set([...enabledForAll, ...extra])];
}

/* ----------------------------------------------------------------- .claude/ control files */
function organizationMd(c: ScaffoldCtx) {
  return `---
orgId: ${c.orgId}
slug: ${c.slug}
name: ${c.company}
runMode: ${c.runMode ?? "start"}
created: ${c.createdAt ?? "(set at creation)"}
---
# ${c.company} — Organization

- **Organization ID:** \`${c.orgId}\` (stable; never changes even if the name does)
- **Workspace path:** \`~/.constella/organizations/${c.orgId}/workspace/\`
- **Runtime mode:** ${c.runMode ?? "start"} (local · auth · vps · portable)

## Mission
${c.mission || "_Define the company mission._"}

## Objective
${c.objective || "_Define the current objective._"}

## Active modules
Dashboard · Agents · Skills · Product · Planner · Docs · Reports · Code · Costs · Models · Security · Pulse · Chat.

## Default agents
${AGENT_DEFS.map((a) => `- **${a.name}** (@${a.handle}) — ${a.role}${a.reportsTo ? `, reports to @${a.reportsTo}` : ""}`).join("\n")}

## Organization rules
1. The directory is the source of truth; the database only indexes it.
2. Every agent and the Code editor are locked to THIS workspace — no access outside it.
3. Plan before building; every change passes a security review before merge.
4. Respect per-agent daily budget ceilings; stop at the cap.
`;
}

function workspaceMd(c: ScaffoldCtx) {
  return `# Workspace structure

This workspace is the operational brain of **${c.company}**. The platform reads these
files to operate; editing a file in the UI writes it back here, and editing it here is
picked up by the sync engine.

## Folders
| Path | Responsibility |
|---|---|
| \`.claude/\` | Control layer — org/workspace config, permissions, memory, routing, indexing, settings; agents & skills (read by the Claude CLI). |
| \`DOCS/\` | Documentation — architecture, API, database, standards, onboarding. |
| \`PO/\` | Product ownership — roadmap, backlog, sprint, requirements, user stories. |
| \`Reports/\` | System & agent reports — status, health, pulse, daily/weekly, errors. |
| \`specs/\` \`issues/\` | Planner output — specs and the issues agents implement. |
| _(project source)_ | The product the agents build. |

## File naming & Markdown rules
- Lower-case, hyphenated file names (\`sprint-plan.md\`).
- Each document opens with a single H1 title; use \`## Section\` headings the loaders parse.
- Optional YAML front-matter (\`---\`) for machine-readable fields.

## Sync behavior
- **Write-through:** UI edits write the \`.md\` immediately, then re-index.
- **Watcher:** external/agent edits are detected and re-indexed disk → DB.
- The DB is an index/cache only; this directory wins on conflict.

## Code module binding & isolation
The Code module opens ONLY this organization's workspace. The editor and every agent
are sandboxed here and cannot read, write or delete anything outside it.
`;
}

function permissionsMd(c: ScaffoldCtx) {
  return `# Permissions

Defines who may do what inside this workspace. The agent CLI sandbox (\`.claude/settings.json\`)
and the runner enforce these boundaries.

## File access boundary
- **Allowed root:** \`~/.constella/organizations/${c.orgId}/workspace/\` and everything beneath it.
- **Forbidden paths:** the user home, \`Documents\`, \`Desktop\`, any other organization's
  directory, and anything outside the allowed root. Path traversal is rejected.

## User permissions
- Full read/write across this workspace via the UI.
- May connect providers, approve plans, manage budgets, switch organizations.

## Agent permissions
- Read / create / edit / delete / search **only inside this workspace** (cwd-jailed).
- Spend up to the agent's daily budget cap, then stop.
- Never exfiltrate secrets; secrets are referenced from the vault, never inlined.

## Tool permissions
- File tools auto-accept edits **within the workspace** (\`acceptEdits\`); no outside access.
- Bash is workspace-scoped; network/deploy tools require an explicit, configured integration.

## Deletion & security rules
- Deletions are workspace-scoped and revalidated; the runtime root is never deleted.
- No plaintext keys in any file or log; use vault references.
`;
}

function memoryMd() {
  return `# Memory

How the workspace remembers context across sessions, chats and DMs.

## What may be remembered
- Decisions, requirements, task state, files referenced, agent actions, pending work,
  and explicit operator instructions.

## What must NOT be remembered
- Secrets, tokens, API keys, passwords, or any vault material.
- Personal data not required to do the work.

## Storage & linkage
- Long-lived context lives in this workspace (linked from here), not in an isolated store.
- The database indexes summaries for fast recall; the directory holds the canonical text.

## Chat & DM compaction
- When a conversation grows past the active model's context budget, older messages are
  summarized into a compact context that PRESERVES decisions, tasks, files and instructions.
- Compaction is **model-aware**: a smaller model receives a more aggressive summary; a larger
  model keeps more detail. The compacted context is linked back to this workspace.
`;
}

function routingMd() {
  return `# Routing

How work is routed to agents, skills and tools.

## Task → agent
| Work type | Owner |
|---|---|
| Strategy / goals / approvals | @ada (CEO) |
| Architecture / tickets / PR review | @linus (CTO) |
| Backlog / sprint / priorities | @donald (Product Owner) |
| Server / API / data | @margaret (Backend) |
| UI / components | @grace (Frontend) |
| Tests / sign-off | @edsger (QA) |
| Build / deploy / infra | @werner (DevOps) |
| Docs | @barbara (Docs) |
| Security review | @whitfield (CyberSec) |
| Knowledge / RAG / embeddings / memory | @vannevar (Knowledge) |

## Skill & tool selection
- An agent selects a skill when its **trigger** matches the task (see \`.claude/skills/\`).
- Tools are chosen from the agent's \`tools.md\`; only workspace-scoped tools are permitted.

## Escalation & blocked tasks
- A blocked task is raised to the agent's \`reportsTo\`; budget blocks raise an inbox item.
- Unrecoverable failures are logged to \`Reports/error-report.md\` and surfaced to the operator.
`;
}

function indexMd() {
  return `# Index

How the workspace is indexed into the database for search and recall.

## Indexed folders & types
- \`.claude/skills/*.md\`, \`.claude/agents/*/Agent.md\` + \`skills.md\`, \`DOCS/*.md\`, \`PO/*.md\`, \`Reports/*.md\`.
- Markdown only for documents; code files are indexed for path + language + git status.

## Parsing
- YAML front-matter → structured fields; \`## Section\` blocks → addressable sections.
- First non-heading line → summary; \`**Trigger:**\` lines → skill triggers.

## Embeddings & ranking
- Document summaries are embedded for semantic search; results rank by relevance then recency.

## Stale-index refresh
- Write-through re-indexes on every UI edit; the watcher re-indexes external edits.
- A full \`indexWorkspace()\` reconciles everything on demand / on workspace load.
`;
}

function claudeMd(c: ScaffoldCtx) {
  const stackList = Object.entries(c.stack).map(([k, v]) => `- **${k}**: ${v}`).join("\n") || "- _(declare the stack)_";
  return `# ${c.company} — Operating Manual

## Mission
${c.mission || "_Define the mission._"}

## Objective
${c.objective || "_Define the objective._"}

## Stack
${stackList}

## How this workspace works
Agents read their persona from \`.claude/agents/<handle>/\`. Skills live in \`.claude/skills/\`.
Plan before building; every change passes a security review before merge. All file work is
restricted to this organization's workspace directory.
`;
}

function settingsJson() {
  return JSON.stringify({
    permissions: { defaultMode: "acceptEdits", allow: ["Read", "Edit", "Write", "Bash"], deny: [], additionalDirectories: [] },
    note: "Agents are jailed to this workspace (cwd). Do not add additionalDirectories outside it.",
  }, null, 2) + "\n";
}

/* ----------------------------------------------------------------- agents/<handle>/ */
function agentMd(a: AgentDef, c: ScaffoldCtx) {
  return `---
handle: ${a.handle}
name: ${a.name}
role: ${a.role}
reportsTo: ${a.reportsTo ?? "null"}
provider: ${a.provider}
model: ${a.model}
temperature: ${a.temperature}
dailyCapUsd: ${a.dailyCapUsd}
tierFloor: ${a.tier}
---
# ${a.name} — ${a.role}

**Identity:** ${a.identity}

**Ritual:** ${a.ritual}

## Responsibilities
- Own the ${a.role} function for ${c.company}; deliver outcomes, not busywork.
- Follow the rituals above every working cycle.

## Communication style
- Concise and direct. Lead with the decision or result, then the reasoning.

## Behavior
${temperatureBehavior(a.temperature)}

## Decision-making rules
- Optimise for the company objective: "${c.objective || "ship value"}".
- Prefer the smallest change that works; escalate when blocked${a.reportsTo ? ` to @${a.reportsTo}` : ""}.

## Execution rules
- Work one item at a time to completion. Stop at the daily budget cap ($${a.dailyCapUsd}).
- Use the skills listed in \`skills.md\`; use only the tools listed in \`tools.md\`.

## Workspace boundaries
- All file operations are restricted to this organization's workspace directory.
- Never read, write or delete anything outside it.

## Working with the Code module
- Read context from the workspace before editing; make small, reviewable diffs.
- Edit and create files directly on disk (the directory is the source of truth).

## Collaboration
- Coordinate via the team room / DMs; hand off across roles per \`.claude/routing.md\`.

## Allowed
- Read, create, edit, delete and search files **inside this workspace**.

## Not allowed
- Touch any path outside the workspace; inline secrets; exceed the budget cap.

## System prompt
You are ${a.name}, the ${a.role} of ${c.company}. ${a.identity} Ritual: ${a.ritual} Always
follow the skill procedures, stay within this workspace directory, and stop at your budget ceiling.
`;
}

function pulseMd(a: AgentDef) {
  return `# Pulse — ${a.name}

intervalSec: 30
maxMissed: 2
wakeOn:
  - queued_task
  - mention
healthCheck: 1-token ping to ${a.provider} (${a.model})

## Liveness checks
- **Alive:** a pulse was recorded within \`intervalSec * maxMissed\`.
- **Functional:** the agent's executor (CLI/provider) responds to the health ping.
- **Blocked:** the agent has work but cannot proceed (budget, dependency, error).

## Wake / recover
- The sweep wakes a stale agent when it has a \`queued_task\` or is \`@mentioned\`.
- On repeated failure, mark **down**, log to \`Reports/error-report.md\`, and recover on the next healthy ping.

## Status values
\`idle\` · \`working\` · \`review\` · \`blocked\` (status) — \`alive\` · \`stale\` · \`down\` (health).

## Reporting
- Each sweep writes \`Reports/agent-status.md\` and \`Reports/system-health.md\`.
- Errors are appended to \`Reports/error-report.md\`.
`;
}

function toolsMd(a: AgentDef) {
  const tools = a.role === "CyberSec" ? ["secret-scan", "review.signoff", "fs.read"]
    : a.role === "DevOps" ? ["run-suite", "deploy.preview", "telegram-notify"]
    : a.role === "Backend" || a.role === "Frontend" ? ["fs.read", "fs.write", "run-suite", "open-pr"]
    : a.role === "QA" ? ["run-suite", "review.gate"]
    : a.role === "Docs" ? ["fs.read", "fs.write"]
    : a.role === "Knowledge" ? ["fs.read", "rag.reindex", "rag.index-chat", "embed.health"]
    : ["core.delegate", "core.approve"];
  return `# Tools — ${a.name}

Provider: ${a.provider} · Model: ${a.model}

| Tool | Purpose | Allowed | Forbidden |
|---|---|---|---|
${tools.map((t) => `| \`${t}\` | ${t.includes("fs") ? "Workspace file access" : t.includes("run") ? "Run the test suite" : t.includes("deploy") ? "Preview deploy" : t.includes("review") ? "Review / sign-off" : "Core action"} | inside this workspace | any path outside the workspace |`).join("\n")}

## File access rules
- All file operations are restricted to this organization's workspace (cwd-jailed).
- Reads/edits/writes auto-accept **inside** the workspace; nothing outside is reachable.

## Execution limits & safety
- Stop at the daily budget cap ($${a.dailyCapUsd}). Never inline or echo secrets.
- Use a tool only when its purpose matches the task; otherwise skip it.
`;
}

function skillsMd(a: AgentDef) {
  const enabled = skillsForRole(a.role);
  return `# Skills — ${a.name}

Assigned procedures. Each links to a real file in \`../../skills/\`.

${enabled.map((s) => {
  const def = SKILL_DEFS.find((d) => d.name === s);
  return `## \`${s}\`
- **File:** \`.claude/skills/${s}.md\`
- **Use when:** ${def?.trigger ?? "as appropriate"}
- **Summary:** ${def?.summary ?? ""}`;
}).join("\n\n")}

## Rituals
${a.ritual}
`;
}

function skillFile(s: typeof SKILL_DEFS[number]) {
  return `# Skill — ${s.name}

**Trigger:** ${s.trigger}

${s.summary}

## When to use
${s.trigger}.

## When NOT to use
- When the trigger condition is absent, or a more specific skill applies.

## Required context & inputs
- Read the relevant workspace files first; gather the inputs each step needs.

## Procedure
${s.steps.map((x, i) => `${i + 1}. ${x}`).join("\n")}

## Output format
- A concise result plus any files created/edited (paths relative to the workspace).

## Quality & validation rules
- Verify each step succeeded before the next; never report success on a failed step.

## Failure handling
- Stop, record what failed and why, and surface it (inbox / \`Reports/error-report.md\`).

## Related
- Files: this workspace. Agents: whoever owns the matching role in \`.claude/routing.md\`.
`;
}

/** The four persona files for one agent — reused by the boot roster-backfill to add an agent to an
 *  already-onboarded workspace with the exact same templates. */
export function agentFiles(a: AgentDef, c: ScaffoldCtx): [string, string][] {
  const base = `.claude/agents/${a.handle}`;
  return [
    [`${base}/Agent.md`, agentMd(a, c)],
    [`${base}/pulse.md`, pulseMd(a)],
    [`${base}/tools.md`, toolsMd(a)],
    [`${base}/skills.md`, skillsMd(a)],
  ];
}

/* ----------------------------------------------------------------- DOCS / PO / Reports */
function doc(title: string, body: string) { return `# ${title}\n\n${body}\n`; }

function docsFiles(c: ScaffoldCtx): [string, string][] {
  const s = c.stack;
  return [
    ["DOCS/architecture.md", doc("Architecture", `Runtime: ${s.runtime ?? "Node.js"} · Frontend: ${s.frontend ?? "React"} · Backend: ${s.backend ?? "—"}\nDatabase: ${s.database ?? "SQLite"} · ORM: ${s.orm ?? "Drizzle"}\n\n## Overview\n${c.company} is built to: ${c.mission || "deliver value"}.\n\n## Layout\n- server/   API + scheduler\n- ui/       dashboard\n- packages/ shared + adapters\n\n## Key decisions\n- The workspace directory is the source of truth; the DB indexes it.`)],
    ["DOCS/api.md", doc("API", `## Conventions\n- REST/RPC endpoints are documented here as they are built.\n- Request/response shapes, auth, and error codes go in this file.\n\n## Endpoints\n_(none yet — agents document endpoints here as they ship.)_`)],
    ["DOCS/database.md", doc("Database", `Engine: ${s.database ?? "SQLite"} · ORM: ${s.orm ?? "Drizzle"}\n\n## Schema\n_(document tables, columns and relationships here as the data layer is built.)_\n\n## Migrations\n- Never wipe to apply changes; use surgical, additive migrations.`)],
    ["DOCS/code-standards.md", doc("Code standards", `- Match the surrounding code's style, naming and idioms.\n- Small, reviewable diffs; typecheck before every PR.\n- Every change passes a security review before merge.\n- No plaintext secrets; reference the vault.`)],
    ["DOCS/onboarding.md", doc("Onboarding", `Welcome to ${c.company}.\n\n## First steps\n1. Read \`.claude/CLAUDE.md\` (the operating manual).\n2. Skim \`DOCS/architecture.md\` and \`PO/roadmap.md\`.\n3. Pull a task from the board and follow your agent ritual.`)],
    ["DOCS/system-operation.md", doc("System operation guide", `## Runtime modes\n- start (local) · auth · vps · portable.\n\n## Pulse\n- Agents are health-checked on an interval; status lands in \`Reports/\`.\n\n## Budgets\n- Each agent has a daily cap; the system stops it at the ceiling.`)],
    ["DOCS/workspace-structure.md", doc("Workspace structure guide", `See \`.claude/workspace.md\` for the authoritative structure. This workspace lives at\n\`~/.constella/organizations/${c.orgId}/workspace/\` and is isolated from every other org.`)],
  ];
}

function poFiles(c: ScaffoldCtx): [string, string][] {
  return [
    ["PO/roadmap.md", doc("Roadmap", `## Now\n- Ship ${c.company} v0.1 — ${c.objective || "first release"}.\n\n## Next\n- Harden, document, and gather feedback.\n\n## Later\n- Scale and expand per the mission: ${c.mission || "—"}.`)],
    ["PO/backlog.md", doc("Backlog (MoSCoW)", `- [Must] Ship ${c.company} v0.1\n- [Must] Pass the security gate\n- [Should] Portable build\n- [Could] Self-update with rollback\n- [Won't] (track out-of-scope items here)`)],
    ["PO/sprint-plan.md", doc("Sprint plan", `## Sprint 1 — goal\nStand up the foundation of ${c.company}.\n\n## Committed\n_(the Product Owner pulls Must items here and assigns owners.)_`)],
    ["PO/user-stories.md", doc("User stories", `- As an operator, I can create an organization and get a working workspace immediately.\n- As an operator, I can watch agents do real work inside my workspace.\n- _(add stories as the product takes shape.)_`)],
    ["PO/requirements.md", doc("Requirements", `## Functional\n- The directory is the source of truth; the DB indexes it.\n- Agents and the editor are isolated to the active workspace.\n\n## Non-functional\n- No fabricated data; honest empty states; budget ceilings respected.`)],
    ["PO/priorities.md", doc("Priorities", `1. Correctness & isolation\n2. Real, working features (no fakes)\n3. Developer/operator clarity\n4. Polish`)],
    ["PO/acceptance-criteria.md", doc("Acceptance criteria", `- A new workspace is never empty and passes validation.\n- Editing a doc in the UI writes it to disk and re-indexes.\n- Agents cannot touch anything outside the workspace.`)],
    ["PO/status.md", doc("Execution status", `_(the Product Owner updates delivery status here each cycle.)_`)],
  ];
}

function reportsFiles(c: ScaffoldCtx): [string, string][] {
  const stamp = c.createdAt ?? "(creation)";
  return [
    ["Reports/agent-status.md", doc("Agent status", `_Snapshot at scaffold; refreshed by the pulse sweep._\n\n| Agent | Status | Health | Last pulse |\n|---|---|---|---|\n${AGENT_DEFS.map((a) => `| @${a.handle} | idle | alive | ${stamp} |`).join("\n")}`)],
    ["Reports/system-health.md", doc("System health", `_Snapshot at scaffold; refreshed by the pulse sweep._\n\n- Status: awaiting first pulse sweep\n- Agents: ${AGENT_DEFS.length}\n- Created: ${stamp}`)],
    ["Reports/pulse-history.md", doc("Pulse history", `_Append-only log of pulse sweeps._\n\n- ${stamp} — workspace bootstrapped.`)],
    ["Reports/daily-report.md", doc("Daily report", `_Template — an agent fills this each day._\n\n## Wins\n## Blockers\n## Next`)],
    ["Reports/weekly-report.md", doc("Weekly report", `_Template — filled each week._\n\n## Shipped\n## Metrics\n## Next week`)],
    ["Reports/error-report.md", doc("Error report", `_Append-only log of failures and recoveries._`)],
    ["Reports/task-execution.md", doc("Task execution report", `_Append-only log of task runs (agent, task, result, cost)._`)],
  ];
}

/* ----------------------------------------------------------------- assembly */
/** The full set of required files for a workspace, as [relativePath, content]. */
export function workspaceFiles(c: ScaffoldCtx): [string, string][] {
  const files: [string, string][] = [
    [".claude/organization.md", organizationMd(c)],
    [".claude/workspace.md", workspaceMd(c)],
    [".claude/permissions.md", permissionsMd(c)],
    [".claude/memory.md", memoryMd()],
    [".claude/routing.md", routingMd()],
    [".claude/index.md", indexMd()],
    [".claude/CLAUDE.md", claudeMd(c)],
    [".claude/settings.json", settingsJson()],
  ];
  for (const a of AGENT_DEFS) {
    const base = `.claude/agents/${a.handle}`;
    files.push([`${base}/Agent.md`, agentMd(a, c)]);
    files.push([`${base}/pulse.md`, pulseMd(a)]);
    files.push([`${base}/tools.md`, toolsMd(a)]);
    files.push([`${base}/skills.md`, skillsMd(a)]);
  }
  for (const s of SKILL_DEFS) files.push([`.claude/skills/${s.name}.md`, skillFile(s)]);
  files.push(...docsFiles(c), ...poFiles(c), ...reportsFiles(c));
  files.push(["specs/README.md", doc("Specs", "The CEO Planner writes detailed specs here, then breaks them into issues.")]);
  files.push(["issues/README.md", doc("Issues", "Approved issues the agents implement (1–999).")]);
  // Design module — visual prototyping BEFORE the plan. `design-skills/` holds design-specific skills the
  // frontend agent (Grace) + CEO Planner consult; `design-mock/` holds everything the Design module produces
  // (mocks, screens, screenshots, design system, decisions) and `APPROVED.md` — the official visual reference.
  files.push(["design-skills/README.md", doc("Design skills", "Design-specific skills (design system, palette, typography, spacing, UI/UX patterns, motion, accessibility) the frontend agent and CEO Planner consult while prototyping. Drop SKILL.md-style notes here; they are indexed into the KB/RAG.")]);
  files.push(["design-mock/README.md", doc("Design mock", "Everything the Design module produces: mocks, prototypes, screens, visual variations, screenshots, handoff files, visual docs, UI/UX decisions, proposed components, design system, palette, typography, spacing, visual states, and user annotations. The approved design is written to `design-mock/APPROVED.md` — the official visual reference the CEO Planner turns into specs, issues and the plan (zero drift).")]);
  // Skip the generated README when a project was imported (GitHub/local) — its OWN README must win.
  if (!c.preserveReadme) files.push(["README.md", buildReadme({ company: c.company, mission: c.mission, objective: c.objective, stack: c.stack, slug: c.slug })]);
  return files;
}

/** Write the FULL filled workspace to disk (overwrites). Never leaves a required file empty. */
export function bootstrapWorkspace(c: ScaffoldCtx) {
  for (const [path, content] of workspaceFiles(c)) writeWorkspaceFile(c.orgId, path, content);
}

// Files whose templates embed the mission/objective — re-rendered on a direction change.
const MISSION_DOC_RE = /^(\.claude\/organization\.md|\.claude\/CLAUDE\.md|README\.md|DOCS\/architecture\.md|DOCS\/onboarding\.md|PO\/roadmap\.md|\.claude\/agents\/[^/]+\/Agent\.md)$/;

/** Re-render ONLY the mission/objective-bearing docs from templates (used when the operator
 *  changes the project's direction) so no doc keeps the stale mission. Returns the paths written. */
export function rerenderMissionDocs(c: ScaffoldCtx): string[] {
  const written: string[] = [];
  for (const [path, content] of workspaceFiles(c)) {
    if (MISSION_DOC_RE.test(path)) { writeWorkspaceFile(c.orgId, path, content); written.push(path); }
  }
  return written;
}

/** Write only the files that are absent or empty (repair / backfill — non-destructive). */
export function scaffoldMissing(c: ScaffoldCtx): string[] {
  const written: string[] = [];
  for (const [path, content] of workspaceFiles(c)) {
    const cur = readWorkspaceFile(c.orgId, path);
    if (cur == null || cur.trim() === "") { writeWorkspaceFile(c.orgId, path, content); written.push(path); }
  }
  written.push(...scaffoldProjectStarter(c).written);
  return written;
}

/**
 * Write the deterministic RUNNABLE starter (a real, configured app that boots a dev server) for the
 * chosen stack — ABSENT-ONLY, so agent edits are never clobbered. NOT part of workspaceFiles() (so
 * bootstrapWorkspace/rerenderMissionDocs can never overwrite product code). Called once at
 * onboarding + on repair. Best-effort: never throws.
 */
export function scaffoldProjectStarter(c: ScaffoldCtx): { id: string; written: string[] } {
  const written: string[] = [];
  try {
    const { id, files } = starterFor({ company: c.company, mission: c.mission, objective: c.objective, slug: c.slug, stack: c.stack });
    for (const [rel, content] of files) {
      if (readWorkspaceFile(c.orgId, rel) == null) { writeWorkspaceFile(c.orgId, rel, content); written.push(rel); }
    }
    return { id, written };
  } catch (e) { console.error("[scaffold] project starter failed:", e); return { id: "static", written }; }
}

/** Back-compat entry used by onboarding. */
export function scaffoldWorkspace(orgId: string, opts: { company: string; mission: string; objective: string; stack: Record<string, string>; slug?: string; runMode?: string; preserveReadme?: boolean }) {
  bootstrapWorkspace({
    orgId, slug: opts.slug ?? orgId, company: opts.company, mission: opts.mission,
    objective: opts.objective, stack: opts.stack, runMode: opts.runMode,
    createdAt: new Date().toISOString().slice(0, 10), preserveReadme: opts.preserveReadme,
  });
}
