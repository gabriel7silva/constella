"use server";

import { randomUUID as uid } from "node:crypto";
import { eq, and, asc, like } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { message, agent, messageSummary, event, task, issue, goal, spec } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";
import { replyInChannel, relayRoomMentions } from "@/server/collab";
import { planFromConversation } from "@/server/planner";
import { logDecision } from "@/server/decisions";
import { wake } from "@/server/bus";
import { scheduleChatReindex } from "@/server/rag";
import { ingestKnowledge, kbAnswer } from "@/server/kb";
import { ensureActiveSession, sessionsFor, newSession, activateSession, renameSessionRow, deleteSessionRow } from "@/server/sessions";

function mentions(text: string): string[] {
  return [...text.matchAll(/@([a-z0-9-]+)/gi)].map((m) => m[1].toLowerCase());
}

/** Live goals/specs/issues for the in-room `#`-reference autocomplete + `#KEY` chip linkify. */
export async function listChatRefs(): Promise<{ kind: "goal" | "spec" | "issue"; key: string; title: string; id: string }[]> {
  const { workspace } = await requireWorkspace();
  const [goals, specs, issues] = await Promise.all([
    db.select({ id: goal.id, title: goal.title }).from(goal).where(and(eq(goal.workspaceId, workspace.id), eq(goal.status, "active"))),
    db.select({ id: spec.id, key: spec.key, title: spec.title }).from(spec).where(and(eq(spec.workspaceId, workspace.id), eq(spec.status, "active"))),
    db.select({ id: issue.id, key: issue.key, title: issue.title }).from(issue).where(eq(issue.workspaceId, workspace.id)),
  ]);
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "goal";
  const out: { kind: "goal" | "spec" | "issue"; key: string; title: string; id: string }[] = [];
  for (const g of goals.slice(0, 60)) out.push({ kind: "goal", key: slug(g.title), title: g.title, id: g.id });
  for (const s of specs.slice(0, 80)) out.push({ kind: "spec", key: s.key, title: s.title, id: s.id });
  for (const i of issues.slice(0, 150)) out.push({ kind: "issue", key: i.key, title: i.title, id: i.id });
  return out;
}

type Attachment = { name: string; type: string; size: number; path: string };

/** Send a message (+ optional attachments). Returns the agent handles that should respond. */
export async function sendMessage(channel: string, text: string, attachments?: Attachment[]): Promise<{ responders: string[] }> {
  const { org, workspace } = await requireWorkspace();
  const agents = await db.select().from(agent).where(eq(agent.workspaceId, workspace.id));
  const handles = new Set(agents.map((a) => a.handle));
  // Slash commands (room + DM, not Telegram): intercept before the normal message path.
  const trimmed = (text ?? "").trim();
  if (trimmed.startsWith("/") && channel !== "telegram") {
    const { runSlashCommand } = await import("@/server/commands");
    const r = await runSlashCommand(org.id, workspace.id, agents, channel, trimmed);
    if (r.handled) { revalidatePath("/", "layout"); return { responders: r.responders }; }
  }
  let responders: string[] = [];
  if (channel.startsWith("dm:")) {
    const h = channel.slice(3); if (handles.has(h)) responders = [h];
  } else if (channel === "telegram") {
    // The isolated Telegram thread talks to the CEO (Ada) — she always answers, like a private
    // chat. Falls back to the first agent if there's no `ada` handle.
    responders = handles.has("ada") ? ["ada"] : agents.slice(0, 1).map((a) => a.handle);
  } else {
    // Team Room: a message must @mention a real teammate — otherwise no one replies, so we don't
    // post a dead-end message (the composer blocks this client-side; this is the server guard).
    responders = mentions(text).filter((h) => handles.has(h)).slice(0, 3);
    if (responders.length === 0) return { responders: [] };
  }
  const sessionId = await ensureActiveSession(workspace.id, channel); // DM → active session; else null
  await db.insert(message).values({ id: uid(), workspaceId: workspace.id, channel, fromKind: "operator", text, attachments: attachments?.length ? attachments.slice(0, 10) : null, sessionId });
  wake(workspace.id); // push the operator's message to any open SSE stream immediately
  scheduleChatReindex(workspace.orgId); // index the conversation into RAG (Knowledge agent)
  // A substantive operator directive in the team room is a decision the agents must honor.
  if (channel === "room" && text.trim().length >= 15) {
    await logDecision(workspace.id, { text: text.slice(0, 400), by: "operator", source: "operator-instruction" });
  }
  revalidatePath("/", "layout");
  return { responders };
}

/** A real agent reply — runs the agent's CLI over the recent conversation, books real cost,
 *  and (in the team room) lets the conversation continue: any teammate it @mentions replies next. */
export async function agentRespond(channel: string, handle: string): Promise<void> {
  const { org, workspace } = await requireWorkspace();
  const [a] = await db.select().from(agent).where(and(eq(agent.workspaceId, workspace.id), eq(agent.handle, handle)));
  if (!a) return;
  await db.update(agent).set({ status: "working" }).where(eq(agent.id, a.id));
  const { text: reply, planRequested } = await replyInChannel(org.id, workspace, channel, a, "chat");
  await db.update(agent).set({ status: "idle" }).where(eq(agent.id, a.id));

  // The in-app Telegram tab is the SAME thread as the real bot — mirror the agent's reply out to
  // the phone (secrets scrubbed) so a request made in-app produces an answer on Telegram too.
  if (channel === "telegram" && reply) {
    try { const { mirrorToTelegram } = await import("@/server/telegram"); await mirrorToTelegram(workspace.id, reply); }
    catch (e) { console.error("[agentRespond] telegram mirror failed:", e); }
  }

  // New work is born from the conversation with the CEO — NOT a loose button. When Ada
  // determines the operator asked to build/fix/change something, she runs the SAME ritual as
  // the first plan: this chat → specs → issues → TODOs → /planner for approval → agents plan
  // each issue + execute. Her short confirmation is already posted; the heavy planning run
  // streams its "Plan ready" message in when done.
  if (planRequested) {
    try {
      const r = await planFromConversation(channel);
      const detail = r.ok
        ? `Got it — registering this as new work. I'm drafting the plan now (specs, issues and TODOs); it'll appear in the CEO Planner for your approval, and I'll post it here when it's ready.`
        : `I couldn't start a plan from this yet (${r.error ?? "no structured plan"}). Add a little more detail on what you want and I'll try again.`;
      await db.insert(message).values({ id: uid(), workspaceId: workspace.id, channel, fromKind: "agent", fromHandle: a.handle, text: detail, createdAt: new Date(), sessionId: await ensureActiveSession(workspace.id, channel) });
      wake(workspace.id);
    } catch (e) { console.error("[agentRespond] new-work planning failed:", e); }
  }

  // Team room → autonomous hand-off chain (DMs stay 1:1).
  if (!channel.startsWith("dm:")) await relayRoomMentions(org.id, workspace, handle, reply, 0);
  revalidatePath("/", "layout");
}

/** Operator promotes a chat message into the Knowledge Base — when something said in the room/DM
 *  becomes reusable knowledge. Captured as a `note` kb_entry (Vannevar's curation pass tidies it). */
export async function sendMessageToKb(messageId: string): Promise<{ ok: boolean }> {
  const { org, workspace } = await requireWorkspace();
  const [m] = await db.select().from(message).where(and(eq(message.workspaceId, workspace.id), eq(message.id, messageId)));
  if (!m || !m.text?.trim()) return { ok: false };
  await ingestKnowledge(org.id, [{
    type: "note", title: m.text.trim().slice(0, 80), summary: m.text.trim().slice(0, 1200),
    agentHandle: m.fromHandle ?? "", sourceKind: "note", sourceRef: messageId,
  }]);
  return { ok: true };
}

/** Pull Knowledge Base context into the composer as draft text. It never sends the message. */
export async function pullKbForComposer(query: string): Promise<{ ok: boolean; text?: string; sources?: string[]; error?: string }> {
  const { org } = await requireWorkspace();
  const q = (query ?? "").trim().slice(0, 500);
  if (!q) return { ok: false, error: "empty" };
  try {
    const a = await kbAnswer(org.id, q);
    const text = (a.text ?? "").trim();
    if (a.mode === "none" || !text) return { ok: false, error: "none" };
    return { ok: true, text: text.slice(0, 1200), sources: (a.sources ?? []).slice(0, 6) };
  } catch (e) {
    console.error("[pullKbForComposer] failed:", e);
    return { ok: false, error: "failed" };
  }
}

/** Resolve a message's task → traceability chip (task key · issue · goal · column). Best-effort. */
export async function taskRef(taskId: string): Promise<{ taskKey: string; issueKey?: string; goalTitle?: string; col?: string } | null> {
  const { workspace } = await requireWorkspace();
  const [tk] = await db.select().from(task).where(and(eq(task.workspaceId, workspace.id), eq(task.id, taskId)));
  if (!tk) return null;
  let issueKey: string | undefined, goalTitle: string | undefined;
  if (tk.issueId) { const [i] = await db.select({ key: issue.key }).from(issue).where(eq(issue.id, tk.issueId)); issueKey = i?.key; }
  if (tk.goalId) { const [g] = await db.select({ title: goal.title }).from(goal).where(eq(goal.id, tk.goalId)); goalTitle = g?.title; }
  return { taskKey: tk.key, issueKey, goalTitle, col: tk.col };
}

/** Wipe a conversation (room, DM, or Telegram) — deletes its messages, the compacted summary, and run
 *  events. Destructive; the UI confirms first (the Welcome Home "Clear conversation" clears the room). */
export async function clearConversation(channel: string): Promise<{ ok: boolean }> {
  const { workspace } = await requireWorkspace();
  if (!channel.startsWith("dm:") && channel !== "telegram" && channel !== "room") return { ok: false };
  if (channel.startsWith("dm:")) {
    // DM → clear only the ACTIVE session's messages + its summary (other sessions are preserved).
    const sid = await ensureActiveSession(workspace.id, channel);
    await db.delete(message).where(and(eq(message.workspaceId, workspace.id), eq(message.channel, channel), eq(message.sessionId, sid!)));
    await db.delete(messageSummary).where(and(eq(messageSummary.workspaceId, workspace.id), eq(messageSummary.channel, channel), eq(messageSummary.sessionId, sid!)));
  } else {
    await db.delete(message).where(and(eq(message.workspaceId, workspace.id), eq(message.channel, channel)));
    await db.delete(messageSummary).where(and(eq(messageSummary.workspaceId, workspace.id), eq(messageSummary.channel, channel)));
  }
  await db.delete(event).where(and(eq(event.workspaceId, workspace.id), eq(event.channel, channel)));
  wake(workspace.id);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function getMessages(channel: string) {
  const { workspace } = await requireWorkspace();
  if (channel.startsWith("dm:")) {
    const sid = await ensureActiveSession(workspace.id, channel);
    return db.select().from(message)
      .where(and(eq(message.workspaceId, workspace.id), eq(message.channel, channel), eq(message.sessionId, sid!)))
      .orderBy(asc(message.createdAt));
  }
  return db.select().from(message)
    .where(and(eq(message.workspaceId, workspace.id), eq(message.channel, channel)))
    .orderBy(asc(message.createdAt));
}

/* ----------------------------------------------------------------- DM sessions */
/** Sessions for a DM channel (newest first; one is active). */
export async function listSessions(channel: string) {
  const { workspace } = await requireWorkspace();
  return sessionsFor(workspace.id, channel);
}
/** Start a new (active) session for a DM — fresh agent context; old sessions stay. */
export async function createSession(channel: string, title?: string): Promise<{ id: string | null }> {
  const { workspace } = await requireWorkspace();
  const id = await newSession(workspace.id, channel, title);
  revalidatePath("/", "layout");
  return { id };
}
/** Switch the active session for a DM. */
export async function switchSession(channel: string, sessionId: string): Promise<{ ok: boolean }> {
  const { workspace } = await requireWorkspace();
  await activateSession(workspace.id, channel, sessionId);
  revalidatePath("/", "layout");
  return { ok: true };
}
/** Rename a DM session. */
export async function renameSession(sessionId: string, title: string): Promise<{ ok: boolean }> {
  const { workspace } = await requireWorkspace();
  await renameSessionRow(workspace.id, sessionId, title);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Delete a DM session + its messages (destructive — the UI confirms via a modal first). */
export async function deleteSession(channel: string, sessionId: string): Promise<{ ok: boolean }> {
  const { workspace } = await requireWorkspace();
  await deleteSessionRow(workspace.id, channel, sessionId);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Last message per `dm:<handle>` channel — powers the people-roster preview line. */
export async function getDmPreviews(): Promise<Record<string, { text: string; mine: boolean }>> {
  const { workspace } = await requireWorkspace();
  const rows = await db.select().from(message)
    .where(and(eq(message.workspaceId, workspace.id), like(message.channel, "dm:%")))
    .orderBy(asc(message.createdAt));
  const out: Record<string, { text: string; mine: boolean }> = {};
  for (const m of rows) out[m.channel.slice(3)] = { text: m.text ?? "", mine: m.fromKind === "operator" }; // asc → last wins
  return out;
}
