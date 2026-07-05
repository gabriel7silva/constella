import "server-only";
import { and, eq } from "drizzle-orm";
import { relative, isAbsolute } from "node:path";
import { db } from "@/db";
import { goalFile } from "@/db/schema";
import { orgRoot } from "@/lib/fs-workspace";

/**
 * Record which workspace files a goal's run CREATED/EDITED (durable provenance for a
 * scope-aware Work archive). Paths are normalized to workspace-relative; anything outside
 * the workspace, or base/config dirs (`.claude/`, `archives/`), is skipped — those belong
 * to the COMPANY, not the work.
 */
export async function recordGoalFiles(wsId: string, orgId: string, goalId: string, targets: { path: string; op: string }[]): Promise<void> {
  const root = orgRoot(orgId);
  for (const t of targets) {
    if (!t.path) continue;
    let rel = (isAbsolute(t.path) ? relative(root, t.path) : t.path).replace(/\\/g, "/");
    if (!rel || rel.startsWith("..")) continue;
    if (rel.startsWith(".claude/") || rel.startsWith("archives/") || rel.startsWith(".git/")) continue;
    try {
      await db.insert(goalFile).values({ workspaceId: wsId, goalId, path: rel, op: t.op })
        .onConflictDoUpdate({ target: [goalFile.goalId, goalFile.path], set: { op: t.op, at: new Date() } });
    } catch { /* best-effort provenance */ }
  }
}

/** Workspace-relative paths a goal produced (for the archive ZIP). */
export async function goalFilePaths(wsId: string, goalId: string): Promise<string[]> {
  const rows = await db.select({ path: goalFile.path }).from(goalFile)
    .where(and(eq(goalFile.workspaceId, wsId), eq(goalFile.goalId, goalId)));
  return rows.map((r) => r.path);
}
