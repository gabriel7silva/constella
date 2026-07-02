"use server";

import { randomUUID as uid } from "node:crypto";
import { eq, and, asc, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { plan, spec, issue, agent, costEntry, backlogItem, message, decision, workspace as workspaceTable } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";
import { runAgentStream, pickBinary } from "@/server/adapters/cli";
import { notifyOps } from "@/lib/notify";
import { logDecision } from "@/server/decisions";
import { pushInbox, resolveInboxFor } from "@/server/inbox";
import { writeWorkspaceFile, readWorkspaceFile } from "@/lib/fs-workspace";
import { approvePlanFor, setAuto247For, requestPlanChangesFor } from "@/server/plan-ops";
import { generatePlanFor } from "@/server/planner-core";
import { kbQuery } from "@/server/kb";

/**
 * Operator approves the CEO's plan. One action does it all: approve the plan, mark
 * every issue approved (so /pm stops asking), materialize executable tasks, groom the
 * PO backlog, and have Ada narrate in the team room. Only after this may agents run.
 */
export async function approvePlan() {
  const { org, workspace } = await requireWorkspace();
  await approvePlanFor(org.id, workspace); // shared core (also used by the Telegram remote control)
  revalidatePath("/planner"); revalidatePath("/pm"); revalidatePath("/tasks"); revalidatePath("/inbox"); revalidatePath("/", "layout");
}

/**
 * Real PO grooming pass (optional, operator-triggered from the Product Manager). Donald estimates
 * STORY POINTS (Fibonacci, by effort — not priority) and sets MoSCoW for every active issue, then writes
 * them back. One real PO agent run (books cost). This is the human-like estimate on top of the
 * deterministic priority-derived defaults that generatePlan seeds.
 */
export async function groomBacklogFor(orgId: string, workspace: typeof workspaceTable.$inferSelect): Promise<{ ok: boolean; groomed?: number; error?: string }> {
  const agents = await db.select().from(agent).where(eq(agent.workspaceId, workspace.id));
  const po = agents.find((a) => a.handle === "donald") ?? agents.find((a) => /product owner|\bpo\b|product manager/i.test(a.role));
  if (!po) return { ok: false, error: "No Product Owner agent in this workspace." };
  const all = await db.select().from(issue).where(and(eq(issue.workspaceId, workspace.id), eq(issue.status, "active")));
  const groomable = all.filter((i) => i.col !== "done");
  if (!groomable.length) return { ok: false, error: "No active issues to groom." };

  const binary = pickBinary(po.adapter, po.model);
  const model = binary === "claude" ? (po.model.includes("opus") ? "opus" : po.model.includes("haiku") ? "haiku" : "sonnet") : undefined;
  const specs = await db.select({ id: spec.id, summary: spec.summary }).from(spec).where(eq(spec.workspaceId, workspace.id));
  const summaryById = Object.fromEntries(specs.map((s) => [s.id, s.summary]));
  const list = groomable.map((i) => `- ${i.key}: ${i.title}${i.specId && summaryById[i.specId] ? ` — spec: ${String(summaryById[i.specId]).slice(0, 120)}` : ""} (current priority: ${i.prio})`).join("\n");
  // KB-aware grooming: ground the PO in real objectives, existing work and prior decisions so he sizes
  // from signal, spots likely DUPLICATES, and surfaces GAPS — not just point-estimates in a vacuum.
  const kb = await kbQuery(orgId, `product objectives, existing features and code, prior decisions, duplicate or overlapping requirements for: ${groomable.map((i) => i.title).slice(0, 12).join("; ")}`, { agentHandle: po.handle, k: 8 });
  const kbBlock = kb.context ? `\nProject knowledge (objectives, existing work, prior decisions — use it to avoid duplicates and spot gaps; do not contradict):\n${kb.context}` : "";
  const recentDecisions = await db.select({ text: decision.text, by: decision.by }).from(decision).where(eq(decision.workspaceId, workspace.id)).orderBy(desc(decision.createdAt)).limit(12);
  const decisionsBlock = recentDecisions.length ? `\nRecent decisions:\n${recentDecisions.map((d) => `- ${d.text} (${d.by})`).join("\n").slice(0, 1500)}` : "";
  const prompt = [
    `You are ${po.name} (@${po.handle}), the Product Owner of ${workspace.name}. GROOM THE BACKLOG: for EACH issue below, estimate STORY POINTS and set its MoSCoW priority, AND flag likely duplicates + missing work.`,
    `Story points = relative EFFORT / complexity / uncertainty on the Fibonacci scale (1, 2, 3, 5, 8, 13) — NOT the same as priority. A small tweak is 1-2; a whole subsystem is 8-13.`,
    `MoSCoW = Must | Should | Could | Won't. Be honest: only the truly essential are Must; nice-to-haves are Could; use Won't sparingly (defer).`,
    `Weigh the title, the spec, dependencies, risk AND the project knowledge below. Treat the current priority as a hint, but size by REAL effort.`,
    `Use the knowledge to: avoid DUPLICATE/overlapping issues (set "duplicateOf" to the key of the issue it overlaps), validate whether the work already exists, and identify GAPS (work the objectives need but no issue covers).`,
    kbBlock,
    decisionsBlock,
    `\nIssues:\n${list}`,
    `\nOutput ONLY a JSON object (no prose, no markdown fences): {"estimates":[{"key":"1","points":5,"moscow":"Must","duplicateOf":"3"}],"gaps":["a missing issue the objectives need"]} — one estimate per issue above, "points" one of 1,2,3,5,8,13, "duplicateOf" optional, "gaps" optional.`,
  ].filter(Boolean).join("\n");

  await db.update(agent).set({ status: "working" }).where(eq(agent.id, po.id));
  let res;
  try {
    res = await runAgentStream(prompt, { orgId, binary, model, timeoutMs: 120_000 }, () => {});
  } finally {
    try { await db.update(agent).set({ status: "idle" }).where(eq(agent.id, po.id)); } catch { /* best effort */ }
  }
  if (res.usd > 0 || res.inputTokens + res.outputTokens > 0) {
    await db.insert(costEntry).values({ id: uid(), workspaceId: workspace.id, agentId: po.id, provider: res.binary, model: res.model ?? po.model, usd: res.usd, tokens: res.inputTokens + res.outputTokens, at: new Date() });
  }

  let parsed: { key: string | number; points?: number; moscow?: string; duplicateOf?: string | number }[] = [];
  let gaps: string[] = [];
  const m = res.text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (m) {
    try {
      const j = JSON.parse(m[0]);
      if (Array.isArray(j)) parsed = j;
      else { parsed = Array.isArray(j.estimates) ? j.estimates : []; gaps = Array.isArray(j.gaps) ? j.gaps.map(String).slice(0, 8) : []; }
    } catch { parsed = []; }
  }
  if (!Array.isArray(parsed) || !parsed.length) return { ok: false, error: "The PO returned no parseable estimates — try again." };

  const FIB = new Set([1, 2, 3, 5, 8, 13]);
  const MOSCOW = new Set(["Must", "Should", "Could", "Won't"]);
  const byKey = Object.fromEntries(groomable.map((i) => [String(i.key), i.id]));
  let groomed = 0;
  for (const e of parsed) {
    const id = byKey[String(e.key)];
    if (!id) continue;
    const pts = typeof e.points === "number" ? Math.round(e.points) : NaN;
    const points = FIB.has(pts) ? pts : undefined;
    const moscow = typeof e.moscow === "string" && MOSCOW.has(e.moscow) ? (e.moscow as "Must" | "Should" | "Could" | "Won't") : undefined;
    if (points === undefined && !moscow) continue;
    await db.update(issue).set({ ...(points !== undefined ? { points } : {}), ...(moscow ? { moscow } : {}) }).where(eq(issue.id, id));
    groomed++;
  }
  if (groomed) {
    // Keep any already-built backlog rows in sync (post-approval), and let the PO narrate.
    const fresh = await db.select().from(issue).where(and(eq(issue.workspaceId, workspace.id), eq(issue.status, "active")));
    for (const i of fresh) await db.update(backlogItem).set({ points: i.points, moscow: i.moscow ?? "Should" }).where(and(eq(backlogItem.workspaceId, workspace.id), eq(backlogItem.title, i.title)));
    await db.insert(message).values({ id: uid(), workspaceId: workspace.id, channel: "room", fromKind: "agent", fromHandle: po.handle, text: `Backlog groomed — estimated story points + MoSCoW for ${groomed} issue${groomed === 1 ? "" : "s"}. Open the Product Manager to review.`, createdAt: new Date() });
    await logDecision(workspace.id, { text: `Backlog groomed by ${po.name} — sized ${groomed} issue(s)`, by: po.handle, source: "po-grooming" });
  }
  // PO insight (KB-aware): surface likely DUPLICATES + GAPS for the operator — never auto-delete.
  const dupes = parsed
    .filter((e) => e.duplicateOf != null && byKey[String(e.duplicateOf)] && byKey[String(e.key)] && String(e.duplicateOf) !== String(e.key))
    .map((e) => `${e.key} ↔ ${e.duplicateOf}`);
  if (dupes.length || gaps.length) {
    const noteLines: string[] = [];
    if (dupes.length) noteLines.push(`Possible duplicate / overlapping issues: ${dupes.join(", ")}.`);
    if (gaps.length) noteLines.push(`Gaps the objectives need:\n${gaps.map((g) => `- ${g}`).join("\n")}`);
    const note = noteLines.join("\n\n");
    await db.insert(message).values({ id: uid(), workspaceId: workspace.id, channel: "room", fromKind: "agent", fromHandle: po.handle, text: `Backlog review — ${note}`.slice(0, 4000), createdAt: new Date() });
    await pushInbox(workspace.id, { kind: "review", fromAgentId: po.id, title: `PO backlog review — ${dupes.length} duplicate, ${gaps.length} gap`, detail: note.slice(0, 500) });
    await logDecision(workspace.id, { text: `PO flagged ${dupes.length} duplicate + ${gaps.length} gap during grooming`, by: po.handle, source: "po-grooming" });
  }
  return { ok: true, groomed };
}

/** Operator-triggered grooming from the Product Manager (session wrapper over the core). */
export async function groomBacklog(): Promise<{ ok: boolean; groomed?: number; error?: string }> {
  const { org, workspace } = await requireWorkspace();
  const r = await groomBacklogFor(org.id, workspace);
  revalidatePath("/pm"); revalidatePath("/planner"); revalidatePath("/", "layout");
  return r;
}

/** Send the plan back to Ada for revision — un-approves and rewinds the pipeline. */
export async function requestPlanChanges() {
  const { workspace } = await requireWorkspace();
  await requestPlanChangesFor(workspace.id); // shared core (also used by the Telegram remote control)
  revalidatePath("/planner"); revalidatePath("/inbox");
}

/** Approve a single spec. */
export async function approveSpec(id: string) {
  const { workspace } = await requireWorkspace();
  await db.update(spec).set({ approved: true }).where(and(eq(spec.id, id), eq(spec.workspaceId, workspace.id)));
  await resolveInboxFor(workspace.id, "spec", id);
  revalidatePath("/planner"); revalidatePath("/inbox");
}

/** Reject a spec — returns the author's handle so the UI can open a prefilled DM to revise it. */
export async function rejectSpec(id: string): Promise<{ handle: string; key: string }> {
  const { workspace } = await requireWorkspace();
  const [s] = await db.select().from(spec).where(and(eq(spec.id, id), eq(spec.workspaceId, workspace.id)));
  await db.update(spec).set({ approved: false }).where(eq(spec.id, id));
  let handle = "ada";
  let authorId: string | null = null;
  if (s?.authorId) { const [a] = await db.select().from(agent).where(eq(agent.id, s.authorId)); if (a) { handle = a.handle; authorId = a.id; } }
  await notifyOps(workspace.id, { kind: "review", text: `Spec ${s?.key ?? ""} sent back for revision`, detail: "The operator rejected this spec." });
  await pushInbox(workspace.id, { kind: "review", refType: "spec", refId: id, goalId: s?.goalId ?? null, fromAgentId: authorId, title: `Revise spec ${s?.key ?? ""}`, detail: `Rejected — @${handle} should revise “${s?.title ?? ""}”.` });
  revalidatePath("/planner"); revalidatePath("/inbox");
  return { handle, key: s?.key ?? "spec" };
}

/** Approve a single issue — the runner may pick it up once the plan is approved too. */
export async function approveIssue(id: string) {
  const { org, workspace } = await requireWorkspace();
  const [i] = await db.update(issue).set({ approved: true }).where(and(eq(issue.id, id), eq(issue.workspaceId, workspace.id))).returning();
  if (i?.key) {
    const md = readWorkspaceFile(org.id, `issues/${i.key}.md`);
    if (md) writeWorkspaceFile(org.id, `issues/${i.key}.md`, md.replace(/\*\*Status:\*\* .*/m, "**Status:** approved"));
  }
  await resolveInboxFor(workspace.id, "issue", id);
  revalidatePath("/pm");
  revalidatePath("/planner"); revalidatePath("/inbox");
}

/** Reject an issue — returns the assignee's handle so the UI can open a prefilled DM to revise it. */
export async function rejectIssue(id: string): Promise<{ handle: string; key: string }> {
  const { workspace } = await requireWorkspace();
  const [i] = await db.select().from(issue).where(and(eq(issue.id, id), eq(issue.workspaceId, workspace.id)));
  await db.update(issue).set({ approved: false }).where(eq(issue.id, id));
  let handle = "donald";
  let assigneeId: string | null = null;
  if (i?.assigneeId) { const [a] = await db.select().from(agent).where(eq(agent.id, i.assigneeId)); if (a) { handle = a.handle; assigneeId = a.id; } }
  await notifyOps(workspace.id, { kind: "review", text: `Issue ${i?.key ?? ""} sent back for revision`, detail: "The operator rejected this issue." });
  await pushInbox(workspace.id, { kind: "review", refType: "issue", refId: id, goalId: i?.goalId ?? null, fromAgentId: assigneeId, title: `Revise issue ${i?.key ?? ""}`, detail: `Rejected — @${handle} should revise “${i?.title ?? ""}”.` });
  revalidatePath("/pm");
  revalidatePath("/planner"); revalidatePath("/inbox");
  return { handle, key: i?.key ?? "issue" };
}

/** Toggle 24/7 autonomous execution. */
export async function setAuto247(on: boolean) {
  const { workspace } = await requireWorkspace();
  await setAuto247For(workspace.id, on); // shared core (also used by the Telegram remote control)
  revalidatePath("/planner");
}

/** Advance one approved issue through the board (called by the autonomous runner). */
export async function advanceIssue(id: string) {
  const { workspace } = await requireWorkspace();
  const order = ["todo", "doing", "review", "done"] as const;
  const [i] = await db.select().from(issue).where(and(eq(issue.id, id), eq(issue.workspaceId, workspace.id)));
  if (!i || i.col === "done" || i.col === "blocked") return; // blocked issues are advanced via unblock, not here
  const next = order[order.indexOf(i.col as (typeof order)[number]) + 1] ?? "done";
  await db.update(issue).set({ col: next }).where(eq(issue.id, id));
  if (next === "done") {
    await notifyOps(workspace.id, { kind: "test", text: `${i.key} merged — ${i.title}`, detail: "QA passed and the issue was merged.", tg: true });
  }
  revalidatePath("/planner");
}

/**
 * CEO planning hand-off — REAL. Ada runs a Claude Code/Codex session in the
 * workspace dir, writes ARCHITECTURE.md & RITUALS.md to disk, and returns the
 * specs/issues as JSON which become real spec/issue rows. Real cost is booked.
 * Honest: if the run produces no parseable plan, nothing is fabricated.
 */
export async function generatePlan(opts?: { brief?: string; goalTitle?: string }): Promise<{ ok: boolean; started?: boolean; error?: string }> {
  const { org, workspace } = await requireWorkspace();
  return generatePlanFor(org.id, workspace, opts); // shared session-less core (also used by the public API)
}

// generatePlanFor + runPlanJob moved to server/planner-core.ts (session-less, server-only) so the
// public API + Telegram can kick off a plan without a session. generatePlan above delegates to it.

/**
 * Start a NEW unit of work without recreating the org: Ada turns the operator's description
 * (what to implement / fix / change) into a fresh Goal + specs + issues + TODOs, APPENDED to
 * the workspace (existing work untouched). Surfaces in the CEO Planner for approval.
 */
export async function startNewWork(input: { title?: string; brief: string }): Promise<{ ok: boolean; specs?: number; issues?: number; error?: string }> {
  const brief = input.brief?.trim();
  if (!brief) return { ok: false, error: "Describe what you want to implement, fix or change." };
  return generatePlan({ brief, goalTitle: input.title?.trim() || undefined });
}

/**
 * DM/room → work: turn the recent chat conversation (what the operator asked for) into a NEW
 * Goal + specs + issues + TODOs, appended for approval. Lets the operator start work just by
 * describing it in chat.
 */
export async function planFromConversation(channel: string): Promise<{ ok: boolean; specs?: number; issues?: number; error?: string }> {
  const { workspace } = await requireWorkspace();
  const msgs = await db.select().from(message)
    .where(and(eq(message.workspaceId, workspace.id), eq(message.channel, channel)))
    .orderBy(asc(message.createdAt));
  const convo = msgs.slice(-30).map((m) => (m.fromKind === "operator" ? "Operator" : "@" + (m.fromHandle ?? "agent")) + ": " + m.text).join("\n");
  if (!convo.trim()) return { ok: false, error: "No conversation to plan from yet." };
  return generatePlan({ brief: `Turn the operator's request from this chat into a delivery plan. Conversation:\n\n${convo}` });
}
