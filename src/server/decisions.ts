import "server-only";
import { randomUUID as uid } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { decision, workspace } from "@/db/schema";
import { ingestKnowledge } from "@/server/kb";

/** Append a structured decision to the durable log the Context Manager surfaces to agents.
 *  Best-effort (never blocks the action). `source`: plan-approve | issue-block | spec-reject
 *  | task-done | operator-instruction. */
export async function logDecision(
  workspaceId: string,
  d: { text: string; by?: string; source?: string; refKey?: string; rationale?: string; goalId?: string },
): Promise<void> {
  if (!d.text.trim()) return;
  try {
    await db.insert(decision).values({
      id: uid(), workspaceId, text: d.text.slice(0, 1000), by: d.by ?? "", source: d.source ?? "",
      refKey: d.refKey ?? "", rationale: d.rationale ?? "", goalId: d.goalId ?? null, createdAt: new Date(),
    });
  } catch (e) {
    console.error("[decision] log failed:", e);
  }
  // Mirror the decision into the KB so agents recall it via state-aware retrieval too (best-effort,
  // off the hot path). A non-empty refKey dedups in place; otherwise hash-dedup avoids exact repeats.
  void (async () => {
    try {
      const [ws] = await db.select({ orgId: workspace.orgId }).from(workspace).where(eq(workspace.id, workspaceId));
      if (ws?.orgId) await ingestKnowledge(ws.orgId, [{
        type: "decision", title: d.text.slice(0, 120), summary: d.text.slice(0, 1000), body: d.rationale ?? "",
        goalId: d.goalId ?? null, agentHandle: d.by ?? "", sourceKind: "decision", sourceRef: d.refKey ?? "",
      }]);
    } catch { /* best-effort KB mirror */ }
  })();
}
