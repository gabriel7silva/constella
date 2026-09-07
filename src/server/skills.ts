"use server";

import { randomUUID as uid } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { skill, agentSkill, agent } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";
import { writeDoc, removeDoc } from "@/lib/workspace-doc";
import { proposeSkillsFromLearnings } from "@/server/kb";

/* The directory is the source of truth: every skill is a `.claude/skills/<name>.md`
   file, and each agent's enablement is its `.claude/agents/<handle>/skills.md`. UI
   mutations write those files (write-through) and the index mirrors them into the DB. */

function skillMd(name: string, summary: string, trigger: string, instructions: string): string {
  return `# Skill — ${name}\n\n**Trigger:** ${trigger}\n\n${summary}\n\n## Procedure\n${instructions || "_(describe the procedure)_"}\n`;
}

/** True iff this agent row belongs to the given workspace (ownership gate for IDOR). */
async function agentInWorkspace(agentId: string, workspaceId: string): Promise<boolean> {
  const [a] = await db.select({ id: agent.id }).from(agent)
    .where(and(eq(agent.id, agentId), eq(agent.workspaceId, workspaceId)));
  return !!a;
}

/** True iff this skill row belongs to the given workspace. */
async function skillInWorkspace(skillId: string, workspaceId: string): Promise<boolean> {
  const [s] = await db.select({ id: skill.id }).from(skill)
    .where(and(eq(skill.id, skillId), eq(skill.workspaceId, workspaceId)));
  return !!s;
}

async function rebuildAgentSkillsMd(orgId: string, agentId: string) {
  const [a] = await db.select().from(agent).where(eq(agent.id, agentId));
  if (!a) return;
  const links = await db.select({ name: skill.name }).from(agentSkill)
    .innerJoin(skill, eq(agentSkill.skillId, skill.id)).where(eq(agentSkill.agentId, agentId));
  const list = links.length
    ? links.map((l) => "## `" + l.name + "`\n- **File:** `.claude/skills/" + l.name + ".md`").join("\n\n")
    : "_No skills enabled._";
  const ritual = a.persona?.ritual ?? "";
  const md = `# Skills — ${a.name}\n\nAssigned procedures. Each links to a real file in \`../../skills/\`.\n\n${list}\n\n## Rituals\n${ritual}\n`;
  await writeDoc(orgId, `.claude/agents/${a.handle}/skills.md`, md);
}

/** Create a skill (writes the .md) and enable it for the chosen agent. */
export async function createSkill(input: { name: string; summary: string; instructions: string; agentId: string }) {
  const { org, workspace } = await requireWorkspace();
  // The agent the skill is attached to must belong to the caller's workspace.
  if (!(await agentInWorkspace(input.agentId, workspace.id))) return;
  const name = input.name.trim().toLowerCase().replace(/\s+/g, "-");
  if (!name) return;
  const id = uid();
  await db.insert(skill).values({
    id, workspaceId: workspace.id, name, summary: input.summary, instructions: input.instructions,
    trigger: input.summary, native: false, provisional: false, indexed: "pending",
  });
  await db.insert(agentSkill).values({ agentId: input.agentId, skillId: id, auto: false }).onConflictDoNothing();
  await writeDoc(org.id, `.claude/skills/${name}.md`, skillMd(name, input.summary, input.summary, input.instructions));
  await rebuildAgentSkillsMd(org.id, input.agentId);
  revalidatePath("/skills");
}

/** Only non-native skills can be deleted. Removes the .md (deindex drops the row). */
/** Approve a provisional (AI-generated / Vannevar-proposed) skill — marks it permanent AND links it to the
 *  agents it's for (its proposedRole, else every agent) so it's actually USED, not just approved-but-orphan. */
export async function approveProvisional(id: string) {
  const { org, workspace } = await requireWorkspace();
  const [s] = await db.select().from(skill).where(and(eq(skill.id, id), eq(skill.workspaceId, workspace.id)));
  if (!s) return;
  await db.update(skill).set({ provisional: false, indexed: "indexed" }).where(eq(skill.id, id));
  const agents = await db.select({ id: agent.id, role: agent.role }).from(agent).where(eq(agent.workspaceId, workspace.id));
  const targeted = s.proposedRole ? agents.filter((a) => a.role.toLowerCase() === s.proposedRole!.toLowerCase()) : [];
  const link = targeted.length ? targeted : agents;
  for (const a of link) {
    await db.insert(agentSkill).values({ agentId: a.id, skillId: id, auto: false }).onConflictDoNothing();
    await rebuildAgentSkillsMd(org.id, a.id);
  }
  revalidatePath("/skills"); revalidatePath("/agents/[handle]", "page");
}

/** Operator-triggered (Skills page): Vannevar proposes new skills distilled from the team's validated
 *  learnings — each lands as a provisional skill to review + approve here. */
export async function suggestSkillsFromLearnings(): Promise<{ ok: boolean; proposed: number }> {
  const { org } = await requireWorkspace();
  const r = await proposeSkillsFromLearnings(org.id);
  revalidatePath("/skills");
  return r;
}

export async function deleteSkill(id: string) {
  const { org, workspace } = await requireWorkspace();
  const [s] = await db.select().from(skill).where(and(eq(skill.id, id), eq(skill.workspaceId, workspace.id)));
  if (!s || s.native) return;
  await removeDoc(org.id, `.claude/skills/${s.name}.md`);
  revalidatePath("/skills");
}

export async function toggleAgentSkill(agentId: string, skillId: string, on: boolean) {
  const { org, workspace } = await requireWorkspace();
  // Both the agent and the skill must be in the caller's workspace — otherwise a
  // user could flip skills on another org's agents or link foreign skills (IDOR).
  if (!(await agentInWorkspace(agentId, workspace.id)) || !(await skillInWorkspace(skillId, workspace.id))) return;
  // Hand-toggled (auto:false) → the stack/role reconcile will never add or remove it.
  if (on) await db.insert(agentSkill).values({ agentId, skillId, auto: false }).onConflictDoUpdate({ target: [agentSkill.agentId, agentSkill.skillId], set: { auto: false } });
  else await db.delete(agentSkill).where(and(eq(agentSkill.agentId, agentId), eq(agentSkill.skillId, skillId)));
  await rebuildAgentSkillsMd(org.id, agentId);
  revalidatePath("/agents/[handle]", "page");
}

/** Enable or disable EVERY workspace skill for one agent (the Skills tab "Enable all / Disable all"). */
export async function setAllAgentSkills(agentId: string, enable: boolean) {
  const { org, workspace } = await requireWorkspace();
  if (!(await agentInWorkspace(agentId, workspace.id))) return;
  if (enable) {
    const all = await db.select({ id: skill.id }).from(skill).where(eq(skill.workspaceId, workspace.id));
    if (all.length) await db.insert(agentSkill).values(all.map((s) => ({ agentId, skillId: s.id, auto: false }))).onConflictDoNothing();
  } else {
    await db.delete(agentSkill).where(eq(agentSkill.agentId, agentId));
  }
  await rebuildAgentSkillsMd(org.id, agentId);
  revalidatePath("/agents/[handle]", "page");
}

/** Edit a skill's procedure — writes the .md Procedure section (disk is truth). */
export async function saveSkillInstructions(id: string, instructions: string) {
  const { org, workspace } = await requireWorkspace();
  const [s] = await db.select().from(skill).where(and(eq(skill.id, id), eq(skill.workspaceId, workspace.id)));
  if (!s) return;
  await db.update(skill).set({ instructions, indexed: "indexed" }).where(eq(skill.id, id));
  await writeDoc(org.id, `.claude/skills/${s.name}.md`, skillMd(s.name, s.summary, s.trigger, instructions));
  revalidatePath("/skills");
}

/**
 * Draft a skill from a prompt — lands as a real `provisional` .md + row (pending the
 * approval gate); no agent is enabled until approved. Derived from the prompt only.
 */
export async function generateSkill(prompt: string) {
  const { org, workspace } = await requireWorkspace();
  const trimmed = prompt.trim();
  if (!trimmed) return;
  const name = (trimmed.toLowerCase().split(/\s+/).slice(0, 3).join("-").replace(/[^a-z0-9-]/g, "")) || "ai-skill";
  const id = uid();
  const summary = "AI-drafted skill — review before enabling.";
  const trigger = "Generated from: " + trimmed.slice(0, 40);
  await db.insert(skill).values({
    id, workspaceId: workspace.id, name, summary, instructions: trimmed, trigger,
    native: false, provisional: true, indexed: "pending",
  });
  await writeDoc(org.id, `.claude/skills/${name}.md`, skillMd(name, summary, trigger, trimmed));
  revalidatePath("/skills");
}
