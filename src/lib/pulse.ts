/**
 * Pulse system — agent heartbeat & health.
 *
 * Every agent "pulses" while a runner is active (see server/runner.ts).
 * A pulse records latency + ok flag. Health is derived from the most recent
 * pulse age:
 *   - alive: pulsed within STALE_MS
 *   - stale: pulsed within DOWN_MS but not recently
 *   - down:  no pulse within DOWN_MS (or never)
 *
 * This is the server-side source of truth for the green/amber/grey status
 * dots shown across the UI (sidebar, Org Chart, Agent Studio).
 */
import { db } from "@/db";
import { pulse, agent } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { readWorkspaceFile, writeWorkspaceFile } from "@/lib/fs-workspace";

export const STALE_MS = 90_000; // 90s without a pulse → stale (default fallback)
export const DOWN_MS = 300_000; // 5min without a pulse → down (default fallback)

export type Health = "alive" | "stale" | "down";

export function healthFromAge(lastPulse: Date | null): Health {
  return healthFromAgeWith(lastPulse, STALE_MS, DOWN_MS);
}

function healthFromAgeWith(lastPulse: Date | null, staleMs: number, downMs: number): Health {
  if (!lastPulse) return "down";
  const age = Date.now() - lastPulse.getTime();
  if (age <= staleMs) return "alive";
  if (age <= downMs) return "stale";
  return "down";
}

/** Per-agent pulse config, read from `.claude/agents/<handle>/pulse.md` (disk is truth). */
function readPulseConfig(orgId: string, handle: string): { intervalSec: number; maxMissed: number } {
  const md = readWorkspaceFile(orgId, `.claude/agents/${handle}/pulse.md`) ?? "";
  const intervalSec = parseInt(md.match(/intervalSec:\s*(\d+)/)?.[1] ?? "30", 10) || 30;
  const maxMissed = parseInt(md.match(/maxMissed:\s*(\d+)/)?.[1] ?? "2", 10) || 2;
  return { intervalSec, maxMissed };
}

/** Record a heartbeat for an agent and refresh its derived health. */
export async function recordPulse(
  workspaceId: string,
  agentId: string,
  opts: { ok?: boolean; latencyMs?: number; note?: string } = {},
) {
  const now = new Date();
  const ok = opts.ok ?? true;
  await db.insert(pulse).values({
    id: randomUUID(),
    workspaceId,
    agentId,
    at: now,
    ok,
    latencyMs: opts.latencyMs ?? 0,
    note: opts.note ?? "",
  });
  await db
    .update(agent)
    .set({ lastPulse: now, health: ok ? "alive" : "stale" })
    .where(eq(agent.id, agentId));
  return now;
}

/** Re-derive health for every agent in a workspace from their last pulse. */
export async function refreshHealth(workspaceId: string) {
  const agents = await db.query.agent.findMany({
    where: eq(agent.workspaceId, workspaceId),
  });
  await Promise.all(
    agents.map((a) =>
      db
        .update(agent)
        .set({ health: healthFromAge(a.lastPulse ?? null) })
        .where(eq(agent.id, a.id)),
    ),
  );
}

/**
 * Disk-driven pulse sweep — derives each agent's health from ITS OWN pulse.md
 * thresholds (intervalSec × maxMissed), then writes the live snapshots to
 * Reports/agent-status.md + Reports/system-health.md (the directory is truth).
 * Run on the execute tick (worker cadence), not on every cheap browser pulse.
 */
export async function pulseSweep(workspaceId: string, orgId: string) {
  const agents = await db.query.agent.findMany({ where: eq(agent.workspaceId, workspaceId) });
  const rows: { a: typeof agents[number]; health: Health }[] = [];
  for (const a of agents) {
    const { intervalSec, maxMissed } = readPulseConfig(orgId, a.handle);
    const staleMs = intervalSec * maxMissed * 1000;
    const downMs = staleMs * 3;
    const health = healthFromAgeWith(a.lastPulse ?? null, staleMs, downMs);
    if (health !== a.health) await db.update(agent).set({ health }).where(eq(agent.id, a.id));
    rows.push({ a, health });
  }

  const iso = new Date().toISOString();
  const fmtPulse = (d: Date | null) => (d ? new Date(d).toISOString().replace("T", " ").slice(0, 19) : "—");
  const statusMd = `# Agent status\n\n_Updated by the pulse sweep at ${iso}._\n\n| Agent | Role | Status | Health | Last pulse |\n|---|---|---|---|---|\n` +
    rows.map(({ a, health }) => `| @${a.handle} | ${a.role} | ${a.status} | ${health} | ${fmtPulse(a.lastPulse ?? null)} |`).join("\n") + "\n";
  const c = { alive: rows.filter((r) => r.health === "alive").length, stale: rows.filter((r) => r.health === "stale").length, down: rows.filter((r) => r.health === "down").length };
  // Real check (no fabricated "valid"): the workspace config file must exist on disk.
  const wsConfig = !!readWorkspaceFile(orgId, ".claude/workspace.md");
  const healthMd = `# System health\n\n- Updated: ${iso}\n- Agents: ${rows.length} (alive ${c.alive} · stale ${c.stale} · down ${c.down})\n- Workspace config: ${wsConfig ? "present" : "MISSING"}\n`;
  try {
    writeWorkspaceFile(orgId, "Reports/agent-status.md", statusMd);
    writeWorkspaceFile(orgId, "Reports/system-health.md", healthMd);
  } catch { /* reports are best-effort */ }
}

/** Recent pulses for one agent (for the Agent Studio health sparkline). */
export function recentPulses(agentId: string, limit = 30) {
  return db.query.pulse.findMany({
    where: eq(pulse.agentId, agentId),
    orderBy: [desc(pulse.at)],
    limit,
  });
}
