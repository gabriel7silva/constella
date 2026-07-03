import { and, eq, gte, ne, desc, inArray, sum, count } from "drizzle-orm";
import { db } from "@/db";
import { agent, goal, spec, issue, task, report, docIndex, finding, costEntry, plan, activity, inboxItem, backlogItem, testRun } from "@/db/schema";
import { listBlocks } from "@/server/blocks";

// Aggregations for the operational Welcome Home. Kept deliberately light (counts + small recent
// slices, not full tables) so the landing page stays fast. The Dashboard owns the heavy metrics.

export type HomeStatus = { activeAgents: number; totalAgents: number; spent: number; avgGoal: number };
export type HomeAreas = { knowledge: number; work: number; team: number; ops: number };

/** Slim status row (agents active · month spend · avg active-goal progress) — links to /dashboard. */
export async function homeStatus(wsId: string): Promise<HomeStatus> {
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const [agents, goals, [costAgg]] = await Promise.all([
    db.select({ status: agent.status }).from(agent).where(eq(agent.workspaceId, wsId)),
    db.select({ progress: goal.progress, status: goal.status }).from(goal).where(eq(goal.workspaceId, wsId)),
    db.select({ usd: sum(costEntry.usd) }).from(costEntry).where(and(eq(costEntry.workspaceId, wsId), gte(costEntry.at, monthStart))),
  ]);
  const active = goals.filter((g) => g.status === "active");
  return {
    activeAgents: agents.filter((a) => a.status !== "idle").length,
    totalAgents: agents.length,
    spent: Number(costAgg?.usd ?? 0),
    avgGoal: active.length ? Math.round(active.reduce((s, g) => s + g.progress, 0) / active.length) : 0,
  };
}

/** Counts behind each of the four big area cards (Knowledge · Work · Team · Ops). */
export async function homeAreas(wsId: string): Promise<HomeAreas> {
  const c1 = (r: { n: number }[]) => Number(r[0]?.n ?? 0);
  const [docs, reports, blocks, goals, specs, issues, tasks, agents, findings] = await Promise.all([
    db.select({ n: count() }).from(docIndex).where(eq(docIndex.workspaceId, wsId)),
    db.select({ n: count() }).from(report).where(eq(report.workspaceId, wsId)),
    listBlocks(wsId),
    db.select({ n: count() }).from(goal).where(and(eq(goal.workspaceId, wsId), eq(goal.status, "active"))),
    db.select({ n: count() }).from(spec).where(and(eq(spec.workspaceId, wsId), eq(spec.status, "active"))),
    db.select({ n: count() }).from(issue).where(and(eq(issue.workspaceId, wsId), eq(issue.status, "active"), ne(issue.col, "done"))),
    db.select({ n: count() }).from(task).where(and(eq(task.workspaceId, wsId), ne(task.col, "done"))),
    db.select({ n: count() }).from(agent).where(eq(agent.workspaceId, wsId)),
    db.select({ n: count() }).from(finding).where(and(eq(finding.workspaceId, wsId), eq(finding.status, "open"))),
  ]);
  return {
    knowledge: c1(docs) + c1(reports) + blocks.length,
    work: c1(goals) + c1(specs) + c1(issues) + c1(tasks),
    team: c1(agents),
    ops: c1(findings),
  };
}

/* ============================================================ H2 — operational sections ====== */

export type RecentItem = { id: string; type: "goal" | "spec" | "issue" | "task" | "report" | "doc" | "test" | "plan"; title: string; status: string; updatedAt: Date | null; agentId: string | null; href: string };

/** The "continue where you left off" feed — only genuinely RESUMABLE work: tasks/issues in progress
 *  or blocked, specs still in refinement, an approved plan awaiting execution, and failed test runs.
 *  Excludes done/cancelled/archived/approved-and-idle items (those are not "continue"). */
export async function homeResumable(wsId: string): Promise<RecentItem[]> {
  const [tasks, issues, specs, fails, [pl]] = await Promise.all([
    db.select().from(task).where(and(eq(task.workspaceId, wsId), inArray(task.col, ["doing", "blocked"]))).orderBy(desc(task.updatedAt)).limit(5),
    db.select().from(issue).where(and(eq(issue.workspaceId, wsId), eq(issue.status, "active"), eq(issue.approved, true), inArray(issue.col, ["doing", "blocked"]))).orderBy(desc(issue.updatedAt)).limit(5),
    db.select().from(spec).where(and(eq(spec.workspaceId, wsId), eq(spec.status, "active"), eq(spec.approved, false))).orderBy(desc(spec.updatedAt)).limit(4),
    db.select().from(testRun).where(and(eq(testRun.workspaceId, wsId), eq(testRun.status, "fail"))).orderBy(desc(testRun.finishedAt)).limit(2),
    db.select().from(plan).where(eq(plan.workspaceId, wsId)),
  ]);
  const items: RecentItem[] = [
    ...tasks.map((tk) => ({ id: tk.id, type: "task" as const, title: tk.title, status: tk.col, updatedAt: tk.updatedAt ?? null, agentId: tk.assigneeId, href: "/tasks" })),
    ...issues.map((i) => ({ id: i.id, type: "issue" as const, title: i.title, status: i.col, updatedAt: i.updatedAt ?? null, agentId: i.assigneeId, href: "/planner" })),
    ...specs.map((s) => ({ id: s.id, type: "spec" as const, title: s.title, status: "refining", updatedAt: s.updatedAt ?? null, agentId: s.authorId, href: "/planner" })),
    ...fails.map((f) => ({ id: f.id, type: "test" as const, title: f.summary || "Test run failed", status: "failed", updatedAt: f.finishedAt ?? null, agentId: null, href: "/test-dev" })),
  ];
  // An approved plan that isn't running yet is the single most important thing to resume.
  if (pl?.approved && !pl.auto247) {
    items.unshift({ id: "plan", type: "plan", title: "Approved plan — start execution", status: "ready", updatedAt: pl.updatedAt ?? new Date(0), agentId: null, href: "/planner" });
  }
  return items.filter((i) => i.updatedAt).sort((a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0)).slice(0, 6);
}

export type DecisionItem = {
  id: string; kind: "approval" | "budget" | "question" | "review" | "block" | "validation";
  title: string; detail: string; refType: string | null; refId: string | null; channel: string | null;
  fromName: string | null; fromColor: string | null; fromHealth: "alive" | "stale" | "down" | null;
  createdAt: Date | string | null;
};

/** Unresolved items that genuinely need the operator's decision (approvals, reviews, blocks, budget). */
export async function homeDecisions(wsId: string): Promise<DecisionItem[]> {
  const rows = await db.select({
    id: inboxItem.id, kind: inboxItem.kind, title: inboxItem.title, detail: inboxItem.detail,
    refType: inboxItem.refType, refId: inboxItem.refId, channel: inboxItem.channel, createdAt: inboxItem.createdAt,
    fromName: agent.name, fromColor: agent.color, fromHealth: agent.health,
  }).from(inboxItem).leftJoin(agent, eq(inboxItem.fromAgentId, agent.id))
    .where(and(eq(inboxItem.workspaceId, wsId), eq(inboxItem.resolved, false), inArray(inboxItem.kind, ["approval", "review", "block", "budget"])))
    .orderBy(desc(inboxItem.createdAt)).limit(6);
  return rows as DecisionItem[];
}

export type ActivityRow = { id: string; action: string; target: string; at: Date | null; agentName: string | null; agentColor: string | null; agentHealth: "alive" | "stale" | "down" | null };

/** Recent agent actions (flat, newest first) — the home timeline groups them by day client-side. */
export async function homeActivity(wsId: string): Promise<ActivityRow[]> {
  const rows = await db.select({
    id: activity.id, action: activity.action, target: activity.target, at: activity.at,
    agentName: agent.name, agentColor: agent.color, agentHealth: agent.health,
  }).from(activity).leftJoin(agent, eq(activity.agentId, agent.id))
    .where(eq(activity.workspaceId, wsId)).orderBy(desc(activity.at)).limit(24);
  return rows as ActivityRow[];
}

export type PoSnapshot = {
  activeGoals: number; specsAwaiting: number; backlog: number; planApproved: boolean; auto247: boolean;
  topIssues: { key: string; title: string; prio: string; col: string }[];
  nextSteps: { key: string; href: string }[];
};

/** Product & planning snapshot for the PO section. */
export async function homePoSnapshot(wsId: string): Promise<PoSnapshot> {
  const [goals, specs, issues, backlog, [pl]] = await Promise.all([
    db.select({ id: goal.id, status: goal.status }).from(goal).where(eq(goal.workspaceId, wsId)),
    db.select({ id: spec.id, status: spec.status, approved: spec.approved }).from(spec).where(eq(spec.workspaceId, wsId)),
    db.select({ key: issue.key, title: issue.title, prio: issue.prio, col: issue.col, status: issue.status }).from(issue).where(eq(issue.workspaceId, wsId)),
    db.select({ n: count() }).from(backlogItem).where(eq(backlogItem.workspaceId, wsId)),
    db.select().from(plan).where(eq(plan.workspaceId, wsId)),
  ]);
  const activeGoals = goals.filter((g) => g.status === "active").length;
  const specsAwaiting = specs.filter((s) => s.status === "active" && !s.approved).length;
  const openIssues = issues.filter((i) => i.status === "active" && i.col !== "done");
  const rank: Record<string, number> = { high: 0, med: 1, low: 2 };
  const topIssues = [...openIssues].sort((a, b) => (rank[a.prio] ?? 9) - (rank[b.prio] ?? 9)).slice(0, 4)
    .map((i) => ({ key: i.key, title: i.title, prio: i.prio, col: i.col }));
  const inReview = openIssues.filter((i) => i.col === "review").length;
  const nextSteps: { key: string; href: string }[] = [];
  if (activeGoals === 0) nextSteps.push({ key: "po.next.firstPlan", href: "/planner" });
  if (pl && !pl.approved) nextSteps.push({ key: "po.next.approvePlan", href: "/planner" });
  if (specsAwaiting > 0) nextSteps.push({ key: "po.next.refineSpecs", href: "/planner" });
  if (inReview > 0) nextSteps.push({ key: "po.next.reviewIssues", href: "/pm" });
  if (nextSteps.length === 0) nextSteps.push({ key: "po.next.allClear", href: "/pm" });
  return { activeGoals, specsAwaiting, backlog: Number(backlog[0]?.n ?? 0), planApproved: !!pl?.approved, auto247: !!pl?.auto247, topIssues, nextSteps };
}

export type DocItem = { id: string; kind: string; title: string; path: string; updatedAt: Date | null };
export type SuggestedDoc = { key: string; href: string };
export type HomeDocs = { recent: DocItem[]; suggested: SuggestedDoc[] };

/** Recent documents + a small deterministic "suggested for this project" list derived from state. */
export async function homeDocs(wsId: string): Promise<HomeDocs> {
  const [docs, [findingHigh], [pl]] = await Promise.all([
    db.select({ id: docIndex.id, kind: docIndex.kind, title: docIndex.title, path: docIndex.path, updatedAt: docIndex.updatedAt })
      .from(docIndex).where(eq(docIndex.workspaceId, wsId)).orderBy(desc(docIndex.updatedAt)).limit(6),
    db.select({ n: count() }).from(finding).where(and(eq(finding.workspaceId, wsId), eq(finding.status, "open"), eq(finding.sev, "high"))),
    db.select().from(plan).where(eq(plan.workspaceId, wsId)),
  ]);
  const paths = docs.map((d) => d.path.toLowerCase());
  const has = (frag: string) => paths.some((p) => p.includes(frag));
  const suggested: SuggestedDoc[] = [];
  if (docs.length === 0) suggested.push({ key: "docs.sugg.first", href: "/docs" });
  if (docs.length > 0 && !has("architecture")) suggested.push({ key: "docs.sugg.architecture", href: "/docs" });
  if (pl?.approved && !has("deploy")) suggested.push({ key: "docs.sugg.deploy", href: "/prepare-deploy" });
  if (Number(findingHigh?.n ?? 0) > 0) suggested.push({ key: "docs.sugg.qa", href: "/security" });
  return { recent: docs, suggested: suggested.slice(0, 4) };
}
