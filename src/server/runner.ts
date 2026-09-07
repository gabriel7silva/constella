/**
 * Runner — the REAL autonomous loop.
 *
 * - Cheap tick (execute:false, browser heartbeat): refreshes pulse/health only.
 *   Liveness is real — an agent is "alive" only if its executor CLI is installed.
 * - Execute tick (execute:true, headless worker / explicit Run): dispatches ONE
 *   pending task to its assigned agent via the real `claude`/`codex` CLI, books
 *   the REAL cost + tokens from the run, posts the agent's output to the room,
 *   and advances the task on real success. Budgets are enforced before spawning.
 *
 * Nothing is fabricated — no run, no cost row.
 */
import { db } from "@/db";
import { agent, task, issue, activity, costEntry, workspace, message, plan, taskStep, goal, report, cronRun } from "@/db/schema";
import { eq, and, gte, sum, isNotNull } from "drizzle-orm";
import { randomUUID } from "crypto";
import { recordPulse, refreshHealth, pulseSweep } from "@/lib/pulse";
import { runAgentStream, pickBinary, cliVersion, setLockHook, setGuardHook, setWebResearch, type CliBinary } from "@/server/adapters/cli";
import { assembleAgentPrompt } from "@/server/context-manager";
import { syncTaskChecklist } from "@/server/materialize";
import { recomputeGoalProgress } from "@/server/progress";
import { recordGoalFiles } from "@/server/goal-files";
import { logDecision } from "@/server/decisions";
import { ingestKnowledge, extractRemembered, relatedKnowledge } from "@/server/kb";
import { researchDocs } from "@/server/research";
import { proposeBlockEdit } from "@/server/blocks";
import { releaseLocksForTask, reclaimStaleLocks } from "@/server/file-locks";
import { pingOperatorIfAddressed } from "@/server/operator-ping";
import { pushInbox, resolveInboxFor } from "@/server/inbox";
import { runTestDev, routesForIssue } from "@/server/test-harness";
import { serverUrl, ensureBootable } from "@/server/devserver";
import { notifyOps } from "@/lib/notify";
import { emit } from "@/server/events";
import { pruneRunEvents } from "@/server/events-prune";
import { wake } from "@/server/bus";
import { writeDoc } from "@/lib/workspace-doc";
import { readWorkspaceFile, deleteWorkspacePath } from "@/lib/fs-workspace";
import { relayRoomMentions } from "@/server/collab";
import { reviewTaskChange } from "@/server/review";
import { scrubSecrets } from "@/lib/scrub";

// A successful autonomous run lands the task on `done`. (Previously it parked at `review`,
// but NOTHING in the loop ever re-selected a `review` task → every task got stuck there
// forever. `review` stays available only for explicit operator hand-routing on the board.)
const COLUMN_NEXT: Record<string, string> = { triage: "todo", todo: "doing", doing: "done" };

function startOfToday(): Date { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }

// Proactive recall — surface to the room the high-confidence prior decisions/fixes connected to a
// task's goal/issue (via the KB graph), at most ONCE per task. Best-effort + bounded so it never spams.
const recalledTasks = new Set<string>();
async function surfaceRelatedMemory(ws: typeof workspace.$inferSelect, t: { id: string; title: string; goalId: string | null; issueId: string | null }): Promise<void> {
  if (recalledTasks.has(t.id) || (!t.goalId && !t.issueId)) return;
  recalledTasks.add(t.id);
  if (recalledTasks.size > 5000) recalledTasks.clear();
  const rel = await relatedKnowledge(ws.orgId, { goalId: t.goalId ?? undefined, issueId: t.issueId ?? undefined });
  if (!rel) return;
  const picks = ["decision", "fix", "integration", "architecture", "business-rule"]
    .flatMap((tp) => rel.byType[tp] ?? [])
    .filter((n) => n.confidence >= 75)
    .slice(0, 3);
  if (!picks.length) return;
  const [vannevar] = await db.select().from(agent).where(and(eq(agent.workspaceId, ws.id), eq(agent.handle, "vannevar")));
  if (!vannevar) return;
  await db.insert(message).values({
    id: randomUUID(), workspaceId: ws.id, channel: "room", fromKind: "agent", fromHandle: "vannevar",
    text: `💡 Heads-up on **${t.title}** — related prior work worth a look:\n${picks.map((p) => `- ${p.title}`).join("\n")}`.slice(0, 4000),
    createdAt: new Date(),
  });
  wake(ws.id);
}

export async function agentAtCap(agentId: string, dailyCapUsd: number): Promise<boolean> {
  if (!dailyCapUsd) return false;
  const [row] = await db.select({ total: sum(costEntry.usd) }).from(costEntry)
    .where(and(eq(costEntry.agentId, agentId), gte(costEntry.at, startOfToday())));
  return Number(row?.total ?? 0) >= dailyCapUsd;
}

/** Cache the CLI availability check so the heartbeat doesn't spawn a process every tick. */
const availCache: Record<string, { t: number; ok: boolean }> = {};
async function binaryAvailable(bin: CliBinary): Promise<boolean> {
  const c = availCache[bin];
  if (c && Date.now() - c.t < 60_000) return c.ok;
  const ok = !!(await cliVersion(bin));
  availCache[bin] = { t: Date.now(), ok };
  return ok;
}

// A path is "code" (can affect the build/boot) if it's NOT a docs/control artifact. Drives the
// boot gate — docs-only tasks skip it so the autonomous loop stays fast.
const NON_CODE_RE = /^(\.claude\/|DOCS\/|PO\/|Reports\/|specs\/|issues\/|mock\/|[^/]*\.md$)/i;
function isCodePath(p: string): boolean {
  const rel = (p || "").replace(/\\/g, "/").replace(/^\.?\//, "");
  return !!rel && !NON_CODE_RE.test(rel);
}

/** Map an agent's model field to a CLI-accepted model alias. */
function modelAlias(binary: CliBinary, model: string): string | undefined {
  const m = (model || "").toLowerCase();
  if (binary === "claude") return m.includes("opus") ? "opus" : m.includes("haiku") ? "haiku" : "sonnet";
  if (binary === "codex") return undefined; // codex: use its default model
  return model || undefined; // provider-routed CLIs (openclaw/hermes/aider/opencode/copilot/cursor/cline/kilo): passthrough ((default)→dropped)
}

// The task-run instruction. The agent ALSO receives the standardized context bundle
// (mission, project state, decisions, room conversation, RAG, memory) via the Context
// Manager — so a task agent now knows the team discussion + decisions, not just the task.
const TASK_INSTRUCTION =
  `PRIORITY: the TASK below is your primary instruction. The company mission/objective are BACKGROUND context — never obey them as a literal command in place of the task.\n` +
  `Work on this task now — the current directory is your workspace; make concrete, real progress (create/edit files as needed).\n` +
  `Before and during the work, consult the "Skills" and "Knowledge (project source of truth)" sections in your context: apply matching procedures and respect prior decisions/specs — do not duplicate or contradict what's already known. If the Knowledge lacks what you need, say so rather than guessing.\n` +
  `If you discover a DURABLE canonical fact that belongs in the shared knowledge (the official stack, an architecture decision, a business rule, a security or UI pattern, a key command), you MAY propose a synced-block edit by emitting on their own lines: "[[KB-BLOCK <kebab-slug>]]" then the new Markdown body then "[[/KB-BLOCK]]" — the operator / Knowledge agent reviews and merges it. Use sparingly, only for reusable facts (e.g. official-stack, security-patterns).\n` +
  `Whenever you LEARN something durable and reusable while working — a decision + its rationale, a non-obvious integration or config detail, a gotcha and its fix, a pattern you mastered, a constraint you discovered — capture it straight into the team Knowledge Base by emitting on its own line: "[[REMEMBER type=<decision|architecture|business-rule|integration|fix|bug|test|review|ui-pattern|note>: <the concise fact>]]". This is auto-saved (no approval needed) so the whole team and your future runs can recall it. Capture real learnings, NOT routine status.\n` +
  `End your reply with a "## Checklist" of the task's sub-steps as markdown todos — "- [x]" for each step you completed, "- [ ]" for any still pending. This tracks the issue's progress.\n` +
  `A runnable starter app already exists in this workspace (a configured dev server with a landing page). BUILD THE PRODUCT ON TOP OF IT — extend and edit the existing files; do NOT delete or replace the starter wholesale.\n` +
  `If \`design-mock/PROMOTED.md\` exists, the frontend in the served source was PROMOTED from the operator-approved design — it is the REAL UI and the source of truth. READ that manifest, then EXTEND those exact screens (wire real data, backend, interactivity and states ON TOP), preserving their markup/CSS exactly (zero drift). NEVER rebuild, recreate or restyle the promoted screens.\n` +
  `The project MUST stay bootable: after your change the dev server still starts cleanly — install any new deps you import, keep package.json/scripts/config valid, and never leave a broken or missing import. A task that breaks the dev server boot is sent back to review, not marked done.\n` +
  `When done, reply with a 2-4 sentence summary of exactly what you did. If a teammate must act next — review your change, fix a problem you found, test it, or document it — END your summary by @mentioning EXACTLY ONE teammate (e.g. @whitfield, @edsger, @barbara) with a concrete ask. If you need the OPERATOR's decision or approval, @mention @operator. If nothing else is needed, do not @mention anyone.`;

/** Append a real run entry to a rolling Reports/*.md (newest first, capped at 50).
 *  Write-through: writeDoc writes disk (truth) + indexes the DB so /reports shows it live. */
async function logRun(
  ws: typeof workspace.$inferSelect,
  ok: boolean,
  a: typeof agent.$inferSelect,
  t: typeof task.$inferSelect,
  detail: string,
): Promise<void> {
  const rel = ok ? "Reports/task-execution.md" : "Reports/error-report.md";
  const title = ok ? "Task execution log" : "Error report";
  const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
  const head = `## ${ts} · ${t.key}\n**@${a.handle}** (${a.role}) — ${t.title}\n\n${detail.trim() || (ok ? "Completed." : "Failed.")}`;
  const prev = readWorkspaceFile(ws.orgId, rel) ?? `# ${title}\n\n_Auto-maintained by the runner — newest first._`;
  const header = prev.split(/\n## /)[0].trimEnd();
  const entries = prev.includes("\n## ") ? prev.slice(prev.indexOf("\n## ") + 1).split(/\n(?=## )/) : [];
  const next = [head, ...entries.map((e) => e.trim())].filter(Boolean).slice(0, 50);
  try { await writeDoc(ws.orgId, rel, `${header}\n\n${next.join("\n\n")}\n`); } catch (e) { console.error("[runner] report write failed:", rel, e); }
}

/** When a goal reaches 100% (status flipped to "done" by recomputeGoalProgress), file a single
 *  CEO summary report. This both closes the "CEO reports" pipeline step and gives the operator a
 *  real delivery summary. Idempotent — one ceo-summary per goal. */
async function fileCeoSummaryIfComplete(ws: typeof workspace.$inferSelect, goalId: string): Promise<void> {
  const g = await db.query.goal.findFirst({ where: eq(goal.id, goalId) });
  if (!g || g.status !== "done") return;
  const existing = await db.select().from(report).where(and(eq(report.workspaceId, ws.id), eq(report.goalId, goalId), eq(report.type, "ceo-summary")));
  if (existing.length) return;
  const issues = await db.select().from(issue).where(and(eq(issue.workspaceId, ws.id), eq(issue.goalId, goalId)));
  const body = `# ${g.title} — delivered\n\nAll ${issues.length} issue${issues.length === 1 ? "" : "s"} complete (100%).\n\n## Issues\n${issues.map((i) => `- ${i.key} ${i.title}`).join("\n")}\n`;
  await db.insert(report).values({ id: randomUUID(), workspaceId: ws.id, title: `CEO summary — ${g.title}`, type: "ceo-summary", authorId: g.ownerId ?? null, body, goalId });
  try { await writeDoc(ws.orgId, `Reports/ceo-summary-${goalId.slice(0, 6)}.md`, body); } catch (e) { console.error("[runner] ceo-summary write failed:", e); }
  await notifyOps(ws.id, { kind: "done", text: `Work complete — ${g.title}`, detail: `CEO summary filed; ${issues.length} issue${issues.length === 1 ? "" : "s"} delivered.`, tg: true });
  const owner = g.ownerId ? await db.query.agent.findFirst({ where: eq(agent.id, g.ownerId) }) : null;
  await logDecision(ws.id, { text: `Goal complete: ${g.title}`, by: owner?.handle ?? "system", source: "task-done", goalId });
  // Capture the delivery summary as durable project history.
  void ingestKnowledge(ws.orgId, [{ type: "history", title: `Delivered: ${g.title}`, summary: body.slice(0, 1200), goalId, agentHandle: owner?.handle ?? "", sourceKind: "goal", sourceRef: goalId }]).catch(() => {});
}

/** Tasks this Next.js process is ACTUALLY running right now (shared by the browser autoTick
 *  and the cron route — they run in the same process). A "doing" task NOT in here is an
 *  orphan from a previous process / crash / mid-run restart. */
const inFlightTasks = new Set<string>();

/** Workspaces with a task EXECUTING right now (this process). Concurrency cap = 1 agent run per
 *  workspace: both the cron route and the browser autoTick run in THIS web process, and without a
 *  lock they can race past the per-task guard and launch two CLIs at once (double RAM → the OOM that
 *  crashed the web). Claimed synchronously (before any await) so a racing tick sees it immediately.
 *  Override the cap with CONSTELLA_MAX_CONCURRENT_AGENTS (per workspace; default 1). */
const runningWorkspaces = new Map<string, number>();
const MAX_CONCURRENT = Math.max(1, Number(process.env.CONSTELLA_MAX_CONCURRENT_AGENTS) || 1);

/** Crash/restart recovery: re-queue any "doing" task that isn't genuinely executing now, and
 *  free its assignee. Without this, a task interrupted mid-run stays stuck "doing" + the agent
 *  stuck "working" forever (the in-flight guard then skips it). Safe in normal flow — a live task
 *  is in `inFlightTasks`, and tasks don't linger in "doing" between ticks. */
async function reclaimOrphans(wsId: string): Promise<void> {
  void reclaimStaleLocks(); // drop per-file locks left by crashed runs (TTL) before re-picking work
  const doing = await db.select().from(task).where(and(eq(task.workspaceId, wsId), eq(task.col, "doing")));
  for (const t of doing) {
    if (inFlightTasks.has(t.id)) continue; // genuinely running in this process — leave it
    await db.update(task).set({ col: "todo" }).where(eq(task.id, t.id));
    if (t.issueId) await db.update(issue).set({ col: "todo" }).where(eq(issue.id, t.issueId)); // un-flight its issue
    if (t.assigneeId) await db.update(agent).set({ status: "idle" }).where(eq(agent.id, t.assigneeId));
  }
}

/** Run exactly one pending task to completion via the real CLI. Returns true if a task ran.
 *  `auto` = the autonomous 24/7 loop (cron); it additionally requires the operator to have
 *  flipped Run 24/7 (`plan.auto247`). A manual operator step (`auto:false`) only needs approval.
 *
 *  Concurrency-capped per workspace (default 1): the synchronous claim below closes the race where a
 *  browser tick + the worker cron tick each grabbed a DIFFERENT todo task and spawned two agent CLIs
 *  simultaneously — extra memory pressure that contributed to the web OOM. */
async function runOneTask(ws: typeof workspace.$inferSelect, opts: { auto?: boolean } = {}): Promise<boolean> {
  const cap = ws.settings?.agents?.maxConcurrent ?? MAX_CONCURRENT; // per-workspace parallel cap (Config)
  const inFlight = runningWorkspaces.get(ws.id) ?? 0;
  if (inFlight >= cap) return false;                   // at the cap → don't start another run this tick
  runningWorkspaces.set(ws.id, inFlight + 1);          // claim a slot SYNCHRONOUSLY (before any await)
  try {
    return await runOneTaskBody(ws, opts);
  } finally {
    const n = (runningWorkspaces.get(ws.id) ?? 1) - 1;
    if (n <= 0) runningWorkspaces.delete(ws.id); else runningWorkspaces.set(ws.id, n);
  }
}

async function runOneTaskBody(ws: typeof workspace.$inferSelect, opts: { auto?: boolean } = {}): Promise<boolean> {
  // Execution gate: agents do not start real work until the operator approves the plan.
  const pl = await db.query.plan.findFirst({ where: eq(plan.workspaceId, ws.id) });
  if (!pl || !pl.approved) return false; // no plan or unapproved → never auto-run code
  // 24/7 gate: the autonomous loop runs only while Run 24/7 is on; pausing it truly stops execution.
  if (opts.auto && !pl.auto247) return false;
  // Recover anything left stuck "doing" by a previous run/restart before picking work.
  await reclaimOrphans(ws.id);
  // Pick a task: an in-progress one (unless its assignee is already executing it elsewhere),
  // else ATOMICALLY claim the next todo so two ticks/tabs can never grab the same task.
  // Only ever pick ASSIGNED tasks. A task with a null assigneeId (e.g. an issue whose assigneeRole matched no
  // team role) would otherwise be selected every tick and bail at the guard below WITHOUT being moved out of
  // the runnable column — shadowing the queue forever and starving all other work.
  let t = await db.query.task.findFirst({ where: and(eq(task.workspaceId, ws.id), eq(task.col, "doing"), isNotNull(task.assigneeId)) });
  if (t?.assigneeId) {
    const holder = await db.query.agent.findFirst({ where: eq(agent.id, t.assigneeId) });
    if (holder?.status === "working") return false; // currently executing in another tab/worker — don't double-run
  }
  if (!t) {
    const todo = await db.query.task.findFirst({ where: and(eq(task.workspaceId, ws.id), eq(task.col, "todo"), isNotNull(task.assigneeId)) });
    if (todo) {
      const claimed = await db.update(task).set({ col: "doing" }).where(and(eq(task.id, todo.id), eq(task.col, "todo"))).returning();
      if (claimed.length) t = { ...todo, col: "doing" };
      else return true; // someone else claimed it this tick → report "ran" so the loop re-ticks for the next
    }
  }
  if (!t || !t.assigneeId) return false;
  // Goal gate: never run a task whose goal was cancelled/archived (race with the claim above).
  if (t.goalId) {
    const g = await db.query.goal.findFirst({ where: eq(goal.id, t.goalId) });
    if (g && g.status !== "active") { await db.update(task).set({ col: "blocked" }).where(eq(task.id, t.id)); return false; }
  }
  const a = await db.query.agent.findFirst({ where: eq(agent.id, t.assigneeId) });
  if (!a) return false;
  if (await agentAtCap(a.id, a.dailyCapUsd)) {
    // Budget gate → surface it once (deduped per agent) so the operator can raise the cap or wait.
    await pushInbox(ws.id, { kind: "budget", refType: "task", refId: `budget:${a.id}`, goalId: t.goalId ?? null, fromAgentId: a.id, title: `@${a.handle} hit the daily budget cap`, detail: `${a.name} reached the $${a.dailyCapUsd}/day spend cap and paused. Raise the cap in Agent Studio or wait for the daily reset.` });
    return false;
  }

  const binary = pickBinary(a.adapter, a.model);
  if (!(await binaryAvailable(binary))) return false;

  inFlightTasks.add(t.id); // mark live so a concurrent tick / reclaim won't grab it
  try {
  await db.update(agent).set({ status: "working" }).where(eq(agent.id, a.id));
  // Flip the linked issue to "doing" NOW (not just on completion) so the Planner's "in flight" count
  // + the board reflect the running work — otherwise an agent works while the UI reads "0 in flight".
  if (t.issueId) await db.update(issue).set({ col: "doing" }).where(eq(issue.id, t.issueId));
  const roomMsgId = randomUUID();
  // When the project was imported/based on existing material, agents must EXTEND it (preserve UI/UX,
  // add real backend/data), never build a second separate prototype.
  const instruction = (ws.settings?.source?.type && ws.settings.source.type !== "new")
    ? TASK_INSTRUCTION + `\nThis project is based on EXISTING material (an imported repo, copied local directory, or attached mock) — see specs/SUPER-SPEC.md. EXTEND the existing code: preserve its working UI/UX, behavior and visual identity; add the missing real backend, data and integrations; never create a second separate prototype or replace what already exists.`
    : TASK_INSTRUCTION;
  const { prompt } = await assembleAgentPrompt({ orgId: ws.orgId, ws, agent: a, channel: "room", instruction, task: t });
  // Proactive recall (best-effort, once per task): surface high-confidence prior decisions/fixes
  // connected to this task's goal/issue to the room — unprompted — so the team isn't blind to past work.
  void surfaceRelatedMemory(ws, t).catch(() => {});
  // Re-check AFTER the (slow) prompt assembly: if the goal was cancelled in that window, do
  // NOT spawn (the abort registry also self-kills a child that registers after a cancel).
  if (t.goalId) {
    const g2 = await db.query.goal.findFirst({ where: eq(goal.id, t.goalId) });
    if (g2 && g2.status !== "active") {
      await db.update(task).set({ col: "blocked" }).where(eq(task.id, t.id));
      await db.update(agent).set({ status: "idle" }).where(eq(agent.id, a.id));
      return true;
    }
  }
  const touched: { path: string; op: string }[] = []; // provenance: files this goal produced
  // Tick the task's TODO checklist off LIVE as the agent streams its reply (it ends with a
  // "## Checklist" of `- [x]`/`- [ ]`), so progress climbs 1/4 → 4/4 instead of jumping 0 → 100% only
  // at the end. Debounced + fire-and-forget so it never blocks the stream.
  let streamed = "", lastSync = 0;
  setLockHook(ws.settings?.agents?.fileLocks ?? null); // honor the workspace's file-lock setting for this spawn
  setGuardHook(ws.settings?.agents?.cmdGuard ?? null); // destructive-command guard (default ON) for this spawn
  setWebResearch(ws.settings?.agents?.webResearch ?? null); // honor the workspace's web-research setting for this spawn
  const res = await runAgentStream(prompt, { orgId: ws.orgId, binary, model: modelAlias(binary, a.model), timeoutMs: 240_000, token: t.id, agentId: a.id, agentHandle: a.handle, effort: a.effort },
    (ev) => {
      if ((ev.kind === "create" || ev.kind === "edit") && ev.target) touched.push({ path: ev.target, op: ev.kind === "create" ? "created" : "edit" });
      if (ev.kind === "text" && ev.detail) {
        streamed += ev.detail;
        const now = Date.now();
        if (now - lastSync > 1500 && /-\s*\[[ xX]\]/.test(streamed)) {
          lastSync = now;
          void syncTaskChecklist(ws.id, t.id, streamed)
            .then(() => { if (t.goalId) return recomputeGoalProgress(ws.id, t.goalId); })
            .then(() => wake(ws.id)) // nudge the open UI to refresh the climbing progress
            .catch(() => {});
        }
      }
      void emit(ws.id, { runId: roomMsgId, channel: "room", agentId: a.id, kind: ev.kind, target: ev.target, detail: ev.detail });
    });
  if (t.goalId && touched.length) await recordGoalFiles(ws.id, ws.orgId, t.goalId, touched);

  // Book REAL cost (only if the run produced usage).
  if (res.usd > 0 || res.inputTokens + res.outputTokens > 0) {
    await db.insert(costEntry).values({
      id: randomUUID(), workspaceId: ws.id, agentId: a.id, provider: res.binary, model: res.model ?? a.model,
      usd: res.usd, tokens: res.inputTokens + res.outputTokens, at: new Date(),
    });
  }

  if (res.ok) {
    // Pull out any [[KB-BLOCK slug]]…[[/KB-BLOCK]] proposals the agent emitted: queue them for the
    // operator/KB agent to merge, record which blocks were touched (→ room chips), and strip the tokens.
    const touchedBlocks: string[] = [];
    for (const m of res.text.matchAll(/\[\[KB-BLOCK\s+([a-z0-9-]+)\]\]([\s\S]*?)\[\[\/KB-BLOCK\]\]/gi)) {
      const slug = m[1].toLowerCase(), bodyB = m[2].trim();
      if (slug && bodyB) { touchedBlocks.push(slug); void proposeBlockEdit(ws.orgId, { slug, body: bodyB, byAgentHandle: a.handle }).catch(() => {}); }
    }
    res.text = res.text.replace(/\[\[KB-BLOCK\s+[a-z0-9-]+\]\][\s\S]*?\[\[\/KB-BLOCK\]\]/gi, "").trim();
    // Agent-driven learning capture: "[[REMEMBER type=<t>: <fact>]]" → straight into the KB (no
    // approval, unlike a canonical synced block) so the team + future runs can recall what was learned.
    const learned = extractRemembered(res.text, { agentHandle: a.handle, goalId: t.goalId, issueId: t.issueId, taskId: t.id, sourceKind: "task", sourceRef: `${t.id}:learn` });
    if (learned.items.length) void ingestKnowledge(ws.orgId, learned.items).catch(() => {});
    // A captured ARCHITECTURE / business-rule decision is operator-relevant → surface it in the Inbox once.
    const arch = learned.items.find((it) => it.type === "architecture" || it.type === "business-rule");
    if (arch) await pushInbox(ws.id, { kind: "review", refType: "task", refId: `arch:${t.id}`, goalId: t.goalId ?? null, fromAgentId: a.id, title: `Architecture decision — ${arch.title}`, detail: (arch.summary || arch.title).slice(0, 500) });
    res.text = learned.stripped;
    // Server-side research capture: "[[RESEARCH: <official-doc url>]]" → fetch (allowlisted) + cache into
    // the KB. The path for LOCAL-model agents (no native WebFetch) to pull trusted docs into the RAG.
    for (const m of res.text.matchAll(/\[\[RESEARCH:\s*(https?:\/\/[^\]\s]+)\s*\]\]/gi)) {
      void researchDocs(ws.orgId, (ws.stack ?? {}) as Record<string, string>, m[1], { agentHandle: a.handle, goalId: t.goalId, issueId: t.issueId, taskId: t.id }).catch(() => {});
    }
    res.text = res.text.replace(/\[\[RESEARCH:\s*https?:\/\/[^\]\s]+\s*\]\]/gi, "").trim();
    let next = COLUMN_NEXT[t.col] ?? t.col;
    await resolveInboxFor(ws.id, "task", t.id); // a previously-blocked task recovered → clear its inbox item
    // Completion gate: if the operator has the project dev server up in Test Dev, validate the
    // running app (navigate + console + basic security) before letting the task reach "done".
    // A hard FAIL holds it at "review" with findings; pass/inconclusive proceed. (No server up →
    // skipped entirely, so it never slows normal runs.)
    // BOOT GATE: a task that touched code must leave the project still bootable. Cheap (a ping if a
    // server is already up); a DEFINITE broken boot holds the task at "review" + Inbox. Toolchain
    // missing → inconclusive (not blocked). Non-code tasks (docs/PO/Reports) skip it entirely.
    if (next === "done" && touched.some((f) => isCodePath(f.path))) {
      try {
        const boot = await ensureBootable(ws.id, ws.orgId);
        if (!boot.ok) {
          next = "review";
          await pushInbox(ws.id, { kind: "block", refType: "task", refId: t.id, goalId: t.goalId ?? null, fromAgentId: a.id, title: `${t.key} broke the dev server`, detail: `${t.title}\n\n${boot.detail}`.slice(0, 500) });
          await notifyOps(ws.id, { kind: "review", text: `${t.key} held — dev server no longer boots`, detail: boot.detail.slice(0, 300), agentId: a.id });
        }
      } catch (e) { console.error("[runner] boot gate failed:", e); }
    }
    if (next === "done" && serverUrl(ws.id)) {
      try {
        const gate = await runTestDev(ws.id, ws.orgId, { goalId: t.goalId, issueId: t.issueId ?? undefined, by: "agent", noBoot: true, routes: t.issueId ? await routesForIssue(ws.id, t.issueId) : undefined });
        if (gate.status === "fail") {
          next = "review";
          await pushInbox(ws.id, { kind: "validation", refType: "validation", refId: gate.id, goalId: t.goalId, fromAgentId: a.id, title: `${t.key} failed Test Dev`, detail: gate.summary });
          await notifyOps(ws.id, { kind: "review", text: `${t.key} held — failed Test Dev`, detail: gate.summary, agentId: a.id });
        }
      } catch (e) { console.error("[runner] Test Dev gate failed:", e); }
    }
    // REVIEW GATE: an INDEPENDENT reviewer (the strongest model, never the task's own author) reviews
    // the changed files. A high-severity finding holds the task at `review` + Inbox; all findings are
    // filed + captured to the KB. Gated by settings.agents.autoReview (default ON; CONSTELLA_AUTO_REVIEW=0).
    const autoReview = (ws.settings?.agents?.autoReview ?? true) && process.env.CONSTELLA_AUTO_REVIEW !== "0";
    if (next === "done" && autoReview && touched.some((f) => isCodePath(f.path))) {
      try {
        const roster = await db.select().from(agent).where(eq(agent.workspaceId, ws.id));
        const reviewer = roster.find((r) => r.id !== a.id && r.handle === "whitfield")
          ?? roster.find((r) => r.id !== a.id && /cyber|security|qa|review|quality/i.test(r.role))
          ?? roster.find((r) => r.id !== a.id);
        if (reviewer) {
          const rev = await reviewTaskChange(ws.orgId, ws, reviewer, `${t.key} — ${t.title}`, touched.map((f) => f.path));
          if (rev.blocking) {
            next = "review";
            const highs = rev.findings.filter((f) => f.sev === "high");
            const top = highs.slice(0, 5).map((f) => `• ${f.title}${f.file ? ` (${f.file})` : ""}`).join("\n");
            await pushInbox(ws.id, { kind: "review", refType: "task", refId: t.id, goalId: t.goalId ?? null, fromAgentId: reviewer.id, title: `${t.key} held in review — ${highs.length} issue(s)`, detail: `${t.title}\n\n${top}`.slice(0, 500) });
            await notifyOps(ws.id, { kind: "review", text: `${t.key} held — code review found issues`, detail: top.slice(0, 300), agentId: reviewer.id });
          }
        }
      } catch (e) { console.error("[runner] review gate failed:", e); }
    }
    await db.update(task).set({ col: next as typeof t.col }).where(eq(task.id, t.id));
    if (t.issueId) await db.update(issue).set({ col: next as "todo" | "doing" | "blocked" | "review" | "done" }).where(eq(issue.id, t.issueId));
    await db.insert(activity).values({ id: randomUUID(), workspaceId: ws.id, agentId: a.id, action: "worked on task", target: `${t.title} → ${next}`, at: new Date() });
    if (res.text.trim()) {
      await db.insert(message).values({ id: roomMsgId, workspaceId: ws.id, channel: "room", fromKind: "agent", fromHandle: a.handle, text: scrubSecrets(res.text).slice(0, 4000), taskId: t.id, blocks: touchedBlocks.length ? touchedBlocks : null, createdAt: new Date() });
      await pruneRunEvents(ws.id, roomMsgId, "room"); // drop ephemeral text deltas + trim channel
      await pingOperatorIfAddressed(ws.id, { text: res.text, agentId: a.id, agentHandle: a.handle, messageId: roomMsgId, channel: "room" });
      wake(ws.id); // push the task's room post to any open SSE stream immediately
      // Autonomous hand-off: any teammate this agent @mentioned now replies + works (capped chain).
      await db.update(agent).set({ status: "idle" }).where(eq(agent.id, a.id));
      // Best-effort hand-off — a relay failure (teammate spawn / DB) must NOT abort THIS task's own
      // bookkeeping below (checklist, done-flip, goal recompute, cronRun, KB capture).
      try { await relayRoomMentions(ws.orgId, ws, a.handle, res.text, 0); } catch (e) { console.error("[runner] relay failed:", e); }
    }
    // TODO progress: a completed task = all its checklist steps done; sync any extra the
    // agent reported, then roll the % up to the parent goal.
    await syncTaskChecklist(ws.id, t.id, res.text);
    if (next === "done") await db.update(taskStep).set({ done: true }).where(eq(taskStep.taskId, t.id));
    if (t.goalId) { await recomputeGoalProgress(ws.id, t.goalId); await fileCeoSummaryIfComplete(ws, t.goalId); }
    // KB capture (best-effort, off the hot path): what this task produced becomes reusable knowledge
    // the whole team can recall. Dedup is by (type, task, taskId) so a re-run updates in place.
    void ingestKnowledge(ws.orgId, [{
      type: touched.some((f) => isCodePath(f.path)) ? "code-change" : "note",
      title: `${t.key} — ${t.title}`, summary: res.text.slice(0, 1200),
      goalId: t.goalId ?? null, issueId: t.issueId ?? null, taskId: t.id,
      paths: touched.map((f) => f.path), agentHandle: a.handle, sourceKind: "task", sourceRef: t.id,
    }]).catch(() => {});
    if (next === "done") {
      await notifyOps(ws.id, { kind: "done", text: `${t.key} done — ${t.title}`, detail: scrubSecrets(res.text).slice(0, 300), agentId: a.id, tg: true });
      await logDecision(ws.id, { text: `Completed ${t.key}: ${t.title}`, by: a.handle, source: "task-done", refKey: t.key });
    }
    await logRun(ws, true, a, t, `Moved to **${next}**.\n\n${res.text.slice(0, 600)}`);
    await db.insert(cronRun).values({ id: randomUUID(), workspaceId: ws.id, task: `${t.key} — ${t.title}`.slice(0, 200), agentId: a.id, ok: true, at: new Date() });
    await db.update(agent).set({ status: "idle" }).where(eq(agent.id, a.id));
  } else {
    // Blocked-on-fail: take the task OUT of the runnable set so the loop never retries it forever.
    await db.update(task).set({ col: "blocked" }).where(eq(task.id, t.id));
    if (t.issueId) await db.update(issue).set({ col: "blocked" }).where(eq(issue.id, t.issueId));
    await db.update(agent).set({ status: "blocked" }).where(eq(agent.id, a.id));
    await db.insert(activity).values({ id: randomUUID(), workspaceId: ws.id, agentId: a.id, action: "task blocked", target: `${t.title}: ${res.error ?? "error"}`.slice(0, 200), at: new Date() });
    await syncTaskChecklist(ws.id, t.id, res.text); // capture partial TODO progress before blocking
    if (t.goalId) await recomputeGoalProgress(ws.id, t.goalId);
    await logRun(ws, false, a, t, res.error ?? "Run failed with no output.");
    await db.insert(cronRun).values({ id: randomUUID(), workspaceId: ws.id, task: `${t.key} — ${t.title}`.slice(0, 200), agentId: a.id, ok: false, at: new Date() });
    await notifyOps(ws.id, { kind: "review", text: `${t.key} blocked — ${t.title}`, detail: (res.error ?? "Run failed").slice(0, 300), agentId: a.id });
    await pushInbox(ws.id, { kind: "block", refType: "task", refId: t.id, goalId: t.goalId ?? null, fromAgentId: a.id, title: `${t.key} blocked — needs you`, detail: `${t.title}\n\n${(res.error ?? "Run failed").slice(0, 400)}` });
    await logDecision(ws.id, { text: `Blocked ${t.key}: ${t.title}`, by: a.handle, source: "issue-block", refKey: t.key, rationale: (res.error ?? "").slice(0, 300) });
  }
  return true;
  } finally {
    inFlightTasks.delete(t.id); // run finished (or threw) → no longer live
    void releaseLocksForTask(ws.id, t.id); // free any per-file locks this task held
    // Never leave the agent stuck 'working' if the run threw before its normal idle-reset (e.g. prompt
    // assembly / a DB write rejected) — busyOnBoard() would otherwise treat it as permanently busy and never
    // fire it again. Conditional on still-'working' so a status set by another path isn't clobbered.
    try { await db.update(agent).set({ status: "idle" }).where(and(eq(agent.id, a.id), eq(agent.status, "working"))); } catch { /* best-effort */ }
    // Surface any destructive commands the safety guard blocked this run (guard-hook.mjs logs them) →
    // one deduped Inbox item per task, then clear the log. Best-effort; never affects the task outcome.
    try {
      const denials = readWorkspaceFile(ws.orgId, ".claude/guard-denials.jsonl");
      if (denials && denials.trim()) {
        const rows = denials.trim().split("\n").map((l) => { try { return JSON.parse(l) as { why: string; cmd: string }; } catch { return null; } }).filter(Boolean) as { why: string; cmd: string }[];
        if (rows.length) {
          const detail = rows.slice(0, 8).map((d) => `• ${d.why}: \`${String(d.cmd).slice(0, 120)}\``).join("\n");
          await pushInbox(ws.id, { kind: "block", refType: "task", refId: `guard:${t.id}`, goalId: t.goalId ?? null, fromAgentId: a.id, title: `@${a.handle} attempted ${rows.length} blocked command(s) on ${t.key}`, detail: `The safety guard blocked these destructive commands during the run:\n${detail}` });
        }
        deleteWorkspacePath(ws.orgId, ".claude/guard-denials.jsonl");
      }
    } catch { /* best-effort */ }
  }
}

/** Advance one workspace. `execute` dispatches a real CLI run; otherwise only pulses/health.
 *  `auto` marks the autonomous 24/7 loop (cron) — execution then also requires `plan.auto247`. */
export async function tickWorkspace(workspaceId: string, opts: { execute?: boolean; auto?: boolean; browser?: boolean } = {}) {
  const ws = await db.query.workspace.findFirst({ where: eq(workspace.id, workspaceId) });
  if (!ws) return { pulsed: 0, advanced: 0, paused: 0 };
  const agents = await db.query.agent.findMany({ where: eq(agent.workspaceId, workspaceId) });
  if (agents.length === 0) return { pulsed: 0, advanced: 0, paused: 0 };

  // Probe each CLI's availability once (cached); a missing binary errors fast (ENOENT), no hang.
  const avail: Record<CliBinary, boolean> = {
    claude: await binaryAvailable("claude"),
    codex: await binaryAvailable("codex"),
    openclaw: await binaryAvailable("openclaw"),
    hermes: await binaryAvailable("hermes"),
    aider: await binaryAvailable("aider"),
    opencode: await binaryAvailable("opencode"),
    copilot: await binaryAvailable("copilot"),
    "cursor-agent": await binaryAvailable("cursor-agent"),
    cline: await binaryAvailable("cline"),
    kilocode: await binaryAvailable("kilocode"),
    grok: await binaryAvailable("grok"),
  };
  // Runtime resolves? CLI agents need their binary; HTTP/local providers are assumed reachable here.
  const runtimeOk = (adapter: string) => adapter.startsWith("cli_") ? avail[pickBinary(adapter)] : true;

  let pulsed = 0, paused = 0, changed = 0;
  for (const a of agents) {
    if (a.status !== "idle" && await agentAtCap(a.id, a.dailyCapUsd)) { paused++; continue; }
    const ok = runtimeOk(a.adapter);
    const newHealth: "alive" | "stale" = ok ? "alive" : "stale";
    if (a.status !== "idle") {
      await recordPulse(workspaceId, a.id, { ok, note: `tick:${a.status}` }); // real work → pulse row + health
    } else {
      // heartbeat touch for idle agents: keep them alive (no pulse-row spam) so they don't read "offline"
      await db.update(agent).set({ lastPulse: new Date(), health: newHealth }).where(eq(agent.id, a.id));
    }
    if (a.health !== newHealth) changed++;
    pulsed++;
  }

  let advanced = 0;
  if (opts.execute) { if (await runOneTask(ws, { auto: opts.auto })) advanced = 1; }

  // The headless execute tick does the disk-heavy sweep + Reports snapshots. Skip it on
  // browser execute ticks (which can chain rapidly) — the loop above already set health.
  if (opts.execute && !opts.browser) await pulseSweep(ws.id, ws.orgId);
  return { pulsed, advanced, paused, changed };
}

/** (workspace,version) pairs we've already surfaced an update notice for this process — so a dismissed
 *  "update available" item isn't re-pushed every tick (pushInbox only dedupes against UNRESOLVED items). */
const notifiedUpdate = new Set<string>();

/** Tick every workspace with an active run-mode. */
export async function tickAll(opts: { execute?: boolean; auto?: boolean } = {}) {
  const workspaces = await db.query.workspace.findMany();
  const active = workspaces.filter((w) => w.runMode && w.runMode !== "off");
  // Surface a newly-published Constella version once (deduped per version) for each active workspace.
  // checkForUpdate is TTL-cached, so the npm lookup is throttled even though the tick runs often.
  try {
    const { checkForUpdate } = await import("@/server/update-check");
    const upd = await checkForUpdate();
    if (upd?.updateAvailable && upd.latest) {
      for (const w of active) {
        const key = `${w.id}:${upd.latest}`;
        if (notifiedUpdate.has(key)) continue; // surfaced once per (workspace,version) → dismissing it sticks
        notifiedUpdate.add(key);
        await pushInbox(w.id, { kind: "review", refType: "task", refId: `update:${upd.latest}`, title: `Constella ${upd.latest} is available`, detail: `You're on ${upd.current}. Open the Update module to review the changelog and upgrade.` });
      }
    }
  } catch { /* best-effort — never block the tick on an update check */ }
  return Promise.all(active.map(async (w) => ({ workspace: w.id, ...(await tickWorkspace(w.id, opts)) })));
}
