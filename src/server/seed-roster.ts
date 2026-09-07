import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { agent, agentSkill, skill, workspace } from "@/db/schema";
import { AGENT_DEFS, type ScaffoldCtx } from "@/data/scaffold";
import { createAgentRow } from "@/server/agent-create";

/**
 * BACKFILL: ensure every AGENT_DEFS member exists in every workspace — insert the DB row, write the
 * persona files (.claude/agents/<handle>/…), and enable the non-provisional skills for it. Idempotent
 * (skips handles already present); runs once per boot from reconcileOnBoot. Adds agents introduced
 * after an org was onboarded (e.g. the Knowledge agent, Vannevar) without a re-onboard. Synchronous
 * (better-sqlite3); best-effort per agent.
 */
export function seedRosterForExistingWorkspaces(): { added: number } {
  const wss = db.select().from(workspace).all();
  let added = 0;
  for (const ws of wss) {
    const have = new Set(db.select({ handle: agent.handle }).from(agent).where(eq(agent.workspaceId, ws.id)).all().map((a) => a.handle));
    const enableSkillIds = db.select({ id: skill.id, provisional: skill.provisional }).from(skill).where(eq(skill.workspaceId, ws.id)).all()
      .filter((s) => !s.provisional).map((s) => s.id);
    const ctx: ScaffoldCtx = {
      orgId: ws.orgId, slug: ws.slug, company: ws.name, mission: ws.mission, objective: ws.objective,
      stack: (ws.stack ?? {}) as Record<string, string>,
    };
    for (const def of AGENT_DEFS) {
      if (have.has(def.handle)) continue;
      try {
        // Single source — writes adapter/model explicitly + renders the persona files (the backfilled
        // agent has none on disk yet).
        const id = createAgentRow(ws.orgId, ws.id, def, ctx, { origin: "roster" });
        for (const sid of enableSkillIds) db.insert(agentSkill).values({ agentId: id, skillId: sid }).run();
        added++;
      } catch (e) { console.error("[roster-backfill]", ws.id, def.handle, "failed:", e); }
    }
  }
  return { added };
}
