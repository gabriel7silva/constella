"use server";

import { eq, and, gt, desc } from "drizzle-orm";
import { db } from "@/db";
import { notification } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";

export type ToastNotif = { id: string; kind: string; text: string; detail: string; channel: string; at: number };

/** Notifications newer than `sinceMs` (epoch ms) for the active workspace — drives in-app toasts. */
export async function recentNotifications(sinceMs: number): Promise<ToastNotif[]> {
  const { workspace } = await requireWorkspace();
  const since = new Date(Number.isFinite(sinceMs) ? Math.max(0, Math.floor(sinceMs)) : 0); // guard a NaN/garbled poll value → not an Invalid Date
  const rows = await db.select().from(notification)
    .where(and(eq(notification.workspaceId, workspace.id), gt(notification.createdAt, since)))
    .orderBy(desc(notification.createdAt)).limit(8);
  return rows.map((n) => ({ id: n.id, kind: n.kind, text: n.text, detail: n.detail, channel: n.channel, at: n.createdAt.getTime() }));
}
