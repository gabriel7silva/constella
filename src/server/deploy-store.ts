import "server-only";
import { randomUUID as uid } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, sqlite } from "@/db";
import { deployRun } from "@/db/schema";

/**
 * Persistence for the Prepare-Deploy center: ONE `deploy_run` row per workspace holds the latest
 * production-prep pipeline run — its visual steps, the auto checklist, the last build log + export
 * snapshot. Mirrors `ensureKbTables` (idempotent, migration-free DDL at boot) so existing DBs gain
 * the table without a `drizzle-kit push`.
 */

export type StepStatus = "waiting" | "running" | "done" | "error" | "blocked" | "needs-action";
export type PipelineStep = { key: string; label: string; status: StepStatus; detail?: string; startedAt?: number; endedAt?: number };

export type ChecklistStatus = "ok" | "warn" | "fail" | "todo";
export type ChecklistItem = { key: string; label: string; status: ChecklistStatus; detail?: string };

export type ExportSnapshot = { ok: boolean; sha?: string; copied?: number; repo?: string; branch?: string; at: number };

export type RunStatus = "idle" | "running" | "done" | "failed" | "blocked";
export type DeployRunRow = {
  status: RunStatus;
  runId: string;
  steps: PipelineStep[];
  summary: string;
  buildLog: string;
  checklist: ChecklistItem[];
  lastExport: ExportSnapshot | null;
  startedAt: number | null;   // epoch ms
  updatedAt: number;          // epoch ms
};

export type DeployPatch = {
  status?: RunStatus;
  runId?: string;
  steps?: PipelineStep[];
  summary?: string;
  buildLog?: string;
  checklist?: ChecklistItem[];
  lastExport?: ExportSnapshot | null;
  startedAt?: number | null;  // epoch ms
};

let tablesEnsured = false;
/** Create the deploy_run table if missing. Idempotent; safe every boot. */
export function ensureDeployTables(): void {
  if (tablesEnsured) return;
  tablesEnsured = true;
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS deploy_run (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'idle',
      run_id TEXT NOT NULL DEFAULT '',
      steps TEXT NOT NULL DEFAULT '[]',
      summary TEXT NOT NULL DEFAULT '',
      build_log TEXT NOT NULL DEFAULT '',
      checklist TEXT NOT NULL DEFAULT '[]',
      last_export TEXT,
      started_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE UNIQUE INDEX IF NOT EXISTS deploy_run_ws_uq ON deploy_run (workspace_id);
  `);
}

function parseJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try { return JSON.parse(s) as T; } catch { return fallback; }
}

const IDLE_ROW: DeployRunRow = { status: "idle", runId: "", steps: [], summary: "", buildLog: "", checklist: [], lastExport: null, startedAt: null, updatedAt: 0 };

/** The latest run for a workspace, or an idle default if none exists. */
export async function loadDeployRow(wsId: string): Promise<DeployRunRow> {
  ensureDeployTables();
  const [r] = await db.select().from(deployRun).where(eq(deployRun.workspaceId, wsId));
  if (!r) return { ...IDLE_ROW };
  return {
    status: (r.status as RunStatus) || "idle",
    runId: r.runId,
    steps: parseJson<PipelineStep[]>(r.steps, []),
    summary: r.summary,
    buildLog: r.buildLog,
    checklist: parseJson<ChecklistItem[]>(r.checklist, []),
    lastExport: r.lastExport ? parseJson<ExportSnapshot | null>(r.lastExport, null) : null,
    startedAt: r.startedAt ? r.startedAt.getTime() : null,
    updatedAt: r.updatedAt ? r.updatedAt.getTime() : 0,
  };
}

/** Insert-or-update the single deploy_run row for a workspace (keyed by workspaceId). */
export async function upsertDeployRow(wsId: string, patch: DeployPatch): Promise<void> {
  ensureDeployTables();
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.status !== undefined) set.status = patch.status;
  if (patch.runId !== undefined) set.runId = patch.runId;
  if (patch.steps !== undefined) set.steps = JSON.stringify(patch.steps);
  if (patch.summary !== undefined) set.summary = patch.summary;
  if (patch.buildLog !== undefined) set.buildLog = patch.buildLog;
  if (patch.checklist !== undefined) set.checklist = JSON.stringify(patch.checklist);
  if (patch.lastExport !== undefined) set.lastExport = patch.lastExport === null ? null : JSON.stringify(patch.lastExport);
  if (patch.startedAt !== undefined) set.startedAt = patch.startedAt === null ? null : new Date(patch.startedAt);

  const [existing] = await db.select({ id: deployRun.id }).from(deployRun).where(eq(deployRun.workspaceId, wsId));
  if (existing) {
    await db.update(deployRun).set(set).where(eq(deployRun.workspaceId, wsId));
  } else {
    await db.insert(deployRun).values({ id: uid(), workspaceId: wsId, ...set });
  }
}

/** Patch one step in place (status/detail/timestamps) without touching the others. */
export async function patchStep(wsId: string, key: string, patch: Partial<PipelineStep>): Promise<void> {
  const row = await loadDeployRow(wsId);
  const steps = row.steps.map((s) => (s.key === key ? { ...s, ...patch } : s));
  await upsertDeployRow(wsId, { steps });
}

/**
 * Boot reconcile: a `running` row is an orphan (its process died), so mark it `failed` and flip any
 * still-`running` step to `error`. Sync raw SQL — safe to call before anything reads the table.
 */
export function reconcileDeployRuns(): void {
  ensureDeployTables();
  const rows = sqlite.prepare("SELECT workspace_id, steps FROM deploy_run WHERE status = 'running'").all() as { workspace_id: string; steps: string }[];
  for (const r of rows) {
    const steps = parseJson<PipelineStep[]>(r.steps, []).map((s) => (s.status === "running" ? { ...s, status: "error" as StepStatus, detail: s.detail || "interrupted by restart" } : s));
    sqlite.prepare("UPDATE deploy_run SET status = 'failed', steps = ?, updated_at = unixepoch() WHERE workspace_id = ?").run(JSON.stringify(steps), r.workspace_id);
  }
}
