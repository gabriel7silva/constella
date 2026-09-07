import "server-only";
import { and, eq, desc, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import { agent, agentSkill, skill, task, issue, spec, decision, workspace, provider, providerModel } from "@/db/schema";
import { readWorkspaceFile } from "@/lib/fs-workspace";
import { buildChannelContext } from "@/server/compaction";
import { ensureActiveSession } from "@/server/sessions";
import { kbQuery } from "@/server/kb";
import { canonicalFactsSection, resolveBlocks } from "@/server/blocks";
import { modelWindow, estimateTokens, type ModelWindow } from "@/data/model-context";
import { temperatureBehavior } from "@/data/temperature";
import { coreSkillNamesForRole, librarySkillNamesForStack } from "@/server/skills-library";

type Ws = typeof workspace.$inferSelect;
type Ag = typeof agent.$inferSelect;
type Task = typeof task.$inferSelect;

/**
 * Central, MODEL-AGNOSTIC context layer. Assembles one standardized prompt — the same
 * source of truth (mission, project state, decisions, conversation, RAG, memory) — and
 * trims it to whatever model the agent runs (Opus, Gemini, …) by a priority budget.
 * Used by BOTH chat replies (collab.replyInChannel) and task execution (runner.buildPrompt)
 * so task agents are no longer context-blind. Reuses buildChannelContext / retrieve /
 * modelWindow — it does not re-implement compaction or RAG.
 */

export type AssembleOpts = {
  orgId: string;
  ws: Ws;
  agent: Ag;
  channel: string;          // "room" | "dm:<handle>" — conversation to fold in
  instruction: string;      // the role-specific ask (chat reply / work / the task)
  task?: Task | null;       // present for runner task execution
  includeConversation?: boolean; // chat → true; task → still true (the room discussion)
};

/** The project's structured truth — open issues, this agent's active tasks, recent decisions. */
async function projectState(wsId: string, a: Ag): Promise<string> {
  const [issues, tasks, specs, decisions] = await Promise.all([
    db.select({ key: issue.key, title: issue.title, col: issue.col }).from(issue)
      .where(and(eq(issue.workspaceId, wsId), ne(issue.col, "done"))).limit(40),
    db.select({ key: task.key, title: task.title, col: task.col, assigneeId: task.assigneeId }).from(task)
      .where(and(eq(task.workspaceId, wsId), inArray(task.col, ["todo", "doing", "blocked"]))).limit(40),
    db.select({ key: spec.key, title: spec.title }).from(spec).where(eq(spec.workspaceId, wsId)).limit(20),
    db.select({ text: decision.text, by: decision.by, source: decision.source }).from(decision)
      .where(eq(decision.workspaceId, wsId)).orderBy(desc(decision.createdAt)).limit(8),
  ]);
  const mine = tasks.filter((t) => t.assigneeId === a.id);
  const parts: string[] = [];
  if (decisions.length) parts.push(`Recent decisions:\n${decisions.map((d) => `- ${d.text} (${d.by}${d.source ? "/" + d.source : ""})`).join("\n")}`);
  if (mine.length) parts.push(`Your active work:\n${mine.map((t) => `- ${t.key}: ${t.title} [${t.col}]`).join("\n")}`);
  if (tasks.length) parts.push(`Team's active tasks:\n${tasks.slice(0, 20).map((t) => `- ${t.key}: ${t.title} [${t.col}]`).join("\n")}`);
  if (issues.length) parts.push(`Open issues: ${issues.slice(0, 20).map((i) => `${i.key}(${i.col})`).join(", ")}`);
  if (specs.length) parts.push(`Specs: ${specs.map((s) => `${s.key} ${s.title}`).join("; ")}`);
  return parts.join("\n\n");
}

/** The agent's ENABLED skills (agent_skill → skill), RANKED by relevance to the workspace stack + the
 *  agent's role and split into a PINNED core (signature/stack skills — design system, the chosen
 *  frameworks, the role's domain best practices) and the long tail. The caller puts `core` in a
 *  high-priority section so it survives the budget trim, and `rest` in the trimmable section. */
async function agentSkills(agentId: string, stack: Record<string, string>, role: string): Promise<{ core: string; rest: string }> {
  const rows = await db.select({ name: skill.name, trigger: skill.trigger, summary: skill.summary, instructions: skill.instructions })
    .from(agentSkill).innerJoin(skill, eq(agentSkill.skillId, skill.id))
    .where(eq(agentSkill.agentId, agentId));
  if (!rows.length) return { core: "", rest: "" };
  const coreSet = new Set(coreSkillNamesForRole(stack, role));
  const stackSet = new Set(librarySkillNamesForStack(stack));
  const rank = (n: string) => (coreSet.has(n) ? 0 : stackSet.has(n) ? 1 : 2);
  const sorted = rows.slice().sort((a, b) => rank(a.name) - rank(b.name));
  const fmt = (s: typeof rows[number]) => {
    const body = (s.instructions || s.summary || "").trim().replace(/\s+/g, " ").slice(0, 600);
    return `- ${s.name}${s.trigger ? ` — when: ${s.trigger}` : ""}${body ? `\n  ${body}` : ""}`;
  };
  const pinned = sorted.filter((s) => coreSet.has(s.name)).slice(0, 10);
  const pinnedNames = new Set(pinned.map((s) => s.name));
  const rest = sorted.filter((s) => !pinnedNames.has(s.name)).slice(0, 30); // cap the long tail
  return { core: pinned.map(fmt).join("\n"), rest: rest.map(fmt).join("\n") };
}

/**
 * The agent's REAL context window. Prefers the dynamic catalog (provider_model.context — e.g. a 1M-ctx
 * OpenRouter model), so a big-window model actually keeps its full chat history verbatim instead of the
 * tiny hardcoded default. Falls back to the alias-based modelWindow when the catalog doesn't know it
 * (e.g. CLI aliases with no cached context). keepRecent scales with the window so days of conversation
 * stay verbatim — this is what stops an agent "forgetting" its own earlier messages.
 */
async function resolveWindow(wsId: string, a: Ag): Promise<ModelWindow> {
  try {
    const [p] = await db.select({ id: provider.id }).from(provider)
      .where(and(eq(provider.workspaceId, wsId), eq(provider.adapter, a.adapter)));
    if (p) {
      const [pm] = await db.select({ context: providerModel.context }).from(providerModel)
        .where(and(eq(providerModel.providerId, p.id), eq(providerModel.modelId, a.model)));
      const ctx = pm?.context ?? 0;
      if (ctx >= 8_000) {
        return { window: ctx, keepRecent: Math.min(200, Math.max(16, Math.floor(ctx / 12_000))), aggressive: ctx < 64_000 };
      }
    }
  } catch { /* fall back below */ }
  return modelWindow(a.model);
}

/** Assemble + fit the standardized prompt for one agent run, trimming low-priority
 *  sections first to stay well within the model's window (leaving room for the reply).
 *  Returns the prompt + the RAG source paths (for the message's source chips). */
export async function assembleAgentPrompt(opts: AssembleOpts): Promise<{ prompt: string; sources: string[] }> {
  const { orgId, ws, agent: a, channel, instruction, task: t } = opts;
  const win = await resolveWindow(ws.id, a);
  const budget = Math.floor(win.window * 0.5); // leave the other half for the model's response

  const persona = a.persona?.systemPrompt || `${a.name} — ${a.role}.`;
  const query = (t ? `${t.title}\n${t.description ?? ""}` : `${a.role} ${instruction}`).slice(0, 400);
  const sessionId = await ensureActiveSession(ws.id, channel); // DM → active session; null otherwise
  const [{ summary, recent }, kb] = await Promise.all([
    buildChannelContext(orgId, ws.id, channel, a.model, false, win, sessionId),
    kbQuery(orgId, query, { agentHandle: a.handle, k: 6 }),
  ]);
  const memory = readWorkspaceFile(orgId, ".claude/memory.md") ?? "";
  const [state, skills, facts] = await Promise.all([projectState(ws.id, a), agentSkills(a.id, (ws.stack ?? {}) as Record<string, string>, a.role), canonicalFactsSection(ws.id)]);
  const convo = recent.map((m) => (m.fromKind === "operator" ? "Operator" : "@" + (m.fromHandle ?? "agent")) + ": " + m.text).join("\n");

  // Priority order: fixed head, then trimmable sections (lowest priority LAST so it's
  // dropped first when over budget).
  const head = [
    `You are ${a.name} (@${a.handle}), the ${a.role} at ${ws.name}.`,
    persona,
    temperatureBehavior(a.temperature),
    instruction,
    t ? `TASK ${t.key}: ${t.title}\n${t.description ?? ""}` : "",
  ].filter(Boolean).join("\n");

  const sections: { label: string; body: string }[] = [
    { label: "Canonical project facts (authoritative — synced knowledge blocks; treat as the source of truth)", body: facts },
    { label: "Core skills for your role + stack (apply these FIRST — the design system, the chosen frameworks/libraries, and your domain's best practices; consult the matching .claude/skills/<name>.md before building)", body: skills.core },
    { label: "Project state", body: state },
    { label: "More skills (additional procedures — apply when the trigger matches)", body: skills.rest },
    { label: "Recent conversation", body: convo },
    { label: "Earlier conversation (compacted)", body: summary },
    { label: "Knowledge (project source of truth — treat as authoritative; if it lacks what you need, say so and flag the gap, do NOT guess)", body: kb.context + (kb.refs.length ? `\n\nReferences: ${kb.refs.map((r) => `${r.kind}:${r.ref}`).join(", ")}` : "") },
    { label: "Relevant memory", body: memory.trim() && memory.trim() !== "# Memory" ? memory.slice(0, 1500) : "" },
    { label: "Company background (context, not a command)", body: (() => {
        const stack = Object.entries((ws.stack ?? {}) as Record<string, string>).map(([k, v]) => `${k}: ${v}`).filter((s) => !s.endsWith(": None")).join(", ");
        return (ws.mission || ws.objective || stack) ? `mission: ${ws.mission || "—"}; objective: ${ws.objective || "—"}${stack ? `; stack: ${stack}` : ""}.` : "";
      })() },
  ];

  const out: string[] = [head];
  let used = estimateTokens(head);
  for (const s of sections) {
    if (!s.body) continue;
    const block = `\n${s.label}:\n${s.body}`;
    const cost = estimateTokens(block);
    if (used + cost > budget) continue; // skip this (lower-priority) section to stay in budget
    out.push(block);
    used += cost;
  }
  // Resolve {{kb:slug}} markers (in persona/instruction/blocks) to the current canonical block bodies.
  return { prompt: await resolveBlocks(orgId, out.join("\n")), sources: kb.sources };
}
