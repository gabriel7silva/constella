import "server-only";
import { randomUUID as uid } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { inboxItem } from "@/db/schema";

export type InboxKind = "approval" | "budget" | "question" | "review" | "block" | "validation";
export type InboxRefType = "plan" | "spec" | "issue" | "task" | "validation" | "question" | "goal";

type PushArgs = {
  kind: InboxKind;
  title: string;
  detail?: string;
  refType?: InboxRefType;
  refId?: string;
  goalId?: string | null;
  fromAgentId?: string | null;
  channel?: string;
  messageId?: string;
};

/**
 * File an actionable item into the operator's Inbox — the single place every human decision
 * surfaces (plan/spec/issue approval, blocks, validations, agent asks). Deduped: while an
 * unresolved item already exists for the same (refType, refId), we don't pile on duplicates.
 * Best-effort; never throws to the caller (a chat/runner post must not fail on an inbox write).
 */
export async function pushInbox(workspaceId: string, a: PushArgs): Promise<void> {
  try {
    if (a.refType && a.refId) {
      const [dup] = await db.select({ id: inboxItem.id }).from(inboxItem)
        .where(and(eq(inboxItem.workspaceId, workspaceId), eq(inboxItem.refType, a.refType), eq(inboxItem.refId, a.refId), eq(inboxItem.resolved, false)));
      if (dup) {
        // Already pending → refresh it in place (latest title/detail/goal) instead of piling on
        // a duplicate or leaving a stale draft's text (e.g. a re-drafted plan with new counts).
        await db.update(inboxItem).set({
          title: a.title, detail: a.detail ?? "", goalId: a.goalId ?? null,
          channel: a.channel ?? null, messageId: a.messageId ?? null, createdAt: new Date(),
        }).where(eq(inboxItem.id, dup.id));
        return;
      }
    }
    await db.insert(inboxItem).values({
      id: uid(), workspaceId, kind: a.kind, title: a.title, detail: a.detail ?? "",
      fromAgentId: a.fromAgentId ?? null, resolved: false,
      refType: a.refType ?? null, refId: a.refId ?? null, goalId: a.goalId ?? null,
      channel: a.channel ?? null, messageId: a.messageId ?? null,
    });
  } catch (e) {
    console.error("[inbox] pushInbox failed:", e);
  }
}

/** Mark every unresolved inbox item for a decision as handled — call this when the underlying
 *  action is taken elsewhere (e.g. the operator approves the plan in /planner), so the Inbox
 *  never shows a stale pending item. */
export async function resolveInboxFor(workspaceId: string, refType: InboxRefType, refId: string): Promise<void> {
  try {
    await db.update(inboxItem).set({ resolved: true })
      .where(and(eq(inboxItem.workspaceId, workspaceId), eq(inboxItem.refType, refType), eq(inboxItem.refId, refId), eq(inboxItem.resolved, false)));
  } catch (e) {
    console.error("[inbox] resolveInboxFor failed:", e);
  }
}

/** Resolve every pending item of the given ref types for a workspace — used when a single action
 *  supersedes many (e.g. approving the whole plan clears all per-spec/issue review items). */
export async function resolveInboxRefTypes(workspaceId: string, refTypes: InboxRefType[]): Promise<void> {
  try {
    await db.update(inboxItem).set({ resolved: true })
      .where(and(eq(inboxItem.workspaceId, workspaceId), inArray(inboxItem.refType, refTypes), eq(inboxItem.resolved, false)));
  } catch (e) {
    console.error("[inbox] resolveInboxRefTypes failed:", e);
  }
}

/** Clear every pending inbox item tied to a goal — used when the goal is cancelled/archived so
 *  nothing related keeps demanding the operator's action. */
export async function resolveInboxForGoal(workspaceId: string, goalId: string): Promise<void> {
  try {
    await db.update(inboxItem).set({ resolved: true })
      .where(and(eq(inboxItem.workspaceId, workspaceId), eq(inboxItem.goalId, goalId), eq(inboxItem.resolved, false)));
  } catch (e) {
    console.error("[inbox] resolveInboxForGoal failed:", e);
  }
}
