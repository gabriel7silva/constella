import "server-only";
import { notifyOps } from "@/lib/notify";
import { detectOperatorSignals } from "@/lib/operator-signals";
import { pushInbox } from "@/server/inbox";

/**
 * After an agent posts a message, raise a persistent operator notification if the message
 * addresses the human (@operator / approval phrasing) — linked to the exact message+channel so
 * the dock can jump to it. EVERY such ask also files an Inbox item (the central decision hub):
 * an explicit approval ask as kind "approval", a plain @operator question as kind "question".
 * Best-effort; never blocks the post.
 */
export async function pingOperatorIfAddressed(
  workspaceId: string,
  o: { text: string; agentId?: string | null; agentHandle: string; messageId: string; channel: string },
): Promise<void> {
  const { mention, approvalRequest } = detectOperatorSignals(o.text);
  if (!mention) return;
  try {
    await notifyOps(workspaceId, {
      kind: approvalRequest ? "approval" : "mention",
      text: approvalRequest ? `@${o.agentHandle} needs your approval` : `@${o.agentHandle} mentioned you`,
      detail: o.text.slice(0, 300),
      agentId: o.agentId, messageId: o.messageId, channel: o.channel,
    });
    await pushInbox(workspaceId, {
      kind: approvalRequest ? "approval" : "question",
      refType: "question", refId: o.messageId, fromAgentId: o.agentId ?? null,
      channel: o.channel, messageId: o.messageId,
      title: approvalRequest ? `@${o.agentHandle} needs your approval` : `@${o.agentHandle} asked you`,
      detail: o.text.slice(0, 500),
    });
  } catch (e) {
    console.error("[operator-ping] failed:", e);
  }
}
