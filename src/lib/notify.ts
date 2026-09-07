import "server-only";
import { randomUUID as uid } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { notification, workspace, organization, notificationPref } from "@/db/schema";
import { getTelegramConfig, sendTelegramButtons, type TgButton } from "@/lib/telegram";

// Notification kinds worth pushing to Telegram as real-time alerts / escalations — gated by the
// operator's Telegram preference. Routine "info" stays in-app only so the bot thread isn't spammed
// (the conversational CEO chat stays the primary surface; these are clearly-marked 🔔 alerts).
// A caller can force a push for any kind with `tg: true` (progress milestones) or suppress one with
// `tg: false` (e.g. plan-ready, which sends its own buttoned message).
const TG_KINDS = new Set([
  "escalation", "approval", "needs-approval", "block", "blocked", "security", "deploy", "error",
  "alert", "review", "report", "warn", "warning",
  "design-approval", "design-pending", "design-review",
]);

/** P4 remote control — the action buttons attached to a pushed alert. They reuse the same callbacks
 *  the Telegram handler already understands (approve_plan/start_exec/reject_plan/review/status). */
function buttonsForKind(kind: string): TgButton[][] {
  if (kind === "approval" || kind === "needs-approval") {
    return [
      [{ text: "✅ Approve", data: "approve_plan" }, { text: "▶️ Start execution", data: "start_exec" }],
      [{ text: "📝 Review", data: "review" }, { text: "↩️ Reject", data: "reject_plan" }],
    ];
  }
  // Design ready to ship — approve auto-runs the Design→Ada handoff (Send to execution); reject asks Grace what to change.
  if (kind === "design-approval") {
    return [
      [{ text: "✅ Approve & send to execution", data: "approve_design" }],
      [{ text: "📝 Review", data: "review_design" }, { text: "↩️ Request changes", data: "reject_design" }],
    ];
  }
  if (kind === "design-pending" || kind === "design-review") {
    return [[{ text: "📝 Review design", data: "review_design" }, { text: "📊 Status", data: "status" }]];
  }
  // Every other pushed alert gets quick inspect controls so the operator can act from the phone.
  return [[{ text: "📝 Review", data: "review" }, { text: "📊 Status", data: "status" }]];
}

/** Deliver an important notification to Telegram when the operator opted in + the bot is connected,
 *  with inline action buttons. Pushes for `TG_KINDS` (or any kind when `tg === true`); suppressed
 *  when `tg === false`. */
async function deliverTelegram(workspaceId: string, n: { kind?: string; text: string; detail?: string; tg?: boolean }): Promise<void> {
  try {
    const kind = n.kind ?? "info";
    const push = n.tg === true || (n.tg !== false && TG_KINDS.has(kind));
    if (!push) return;
    const [ws] = await db.select({ orgId: workspace.orgId }).from(workspace).where(eq(workspace.id, workspaceId));
    if (!ws) return;
    const [org] = await db.select({ ownerId: organization.ownerId }).from(organization).where(eq(organization.id, ws.orgId));
    if (!org) return;
    const [pref] = await db.select().from(notificationPref).where(eq(notificationPref.userId, org.ownerId));
    if (pref && pref.telegram === false) return; // no row = default ON
    const cfg = await getTelegramConfig(workspaceId);
    if (!cfg) return;
    const label = kind.replace(/[-_]/g, " ").toUpperCase();
    const body = `🔔 ${label}\n${n.text}${n.detail ? `\n${n.detail}` : ""}`.slice(0, 3400);
    await sendTelegramButtons(cfg.botToken, cfg.chatId, body, buttonsForKind(kind));
  } catch { /* best-effort: never let a notification failure break the caller */ }
}

/**
 * File an in-app notification (bell feed + toast). For important kinds it ALSO delivers a Telegram
 * alert (with action buttons) when the operator enabled the Telegram notification preference —
 * gated, clearly marked, no routine spam. Pass `tg: true` to force a push (progress milestones) or
 * `tg: false` to suppress one even for an alert kind.
 */
export async function notifyOps(
  workspaceId: string,
  n: { kind?: string; text: string; detail?: string; agentId?: string | null; messageId?: string; channel?: string; tg?: boolean },
): Promise<void> {
  await db.insert(notification).values({
    id: uid(), workspaceId, kind: n.kind ?? "info", text: n.text, detail: n.detail ?? "", agentId: n.agentId ?? null,
    messageId: n.messageId ?? null, channel: n.channel ?? "",
  });
  await deliverTelegram(workspaceId, n);
}
