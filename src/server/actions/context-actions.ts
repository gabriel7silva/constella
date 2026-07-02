"use server";

import { and, eq, sum } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { agent, message, costEntry } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";
import { modelWindow, estimateTokens } from "@/data/model-context";
import { buildChannelContext } from "@/server/compaction";
import { ensureActiveSession } from "@/server/sessions";

export type ContextStat = {
  max: number;          // model context window for this channel
  used: number;         // estimated tokens of the current conversation
  reserve: number;      // headroom kept for the live exchange (~15%)
  remaining: number;    // saldo = max - used - reserve (clamped ≥ 0)
  usedPct: number;      // used / max, 0-100  (climbs as the conversation grows)
  reservePct: number;   // reserve / max, 0-100  (so used + reserve + free = 100)
  remainingPct: number; // remaining / max, 0-100  (free; drops as used climbs)
  perAgent: { handle: string; name: string; color: string; tokens: number; pct: number; usd: number }[];
};

/** Live context occupancy for the chat header donut: max/used/reserve/remaining + per-agent share of
 *  THIS conversation's context (estimated from each agent's messages on the channel — so the breakdown is
 *  channel-specific and never lists agents from other chats). Read-only; scoped to the caller's workspace. */
export async function conversationContext(channel: string): Promise<ContextStat> {
  const { workspace } = await requireWorkspace();
  const agents = await db.select().from(agent).where(eq(agent.workspaceId, workspace.id));

  // Window: a DM uses that agent's model; the room uses the tightest (min) window.
  let max = 200_000;
  if (channel.startsWith("dm:")) {
    const a = agents.find((x) => x.handle === channel.slice(3));
    max = modelWindow(a?.model).window;
  } else if (agents.length) {
    max = Math.min(...agents.map((a) => modelWindow(a.model).window));
  }

  const sid = channel.startsWith("dm:") ? await ensureActiveSession(workspace.id, channel) : null;
  const msgConds = [eq(message.workspaceId, workspace.id), eq(message.channel, channel)];
  if (sid) msgConds.push(eq(message.sessionId, sid));
  const msgs = await db.select({ text: message.text, fromKind: message.fromKind, fromHandle: message.fromHandle }).from(message).where(and(...msgConds));
  const used = estimateTokens(msgs.map((m) => m.text).join("\n"));
  const reserve = Math.round(max * 0.15);
  const remaining = Math.max(0, max - used - reserve);

  // Per-agent breakdown = each agent's SHARE OF THIS CONVERSATION's context, estimated from THEIR messages
  // on THIS channel (same estimator as `used`). Channel-specific by construction: an agent from another
  // conversation (e.g. Ada in Grace's design chat) never appears, and the numbers reflect this thread —
  // not lifetime API spend (that lives in the Costs module).
  const byHandle = new Map<string, string[]>();
  for (const m of msgs) {
    if (m.fromKind !== "agent" || !m.fromHandle) continue;
    const arr = byHandle.get(m.fromHandle);
    if (arr) arr.push(m.text); else byHandle.set(m.fromHandle, [m.text]);
  }
  // Real $ spend per agent ON THIS channel (cost rows are now channel-tagged; historical untagged rows
  // have a null channel and are correctly excluded).
  const spend = await db.select({ agentId: costEntry.agentId, usd: sum(costEntry.usd) })
    .from(costEntry).where(and(eq(costEntry.workspaceId, workspace.id), eq(costEntry.channel, channel))).groupBy(costEntry.agentId);
  const usdByHandle = new Map<string, number>();
  for (const s of spend) { const a = agents.find((x) => x.id === s.agentId); if (a) usdByHandle.set(a.handle, Number(s.usd ?? 0)); }

  const tally = [...byHandle.entries()].map(([h, texts]) => {
    const a = agents.find((x) => x.handle === h);
    return { handle: h, name: a?.name ?? h, color: a?.color ?? "#6b7390", tokens: estimateTokens(texts.join("\n")), usd: usdByHandle.get(h) ?? 0 };
  });
  // pct = each agent's share of THIS conversation's context (`used`), so a single-agent chat reads as real
  // occupancy (e.g. ~80%) instead of a misleading 100%-of-agents.
  const perAgent = tally
    .map((x) => ({ ...x, pct: Math.round((x.tokens / Math.max(1, used)) * 100) }))
    .sort((a, b) => b.tokens - a.tokens);

  return {
    max, used, reserve, remaining,
    usedPct: Math.min(100, Math.round((used / max) * 100)),
    reservePct: Math.round((reserve / max) * 100),
    remainingPct: Math.max(0, Math.round((remaining / max) * 100)),
    perAgent,
  };
}

/** Force a hard compaction of a conversation NOW (operator button at <35% remaining, or
 *  auto at 100%). Summarizes the older history into a persisted summary + keeps a short tail. */
export async function compactConversation(channel: string): Promise<{ ok: boolean; summarized: boolean }> {
  const { org, workspace } = await requireWorkspace();
  const sid = channel.startsWith("dm:") ? await ensureActiveSession(workspace.id, channel) : null;
  // null alias → aggressive budget (keep last ~8, ~150-word summary): a real hard compaction.
  const { summary } = await buildChannelContext(org.id, workspace.id, channel, null, true, undefined, sid);
  revalidatePath("/", "layout");
  return { ok: true, summarized: !!summary };
}
