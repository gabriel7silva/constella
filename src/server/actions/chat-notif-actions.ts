"use server";

import { and, eq, gt, desc, count, inArray } from "drizzle-orm";
import { db } from "@/db";
import { notification, channelRead, message, agent } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";

export type ChatNotif = {
  id: string; kind: string; text: string; detail: string;
  messageId: string | null; channel: string; createdAt: Date;
  agentName: string | null; agentColor: string | null;
};

/** Unread mention/approval notifications for the dock bell (newest first), with the
 *  source agent + the message+channel to jump to. */
export async function getChatNotifications(): Promise<ChatNotif[]> {
  const { workspace } = await requireWorkspace();
  const rows = await db.select({
    id: notification.id, kind: notification.kind, text: notification.text, detail: notification.detail,
    messageId: notification.messageId, channel: notification.channel, createdAt: notification.createdAt,
    agentName: agent.name, agentColor: agent.color,
  }).from(notification).leftJoin(agent, eq(notification.agentId, agent.id))
    .where(and(eq(notification.workspaceId, workspace.id), eq(notification.read, false), inArray(notification.kind, ["mention", "approval"])))
    .orderBy(desc(notification.createdAt)).limit(20);
  return rows as ChatNotif[];
}

/** Mark one notification read (e.g. after the operator jumps to it). */
export async function markNotifRead(id: string): Promise<void> {
  const { workspace } = await requireWorkspace();
  await db.update(notification).set({ read: true }).where(and(eq(notification.id, id), eq(notification.workspaceId, workspace.id)));
}

/** Move the per-channel read cursor to now (called when a channel is viewed / scrolled to bottom). */
export async function markChannelRead(channel: string): Promise<void> {
  const { workspace } = await requireWorkspace();
  await db.insert(channelRead).values({ workspaceId: workspace.id, channel, lastReadAt: new Date() })
    .onConflictDoUpdate({ target: [channelRead.workspaceId, channelRead.channel], set: { lastReadAt: new Date() } });
}

/** Unread agent-message count per channel (createdAt past the channel's read cursor) for live badges. */
export async function getUnreadCounts(): Promise<Record<string, number>> {
  const { workspace } = await requireWorkspace();
  const reads = await db.select().from(channelRead).where(eq(channelRead.workspaceId, workspace.id));
  const readMap = Object.fromEntries(reads.map((r) => [r.channel, r.lastReadAt as Date]));
  const chans = await db.selectDistinct({ channel: message.channel }).from(message)
    .where(and(eq(message.workspaceId, workspace.id), eq(message.fromKind, "agent")));
  const out: Record<string, number> = {};
  for (const { channel } of chans) {
    const since = readMap[channel] ?? new Date(0);
    const [c] = await db.select({ n: count() }).from(message)
      .where(and(eq(message.workspaceId, workspace.id), eq(message.channel, channel), eq(message.fromKind, "agent"), gt(message.createdAt, since)));
    if (Number(c?.n ?? 0) > 0) out[channel] = Number(c.n);
  }
  return out;
}
