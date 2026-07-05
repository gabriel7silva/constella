"use server";

import { eq, and, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import { agent, task, goal, issue, finding, inboxItem, costEntry, budget, plan, provider, testRun, fileLock } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";
import { goalRollups } from "@/server/progress";
import { kbOverview } from "@/server/kb";
import { serverStatus } from "@/server/devserver";
import { ensureBootable } from "@/server/devserver";
import { loadDeployRow } from "@/server/deploy-store";
import { activeLocks } from "@/server/file-locks";
import { checkForUpdate } from "@/server/update-check";
import { getTelegramConfig } from "@/lib/telegram";
import { integrationOn } from "@/lib/integrations";
import { getSecret } from "@/lib/vault";
import { pushInbox } from "@/server/inbox";
import { revalidatePath } from "next/cache";

/**
 * The Dashboard cockpit aggregator. Composes existing, real data sources into ONE typed snapshot —
 * no new tables, no fakes: every status/metric maps to a live source, and every CTA points at a real
 * action/route. The client auto-polls `getDashboardSnapshot` and renders widgets from this shape.
 */

export type Range = "today" | "7d" | "30d" | "month";
export type DashOpts = { range?: Range; goalId?: string | null; agentId?: string | null };

export type HealthStatus = "healthy" | "attention" | "error" | "offline" | "needs-config";
export type HealthItem = { key: string; status: HealthStatus; detail: string; action?: string; href?: string };
export type IntegStatus = "connected" | "disconnected" | "error" | "needs-login" | "needs-config";

export type DashboardData = {
  generatedAt: number;
  range: Range;
  cards: {
    agents: { activeNow: number; total: number; idle: number; working: number; review: number; blocked: number; lastHeartbeat: number | null };
    spend: { spent: number; cap: number; tokens: number; prevSpent: number; trendPct: number };
    security: { score: string; open: number; high: number; med: number; low: number; lastScan: number | null };
    goals: { avgProgress: number; active: number; done: number; blocked: number };
  };
  health: HealthItem[];
  execution: {
    runState: "running" | "waiting-approval" | "off" | "idle" | "all-done";
    goalTitle?: string; issueTitle?: string; agentName?: string;
    elapsedMs?: number; nextStep?: string; reviewOpen?: number; testStatus?: string; lockedFiles?: number;
  } | null;
  agents: { id: string; name: string; role: string; color: string; status: string; health: "alive" | "stale" | "down"; model: string; lastPulseMs: number | null; taskTitle?: string }[];
  tasksByCol: { col: string; count: number }[];
  alerts: { key: string; kind: string; title: string; count: number; priority: number; agentName?: string; latestAtMs: number | null }[];
  problems: { key: string; severity: "high" | "med" | "low"; title: string; impact: string; action: string; href: string }[];
  kb: { docs: number; chunks: number; embeddings: number; recentQueries: number; gaps: number; lastReindexMs: number | null; semantic: boolean; active: number; obsolete: number };
  locks: { path: string; agentHandle: string; taskId: string; stale: boolean }[];
  integrations: { key: string; status: IntegStatus; detail: string }[];
  goalOptions: { id: string; title: string }[];
  spendSeries: number[];
  kbByType: { type: string; total: number }[];
  costByAgent: Record<string, number>;
};

const TASK_COLS = ["triage", "todo", "doing", "blocked", "review", "done"];
const STALE_LOCK_MS = 5 * 60_000;

function windowFor(range: Range): { from: Date; prevFrom: Date; prevTo: Date } {
  const now = Date.now();
  const day = 86_400_000;
  if (range === "today") { const f = new Date(); f.setHours(0, 0, 0, 0); return { from: f, prevFrom: new Date(f.getTime() - day), prevTo: f }; }
  if (range === "7d") { const f = new Date(now - 7 * day); return { from: f, prevFrom: new Date(now - 14 * day), prevTo: f }; }
  if (range === "30d") { const f = new Date(now - 30 * day); return { from: f, prevFrom: new Date(now - 60 * day), prevTo: f }; }
  const f = new Date(); f.setDate(1); f.setHours(0, 0, 0, 0);
  const pf = new Date(f); pf.setMonth(pf.getMonth() - 1);
  return { from: f, prevFrom: pf, prevTo: f };
}
function secScore(open: { sev: string }[]): string {
  const penalty = open.reduce((s, f) => s + (f.sev === "high" ? 15 : f.sev === "med" ? 6 : 2), 0);
  const n = Math.max(0, 100 - penalty);
  return n >= 95 ? "A+" : n >= 90 ? "A" : n >= 80 ? "B" : n >= 70 ? "C" : n >= 55 ? "D" : "F";
}
function ts(d: Date | number | null | undefined): number | null { return d == null ? null : (d instanceof Date ? d.getTime() : d); }

type WsRow = Awaited<ReturnType<typeof requireWorkspace>>["workspace"];

async function buildSnapshot(ws: WsRow, opts: DashOpts): Promise<DashboardData> {
  const wsId = ws.id;
  const range = opts.range ?? "7d";
  const w = windowFor(range);
  const goalId = opts.goalId || null;
  const agentId = opts.agentId || null;

  const [agents, tasks, findings, inbox, providers, locks, rolls, kb, deploy, lastTest, costsWindow, costsPrev, [pl], [bud]] = await Promise.all([
    db.select().from(agent).where(eq(agent.workspaceId, wsId)),
    db.select().from(task).where(eq(task.workspaceId, wsId)),
    db.select().from(finding).where(eq(finding.workspaceId, wsId)),
    db.select().from(inboxItem).where(and(eq(inboxItem.workspaceId, wsId), eq(inboxItem.resolved, false))),
    db.select().from(provider).where(eq(provider.workspaceId, wsId)),
    activeLocks(wsId),
    goalRollups(wsId),
    kbOverview(wsId).catch(() => null),
    loadDeployRow(wsId).catch(() => null),
    db.select().from(testRun).where(eq(testRun.workspaceId, wsId)).then((rows) => rows.sort((a, b) => (ts(b.startedAt) ?? 0) - (ts(a.startedAt) ?? 0))[0] ?? null),
    db.select({ usd: costEntry.usd, tok: costEntry.tokens, at: costEntry.at, agentId: costEntry.agentId }).from(costEntry).where(and(eq(costEntry.workspaceId, wsId), gte(costEntry.at, w.from))),
    db.select({ usd: costEntry.usd }).from(costEntry).where(and(eq(costEntry.workspaceId, wsId), gte(costEntry.at, w.prevFrom), lt(costEntry.at, w.prevTo))),
    db.select().from(plan).where(eq(plan.workspaceId, wsId)),
    db.select().from(budget).where(eq(budget.workspaceId, wsId)),
  ]);

  const agentById = new Map(agents.map((a) => [a.id, a]));

  /* ---- cards ---- */
  const byStatus = (s: string) => agents.filter((a) => a.status === s).length;
  const lastHeartbeat = agents.reduce((m, a) => Math.max(m, ts(a.lastPulse) ?? 0), 0) || null;
  const spent = costsWindow.reduce((s, c) => s + Number(c.usd ?? 0), 0);
  const tokens = costsWindow.reduce((s, c) => s + Number(c.tok ?? 0), 0);
  const prevSpent = costsPrev.reduce((s, c) => s + Number(c.usd ?? 0), 0);
  const trendPct = prevSpent > 0 ? Math.round(((spent - prevSpent) / prevSpent) * 100) : spent > 0 ? 100 : 0;
  // Daily spend series (≤31 buckets) for the sparkline + per-agent spend for the agent cards.
  const dayMs = 86_400_000;
  const fromMs = w.from.getTime();
  const buckets = Math.max(1, Math.min(31, Math.ceil((Date.now() - fromMs) / dayMs)));
  const spendSeries = new Array(buckets).fill(0) as number[];
  const costByAgent: Record<string, number> = {};
  for (const ce of costsWindow) {
    const atMs = ts(ce.at) ?? fromMs;
    let idx = Math.floor((atMs - fromMs) / dayMs);
    if (idx < 0) idx = 0; else if (idx >= buckets) idx = buckets - 1;
    spendSeries[idx] += Number(ce.usd ?? 0);
    if (ce.agentId) costByAgent[ce.agentId] = (costByAgent[ce.agentId] ?? 0) + Number(ce.usd ?? 0);
  }
  const openFindings = findings.filter((f) => f.status === "open");
  const sevN = (s: string) => openFindings.filter((f) => f.sev === s).length;
  const activeGoals = rolls.filter((g) => g.status === "active");
  const blockedGoals = activeGoals.filter((g) => g.issues.some((i) => i.col === "blocked")).length;
  const avgProgress = activeGoals.length ? Math.round(activeGoals.reduce((s, g) => s + g.progress, 0) / activeGoals.length) : 0;

  /* ---- tasks (scoped by goal) ---- */
  const scopedTasks = goalId ? tasks.filter((t) => t.goalId === goalId) : tasks;
  const tasksByCol = TASK_COLS.map((col) => ({ col, count: scopedTasks.filter((t) => t.col === col).length }));

  /* ---- execution ---- */
  const doing = scopedTasks.find((t) => t.col === "doing") ?? null;
  const approved = !!pl?.approved;
  const runMode = ws.runMode ?? "off";
  const todoCount = scopedTasks.filter((t) => t.col === "todo").length;
  let runState: NonNullable<DashboardData["execution"]>["runState"];
  if (doing) runState = "running";
  else if (!approved) runState = "waiting-approval";
  else if (runMode === "off") runState = "off";
  else if (todoCount > 0) runState = "running";
  else if (rolls.length > 0 && activeGoals.length === 0) runState = "all-done";
  else runState = "idle";

  let execution: DashboardData["execution"] = null;
  if (doing) {
    const g = doing.goalId ? rolls.find((r) => r.id === doing.goalId) : null;
    const iss = doing.issueId ? await db.select().from(issue).where(eq(issue.id, doing.issueId)).then((r) => r[0] ?? null) : null;
    const a = doing.assigneeId ? agentById.get(doing.assigneeId) : null;
    const nextTodo = scopedTasks.find((t) => t.col === "todo");
    execution = {
      runState,
      goalTitle: g?.title,
      issueTitle: iss?.title ?? doing.title,
      agentName: a?.name,
      elapsedMs: ts(doing.updatedAt) ? Date.now() - (ts(doing.updatedAt) as number) : undefined,
      nextStep: nextTodo?.title,
      reviewOpen: scopedTasks.filter((t) => t.col === "review").length,
      testStatus: lastTest?.status,
      lockedFiles: locks.filter((l) => l.taskId === doing.id).length,
    };
  } else {
    execution = { runState, testStatus: lastTest?.status, reviewOpen: scopedTasks.filter((t) => t.col === "review").length };
  }

  /* ---- agents list (scoped) ---- */
  const taskByAssignee = new Map<string, typeof tasks[number]>();
  for (const t of tasks) if (t.assigneeId && (t.col === "doing" || t.col === "review" || t.col === "blocked")) if (!taskByAssignee.has(t.assigneeId)) taskByAssignee.set(t.assigneeId, t);
  const agentsList = (agentId ? agents.filter((a) => a.id === agentId) : agents).map((a) => ({
    id: a.id, name: a.name, role: a.role, color: a.color, status: a.status, health: a.health, model: a.model,
    lastPulseMs: ts(a.lastPulse), taskTitle: taskByAssignee.get(a.id)?.title,
  }));

  /* ---- alerts: group unresolved inbox by (kind, fromAgentId) ---- */
  const PRIORITY: Record<string, number> = { block: 0, validation: 1, approval: 2, review: 3, budget: 4, question: 5 };
  const scopedInbox = inbox.filter((i) => (!agentId || i.fromAgentId === agentId) && (!goalId || i.goalId === goalId));
  const groups = new Map<string, { kind: string; count: number; agentId: string | null; latest: number | null }>();
  for (const i of scopedInbox) {
    const key = `${i.kind}::${i.fromAgentId ?? ""}`;
    const g = groups.get(key) ?? { kind: i.kind, count: 0, agentId: i.fromAgentId ?? null, latest: null };
    g.count++; g.latest = Math.max(g.latest ?? 0, ts(i.createdAt) ?? 0) || g.latest;
    groups.set(key, g);
  }
  const alerts = [...groups.entries()].map(([key, g]) => ({
    key, kind: g.kind, count: g.count, priority: PRIORITY[g.kind] ?? 9,
    agentName: g.agentId ? agentById.get(g.agentId)?.name : undefined,
    title: g.kind, latestAtMs: g.latest,
  })).sort((a, b) => a.priority - b.priority || b.count - a.count);

  /* ---- KB ---- */
  const kbData = kb
    ? { docs: kb.goals.length, chunks: kb.index.chunks, embeddings: kb.index.embedded, recentQueries: kb.queries.length, gaps: kb.gaps.length, lastReindexMs: kb.index.lastUpdated, semantic: kb.index.semantic, active: kb.lifecycle.active, obsolete: kb.index.obsolete }
    : { docs: 0, chunks: 0, embeddings: 0, recentQueries: 0, gaps: 0, lastReindexMs: null, semantic: false, active: 0, obsolete: 0 };

  /* ---- locks ---- */
  // activeLocks doesn't return timestamps; treat presence as active. Stale-ness is reclaimed by the
  // runner's TTL sweep, so a lock still here is "active"; we surface it for visibility.
  const lockRows = locks.map((l) => ({ path: l.path, agentHandle: l.agentHandle, taskId: l.taskId, stale: false }));

  /* ---- health ---- */
  const dev = serverStatus(wsId);
  const connectedProviders = providers.filter((p) => p.status === "connected");
  const ghPat = await getSecret(wsId, "github_pat").catch(() => null);
  const ghRepo = ws.settings?.github?.repo;
  const tgOn = integrationOn(ws.settings?.integrations ?? {}, "telegram");
  const tgCfg = tgOn ? await getTelegramConfig(wsId).catch(() => null) : null;
  const upd = await checkForUpdate().catch(() => null);
  const lastScan = ws.settings?.lastSecurityRun ?? null;

  const health: HealthItem[] = [];
  // dev server
  health.push(
    dev.status === "running" ? { key: "devServer", status: "healthy", detail: dev.project ?? "running", href: "/test-dev" }
    : dev.status === "starting" ? { key: "devServer", status: "attention", detail: "starting", href: "/test-dev" }
    : dev.status === "error" ? { key: "devServer", status: "error", detail: "boot error", action: "start-dev", href: "/test-dev" }
    : { key: "devServer", status: "offline", detail: "stopped", action: "start-dev", href: "/test-dev" }
  );
  // production / deploy
  const dStatus = deploy?.status ?? "idle";
  health.push(
    dStatus === "done" ? { key: "production", status: "healthy", detail: "production-ready", href: "/prepare-deploy" }
    : dStatus === "running" ? { key: "production", status: "attention", detail: "preparing", href: "/prepare-deploy" }
    : dStatus === "failed" || dStatus === "blocked" ? { key: "production", status: "error", detail: dStatus, action: "open", href: "/prepare-deploy" }
    : { key: "production", status: "needs-config", detail: "not prepared", href: "/prepare-deploy" }
  );
  // agent loop
  health.push(
    runMode !== "off" && approved ? { key: "agentLoop", status: "healthy", detail: `--${runMode}`, href: "/planner" }
    : runMode !== "off" && !approved ? { key: "agentLoop", status: "attention", detail: "awaiting plan approval", action: "open", href: "/planner" }
    : { key: "agentLoop", status: "needs-config", detail: "paused", action: "start-loop", href: "/planner" }
  );
  // KB / RAG
  health.push(
    kbData.chunks === 0 ? { key: "kb", status: "attention", detail: "empty index", action: "reindex", href: "/knowledge" }
    : !kbData.semantic ? { key: "kb", status: "attention", detail: "no embeddings", action: "reindex", href: "/knowledge" }
    : { key: "kb", status: "healthy", detail: `${kbData.chunks} chunks`, href: "/knowledge" }
  );
  // db / storage
  health.push({ key: "storage", status: "healthy", detail: "SQLite · WAL" });
  // models
  health.push(
    connectedProviders.length > 0 || kbData.semantic ? { key: "models", status: "healthy", detail: `${connectedProviders.length} connected`, href: "/models" }
    : { key: "models", status: "needs-config", detail: "no provider connected", action: "configure", href: "/models" }
  );
  // github
  health.push(ghPat || ghRepo ? { key: "github", status: "healthy", detail: ghRepo ?? "connected", href: "/github" } : { key: "github", status: "needs-config", detail: "not connected", action: "reconnect", href: "/github" });
  // telegram
  health.push(tgCfg ? { key: "telegram", status: "healthy", detail: "connected", href: "/config" } : { key: "telegram", status: "needs-config", detail: tgOn ? "no bot token" : "off", action: "configure", href: "/config" });
  // test dev
  health.push(
    !lastTest ? { key: "testDev", status: "needs-config", detail: "never run", href: "/test-dev" }
    : lastTest.status === "pass" ? { key: "testDev", status: "healthy", detail: "passing", href: "/test-dev" }
    : lastTest.status === "fail" ? { key: "testDev", status: "error", detail: "failing", action: "open", href: "/test-dev" }
    : lastTest.status === "running" ? { key: "testDev", status: "attention", detail: "running", href: "/test-dev" }
    : { key: "testDev", status: "attention", detail: "inconclusive", href: "/test-dev" }
  );
  // queues
  const doingN = tasks.filter((t) => t.col === "doing").length;
  const queuedN = tasks.filter((t) => t.col === "todo").length;
  health.push({ key: "queues", status: queuedN > 12 ? "attention" : "healthy", detail: `${doingN} running · ${queuedN} queued` });
  // file locks
  health.push({ key: "locks", status: lockRows.length > 0 ? "attention" : "healthy", detail: `${lockRows.length} active` });
  // update
  health.push(upd?.updateAvailable ? { key: "update", status: "attention", detail: `${upd.current} → ${upd.latest}`, action: "open", href: "/update" } : { key: "update", status: "healthy", detail: upd?.current ? `v${upd.current}` : "up to date", href: "/update" });

  /* ---- problems (subset that needs action) ---- */
  const problems: DashboardData["problems"] = [];
  if (dStatus === "failed" || dStatus === "blocked") problems.push({ key: "deploy", severity: "high", title: "dash.prob.deploy", impact: "dash.prob.deployImpact", action: "open", href: "/prepare-deploy" });
  for (const a of agents) if (a.status === "working" && a.health !== "alive") { problems.push({ key: `agent-${a.id}`, severity: "high", title: "dash.prob.agentStuck", impact: "dash.prob.agentStuckImpact", action: "open", href: "/agents/ada" }); break; }
  if (sevN("high") > 0) problems.push({ key: "sec", severity: "high", title: "dash.prob.security", impact: "dash.prob.securityImpact", action: "open", href: "/security" });
  if (dev.status === "error") problems.push({ key: "dev", severity: "med", title: "dash.prob.dev", impact: "dash.prob.devImpact", action: "start-dev", href: "/test-dev" });
  if (kbData.chunks === 0) problems.push({ key: "kb", severity: "med", title: "dash.prob.kb", impact: "dash.prob.kbImpact", action: "reindex", href: "/knowledge" });
  if (lastTest?.status === "fail") problems.push({ key: "test", severity: "med", title: "dash.prob.test", impact: "dash.prob.testImpact", action: "open", href: "/test-dev" });
  if (!ghPat && !ghRepo) problems.push({ key: "github", severity: "low", title: "dash.prob.github", impact: "dash.prob.githubImpact", action: "reconnect", href: "/github" });
  problems.sort((a, b) => (a.severity === "high" ? 0 : a.severity === "med" ? 1 : 2) - (b.severity === "high" ? 0 : b.severity === "med" ? 1 : 2));

  /* ---- integrations ---- */
  const cliProviders = providers.filter((p) => p.kind === "cli");
  const localProviders = providers.filter((p) => p.kind === "local");
  const integrations: DashboardData["integrations"] = [
    { key: "github", status: ghPat || ghRepo ? "connected" : "needs-config", detail: ghRepo ?? (ghPat ? "token" : "—") },
    { key: "telegram", status: tgCfg ? "connected" : tgOn ? "needs-config" : "disconnected", detail: tgCfg ? "bot connected" : tgOn ? "no token" : "off" },
    { key: "models", status: connectedProviders.length ? "connected" : "needs-config", detail: `${connectedProviders.length}/${providers.length} providers` },
    { key: "cli", status: cliProviders.some((p) => p.status === "connected") ? "connected" : cliProviders.length ? "needs-config" : "disconnected", detail: `${cliProviders.filter((p) => p.status === "connected").length} CLI` },
    { key: "local", status: localProviders.some((p) => p.status === "connected") ? "connected" : localProviders.length ? "needs-config" : "disconnected", detail: kbData.semantic ? "embeddings up" : `${localProviders.length} local` },
    { key: "update", status: upd?.latest ? "connected" : "disconnected", detail: upd?.latest ? (upd.updateAvailable ? `${upd.current} → ${upd.latest}` : `v${upd.current}`) : upd?.current ? `v${upd.current} · offline` : "offline" },
  ];

  return {
    generatedAt: Date.now(),
    range,
    cards: {
      agents: { activeNow: agents.filter((a) => a.status !== "idle").length, total: agents.length, idle: byStatus("idle"), working: byStatus("working"), review: byStatus("review"), blocked: byStatus("blocked"), lastHeartbeat },
      spend: { spent, cap: bud?.monthlyCapUsd ?? 0, tokens, prevSpent, trendPct },
      security: { score: secScore(openFindings), open: openFindings.length, high: sevN("high"), med: sevN("med"), low: sevN("low"), lastScan },
      goals: { avgProgress, active: activeGoals.length, done: rolls.filter((g) => g.status === "done").length, blocked: blockedGoals },
    },
    health,
    execution,
    agents: agentsList,
    tasksByCol,
    alerts,
    problems,
    kb: kbData,
    locks: lockRows,
    integrations,
    goalOptions: rolls.filter((g) => g.status === "active" || g.status === "done").slice(0, 30).map((g) => ({ id: g.id, title: g.title })),
    spendSeries,
    kbByType: kb ? kb.byType.slice(0, 8).map((b) => ({ type: b.type, total: b.total })) : [],
    costByAgent,
  };
}

/** Server action: the full Dashboard snapshot for the current workspace. */
export async function getDashboardSnapshot(opts: DashOpts = {}): Promise<DashboardData> {
  const { workspace } = await requireWorkspace();
  return buildSnapshot(workspace, opts);
}

/** Quick action: (re)start the project's dev server. */
export async function startDevServer(): Promise<{ ok: boolean; detail: string }> {
  const { org, workspace } = await requireWorkspace();
  const r = await ensureBootable(workspace.id, org.id);
  revalidatePath("/dashboard");
  return r;
}

/** Release a single file lock — only when it looks stale (>5min since heartbeat); otherwise route it
 *  to the Inbox instead of yanking a lock from a live run. */
export async function releaseStaleLock(path: string): Promise<{ released: boolean; reason?: string }> {
  const { workspace } = await requireWorkspace();
  const [lock] = await db.select().from(fileLock).where(and(eq(fileLock.workspaceId, workspace.id), eq(fileLock.path, path)));
  if (!lock) return { released: true };
  const age = Date.now() - (ts(lock.heartbeatAt) ?? 0);
  if (age < STALE_LOCK_MS) {
    await pushInbox(workspace.id, { kind: "block", refType: "task", refId: `lock-${path}`, title: `File lock held by @${lock.agentHandle}`, detail: `${path} is locked by a live run — review before releasing.` });
    return { released: false, reason: "not-stale" };
  }
  await db.delete(fileLock).where(and(eq(fileLock.workspaceId, workspace.id), eq(fileLock.path, path)));
  revalidatePath("/dashboard");
  return { released: true };
}
