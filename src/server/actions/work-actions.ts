"use server";

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname, normalize, sep } from "node:path";
import AdmZip from "adm-zip";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { goal, task, issue, spec, decision, report, taskStep, agent, message, costEntry, organization } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";
import { orgRoot } from "@/lib/fs-workspace";
import { notifyOps } from "@/lib/notify";
// Goal lifecycle cores live in the session-less work-ops.ts (shared with the Telegram remote control).
import { ownGoal, slug, unparkGoalTasks, setGoalChildrenStatus, cancelGoalFor, archiveGoalFor } from "@/server/work-ops";

/** Cancel a Goal: stop ALL its work immediately (kill in-flight runs + park tasks), but
 *  PRESERVE everything (DB rows, files) so it can be reopened. */
export async function cancelGoal(goalId: string): Promise<void> {
  const { workspace } = await requireWorkspace();
  await cancelGoalFor(workspace.id, goalId);
  revalidatePath("/goals"); revalidatePath("/", "layout");
}

/** Reopen a cancelled goal — resume execution (unpark its tasks). */
export async function reopenGoal(goalId: string): Promise<void> {
  const { workspace } = await requireWorkspace();
  const g = await ownGoal(workspace.id, goalId);
  if (!g) return;
  await db.update(goal).set({ status: "active", reopenedAt: new Date(), cancelledAt: null }).where(eq(goal.id, goalId));
  await setGoalChildrenStatus(workspace.id, goalId, "active"); // specs + issues back to active
  await unparkGoalTasks(workspace.id, goalId);
  revalidatePath("/goals"); revalidatePath("/", "layout");
}

/** Archive a WORK (goal): ZIP ONLY what this goal produced — its source files (provenance) +
 *  a manifest of its specs/issues/tasks/todos/decisions/reports. Does NOT touch `.claude`,
 *  skills, identity or other goals. Parks execution; restorable. */
export async function archiveGoal(goalId: string): Promise<{ ok: boolean; path?: string }> {
  const { org, workspace } = await requireWorkspace();
  const r = await archiveGoalFor(org.id, workspace.id, goalId);
  revalidatePath("/goals"); revalidatePath("/", "layout");
  return { ok: r.ok, path: r.path };
}

/** Restore an archived/cancelled goal: re-extract its source files from the ZIP (if any) and
 *  set it active again. DB rows were kept, so this brings the work back. */
export async function restoreGoal(goalId: string): Promise<void> {
  const { org, workspace } = await requireWorkspace();
  const g = await ownGoal(workspace.id, goalId);
  if (!g) return;
  const root = orgRoot(org.id);
  if (g.archivePath) {
    const zipPath = join(root, g.archivePath);
    if (existsSync(zipPath)) {
      try {
        const zip = new AdmZip(zipPath);
        for (const e of zip.getEntries()) {
          if (!e.isDirectory && e.entryName.startsWith("files/")) {
            const rel = e.entryName.slice("files/".length);
            const abs = normalize(join(root, rel));
            if (abs !== root && !abs.startsWith(root + sep)) continue; // never write outside the workspace
            mkdirSync(dirname(abs), { recursive: true });
            writeFileSync(abs, e.getData());
          }
        }
      } catch (e) { console.error("[restoreGoal] unzip failed:", e); }
    }
  }
  await db.update(goal).set({ status: "active", reopenedAt: new Date(), archivedAt: null }).where(eq(goal.id, goalId));
  await setGoalChildrenStatus(workspace.id, goalId, "active"); // specs + issues back to active
  await unparkGoalTasks(workspace.id, goalId);
  revalidatePath("/goals"); revalidatePath("/", "layout");
}

/** Archive the whole COMPANY/org: ZIP the ENTIRE workspace (identity, .claude, skills, docs,
 *  code) + a DB export of the org's records, then mark the organization archived. Everything. */
export async function archiveCompany(): Promise<{ ok: boolean; path?: string }> {
  const { org, workspace } = await requireWorkspace();
  const root = orgRoot(org.id);
  const zip = new AdmZip();
  // Whole workspace tree (skip the archives folder itself to avoid recursion + git/node_modules).
  try {
    // adm-zip passes the filter the path PREFIXED with the zip root ("workspace/…"), so anchor
    // the exclusions on a segment boundary (not startsWith) — otherwise archives/ would recurse
    // the whole archives dir into every company ZIP (doubling size each run).
    zip.addLocalFolder(root, "workspace", (name) => {
      const n = name.replace(/\\/g, "/");
      return !/(^|\/)(archives|node_modules|\.git)\//.test(n);
    });
  } catch (e) { console.error("[archiveCompany] folder zip failed:", e); }
  // DB export — the org's records (history that isn't on disk).
  const [goals, specs, issues, tasks, steps, decisions, reports, agents, messages, costs] = await Promise.all([
    db.select().from(goal).where(eq(goal.workspaceId, workspace.id)),
    db.select().from(spec).where(eq(spec.workspaceId, workspace.id)),
    db.select().from(issue).where(eq(issue.workspaceId, workspace.id)),
    db.select().from(task).where(eq(task.workspaceId, workspace.id)),
    db.select().from(taskStep).where(eq(taskStep.workspaceId, workspace.id)),
    db.select().from(decision).where(eq(decision.workspaceId, workspace.id)),
    db.select().from(report).where(eq(report.workspaceId, workspace.id)),
    db.select().from(agent).where(eq(agent.workspaceId, workspace.id)),
    db.select().from(message).where(eq(message.workspaceId, workspace.id)),
    db.select().from(costEntry).where(eq(costEntry.workspaceId, workspace.id)),
  ]);
  const dbExport = { org, workspace, goals, specs, issues, tasks, taskSteps: steps, decisions, reports, agents, messages, costs, archivedAt: new Date().toISOString() };
  zip.addFile("DB-EXPORT.json", Buffer.from(JSON.stringify(dbExport, null, 2)));

  const archivesDir = join(root, "archives");
  mkdirSync(archivesDir, { recursive: true });
  const rel = `archives/COMPANY-${slug(workspace.name)}-${new Date().toISOString().slice(0, 10)}.zip`;
  try { zip.writeZip(join(root, rel)); } catch (e) { console.error("[archiveCompany] zip failed:", e); return { ok: false }; }

  await db.update(organization).set({ archived: true }).where(eq(organization.id, org.id));
  await notifyOps(workspace.id, { kind: "info", text: `Company archived — ${workspace.name}`, detail: `Full workspace + DB export zipped to ${rel}.` });
  revalidatePath("/organizations"); revalidatePath("/goals");
  return { ok: true, path: rel };
}
