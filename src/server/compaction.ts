import "server-only";
import { randomUUID as uid } from "node:crypto";
import { eq, and, asc, isNull } from "drizzle-orm";
import { db } from "@/db";
import { message, messageSummary, costEntry } from "@/db/schema";
import { runAgent } from "@/server/adapters/cli";
import { readWorkspaceFile, writeWorkspaceFile } from "@/lib/fs-workspace";
import { modelWindow, estimateTokens, type ModelWindow } from "@/data/model-context";

type Msg = typeof message.$inferSelect;

/**
 * Build the chat context for an agent reply, compacting the channel when it
 * outgrows the active model's context window. Compaction is MODEL-AWARE (smaller
 * models get a more aggressive summary) and preserves decisions/tasks/files/
 * instructions. The compacted summary is persisted and linked into .claude/memory.md.
 * Summarization uses a cheap model (haiku) and books its real cost.
 */
export async function buildChannelContext(
  orgId: string,
  workspaceId: string,
  channel: string,
  modelAlias: string | null,
  force = false,
  winOverride?: ModelWindow,
  sessionId?: string | null,
): Promise<{ summary: string; recent: Msg[] }> {
  const { window, keepRecent, aggressive } = winOverride ?? modelWindow(modelAlias);
  // DM sessions: scope the conversation + its summary to the active session so a new session is a
  // fresh context. sessionId is null for the room/Telegram (single-thread).
  const msgConds = [eq(message.workspaceId, workspaceId), eq(message.channel, channel)];
  if (sessionId) msgConds.push(eq(message.sessionId, sessionId));
  const all = await db.select().from(message).where(and(...msgConds)).orderBy(asc(message.createdAt));
  const [existing] = await db.select().from(messageSummary)
    .where(and(eq(messageSummary.workspaceId, workspaceId), eq(messageSummary.channel, channel),
      sessionId ? eq(messageSummary.sessionId, sessionId) : isNull(messageSummary.sessionId)));

  const total = estimateTokens(all.map((m) => m.text).join("\n"));
  // `force` = operator/auto-triggered hard compaction: skip the size threshold (but still
  // no-op if there's barely anything to fold). Otherwise only summarize when the channel
  // outgrows the model budget.
  const tooSmall = all.length <= keepRecent + 1;
  if (tooSmall || (!force && (all.length <= keepRecent + 4 || total < window * 0.4))) {
    return { summary: existing?.summary ?? "", recent: all.slice(-keepRecent) };
  }

  const older = all.slice(0, all.length - keepRecent);
  const recent = all.slice(-keepRecent);
  const lastOlderId = older[older.length - 1]?.id ?? "";
  // Already summarized up to this exact point → reuse.
  if (existing && existing.throughId === lastOlderId) return { summary: existing.summary, recent };

  const convo = older.map((m) => (m.fromKind === "operator" ? "Operator" : "@" + (m.fromHandle ?? "agent")) + ": " + m.text).join("\n");
  const prompt = [
    `Summarize this team chat history into a COMPACT, STRUCTURED context for an AI teammate.`,
    `Output EXACTLY these markdown sections (omit one only if truly empty), with the substance under each:`,
    `## Decisions\n## Requirements\n## Open issues\n## Files\n## Pending by agent\n## Next steps`,
    aggressive ? `Keep it tight — ~150 words total across all sections.` : `Keep important detail — ~350 words total across all sections.`,
    `Drop small talk. PRESERVE agent names + responsibilities, exact decisions, requirements, file paths, and pending work.`,
    existing?.summary ? `\nPrior summary to fold in:\n${existing.summary}` : ``,
    `\nChat history:\n${convo}`,
    `\nOutput ONLY the structured summary.`,
  ].filter(Boolean).join("\n");

  const res = await runAgent(prompt, { orgId, binary: "claude", model: "haiku", timeoutMs: 120_000 });
  if (res.usd > 0 || res.inputTokens + res.outputTokens > 0) {
    await db.insert(costEntry).values({ id: uid(), workspaceId, agentId: null, provider: res.binary, model: res.model ?? "haiku", usd: res.usd, tokens: res.inputTokens + res.outputTokens, at: new Date() });
  }
  const summary = res.ok && res.text.trim() ? res.text.trim() : (existing?.summary ?? "");
  if (!summary) return { summary: "", recent };

  if (existing) await db.delete(messageSummary).where(eq(messageSummary.id, existing.id));
  await db.insert(messageSummary).values({ id: uid(), workspaceId, channel, sessionId: sessionId ?? null, summary, throughId: lastOlderId, msgCount: older.length, createdAt: new Date() });

  // Link the compacted context into .claude/memory.md (one section per channel).
  try {
    const rel = ".claude/memory.md";
    const cur = readWorkspaceFile(orgId, rel) ?? "# Memory\n";
    const block = `\n\n## Compacted: ${channel}\n${summary}\n`;
    const re = new RegExp(`\\n\\n## Compacted: ${channel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n[\\s\\S]*?(?=\\n\\n## |$)`);
    const next = re.test(cur) ? cur.replace(re, block) : cur.replace(/\s*$/, "") + block;
    writeWorkspaceFile(orgId, rel, next);
  } catch { /* memory link is best-effort */ }

  return { summary, recent };
}
