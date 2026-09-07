import "server-only";
import { randomUUID as uid } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { skill, agentSkill, workspace, agent } from "@/db/schema";
import { writeWorkspaceFile } from "@/lib/fs-workspace";
import { librarySkillByName, readLibrarySkillMd, stripFrontmatter, allLibrarySkillNames, loadLibraryIndex, skillNamesForRole } from "@/server/skills-library";

/**
 * Seed a set of library skills into a workspace: write each as a `.claude/skills/<name>.md` (in the
 * exact shape `indexSkillFile` derives, so the watcher's later re-index is a no-op) and insert the
 * matching `skill` row. A skill is auto-LINKED to every agent only when `linkNames` is omitted or
 * contains it — so the WHOLE library can be seeded (visible in /skills) while only the stack-relevant
 * subset is enabled per agent (the rest are available to toggle on). Synchronous (better-sqlite3).
 * Skips any name already present (the 6 procedural skills win on conflict) or missing from the library.
 */
export function seedLibrarySkills(opts: {
  orgId: string; wsId: string; names: string[]; agentIds: Record<string, string>; linkNames?: string[];
}): { seeded: number } {
  const { orgId, wsId, names, agentIds } = opts;
  const linkSet = opts.linkNames ? new Set(opts.linkNames) : null; // null = link all
  let seeded = 0;
  for (const name of names) {
    const entry = librarySkillByName(name);
    if (!entry) continue;
    const exists = db.select({ id: skill.id }).from(skill)
      .where(and(eq(skill.workspaceId, wsId), eq(skill.name, name))).get();
    if (exists) continue;
    const body = readLibrarySkillMd(name);
    if (!body) continue;

    const procedure = stripFrontmatter(body);
    const trigger = `When working with ${name} in this project.`;
    const md = `# Skill — ${name}\n\n**Trigger:** ${trigger}\n\n${entry.description}\n\n## Procedure\n${procedure}\n`;
    writeWorkspaceFile(orgId, `.claude/skills/${name}.md`, md);

    const sid = uid();
    db.insert(skill).values({
      id: sid, workspaceId: wsId, name, summary: entry.description, trigger,
      instructions: procedure, native: true, provisional: false, indexed: "indexed",
    }).run();
    if (!linkSet || linkSet.has(name)) {
      for (const h of Object.keys(agentIds)) {
        db.insert(agentSkill).values({ agentId: agentIds[h], skillId: sid }).run();
      }
    }
    seeded++;
  }
  return { seeded };
}

/**
 * Re-link each agent's AUTO skills to its stack+role profile (see role-skill-profile.ts): prune the
 * managed library links that fall outside the agent's role for the current stack, add the ones it's
 * missing. Only `auto` links to LIBRARY skills are touched — operator hand-toggles (auto:false) and the
 * non-library procedural skills (open-pr, run-suite, …) are left alone. Idempotent; no LLM.
 * Run at boot and whenever the workspace stack changes.
 */
export function reconcileStackRoleSkills(wsId: string): { agents: number; linked: number; unlinked: number } {
  const ws = db.select({ stack: workspace.stack }).from(workspace).where(eq(workspace.id, wsId)).get();
  if (!ws) return { agents: 0, linked: 0, unlinked: 0 };
  const stack = (ws.stack ?? {}) as Record<string, string>;
  const libNames = new Set(loadLibraryIndex().keys()); // only library skills are auto-managed
  const wsSkills = db.select({ id: skill.id, name: skill.name }).from(skill).where(eq(skill.workspaceId, wsId)).all();
  const idByName = new Map(wsSkills.map((s) => [s.name, s.id] as const));
  const nameById = new Map(wsSkills.map((s) => [s.id, s.name] as const));
  const agents = db.select({ id: agent.id, role: agent.role }).from(agent).where(eq(agent.workspaceId, wsId)).all();
  let linked = 0, unlinked = 0;
  for (const a of agents) {
    const desired = new Set(skillNamesForRole(stack, a.role).filter((n) => idByName.has(n)));
    const links = db.select({ skillId: agentSkill.skillId, auto: agentSkill.auto }).from(agentSkill).where(eq(agentSkill.agentId, a.id)).all();
    const present = new Set(links.map((l) => l.skillId));
    // prune AUTO links to LIBRARY skills outside this role's profile (leave manual + procedural intact)
    for (const l of links) {
      const nm = nameById.get(l.skillId);
      if (l.auto && nm && libNames.has(nm) && !desired.has(nm)) {
        db.delete(agentSkill).where(and(eq(agentSkill.agentId, a.id), eq(agentSkill.skillId, l.skillId))).run();
        unlinked++;
      }
    }
    // add the role's skills not yet linked
    for (const nm of desired) {
      const sid = idByName.get(nm);
      if (sid && !present.has(sid)) { db.insert(agentSkill).values({ agentId: a.id, skillId: sid, auto: true }).onConflictDoNothing().run(); linked++; }
    }
  }
  return { agents: agents.length, linked, unlinked };
}

/**
 * BACKFILL: seed the ENTIRE native skills library (all 180+) into every existing workspace (visible in
 * the Skills module), then RE-LINK each agent to its stack+role profile via reconcileStackRoleSkills —
 * which also prunes the legacy "all linked to everyone" state. Idempotent; runs once per boot from
 * reconcileOnBoot. No LLM.
 */
export function seedLibrarySkillsForExistingWorkspaces(): { workspaces: number; seeded: number } {
  const wss = db.select({ id: workspace.id, orgId: workspace.orgId, stack: workspace.stack }).from(workspace).all();
  const allNames = allLibrarySkillNames();
  let seededTotal = 0;
  for (const ws of wss) {
    const agents = db.select({ id: agent.id, handle: agent.handle }).from(agent).where(eq(agent.workspaceId, ws.id)).all();
    if (!agents.length) continue;
    const agentIds = Object.fromEntries(agents.map((a) => [a.handle, a.id]));
    try {
      // seed all (linkNames:[] → link none here); reconcileStackRoleSkills does the role linking + pruning.
      seededTotal += seedLibrarySkills({ orgId: ws.orgId, wsId: ws.id, names: allNames, agentIds, linkNames: [] }).seeded;
      reconcileStackRoleSkills(ws.id);
    } catch (e) { console.error("[skill-backfill] workspace", ws.id, "failed:", e); }
  }
  return { workspaces: wss.length, seeded: seededTotal };
}
