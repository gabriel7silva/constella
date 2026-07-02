"use server";

import { rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { session as sessionTable, organization, member, workspace, agent } from "@/db/schema";
import { getSession, requireWorkspace } from "@/lib/workspace";
import { constellaHome } from "@/lib/fs-workspace";
import { rerenderMissionDocs } from "@/data/scaffold";
import { logDecision } from "@/server/decisions";
import { seedLibrarySkills, reconcileStackRoleSkills } from "@/server/seed-library-skills";
import { reconcileStack } from "@/lib/stack-compat";
import { librarySkillNamesForStack } from "@/server/skills-library";
import { indexRag } from "@/server/rag";

async function owns(userId: string, orgId: string): Promise<boolean> {
  const [m] = await db.select().from(member).where(and(eq(member.userId, userId), eq(member.orgId, orgId)));
  return !!m;
}

/** Switch the active organization (persists on the better-auth session row). */
export async function setActiveOrg(orgId: string) {
  const s = await getSession();
  // Only let a user switch into an org they actually belong to (defense-in-depth;
  // getActiveOrg also re-validates membership on read).
  if (!s || !(await owns(s.user.id, orgId))) return;
  await db.update(sessionTable).set({ activeOrgId: orgId }).where(eq(sessionTable.userId, s.user.id));
  revalidatePath("/", "layout");
}

export async function renameOrg(orgId: string, name: string) {
  const s = await getSession();
  if (!s || !(await owns(s.user.id, orgId))) return;
  await db.update(organization).set({ name: name.trim() || "Organization" }).where(eq(organization.id, orgId));
  await db.update(workspace).set({ name: name.trim() || "Organization" }).where(eq(workspace.orgId, orgId));
  revalidatePath("/organizations");
}

export async function archiveOrg(orgId: string, on: boolean) {
  const s = await getSession();
  if (!s || !(await owns(s.user.id, orgId))) return;
  await db.update(organization).set({ archived: on }).where(eq(organization.id, orgId));
  revalidatePath("/organizations");
}

/** Delete an organization — cascades its workspace/agents/etc in the DB and removes its on-disk workspace. */
export async function deleteOrg(orgId: string) {
  const s = await getSession();
  if (!s || !(await owns(s.user.id, orgId))) return;
  try {
    const dir = join(constellaHome(), "organizations", orgId);
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  } catch { /* disk cleanup is best-effort */ }
  await db.delete(organization).where(eq(organization.id, orgId)); // FK cascade clears member/workspace/agents/…
  await db.update(sessionTable).set({ activeOrgId: null }).where(eq(sessionTable.userId, s.user.id));
  revalidatePath("/", "layout");
}

/** Edit the active workspace's mission/objective. On a real change this is a DIRECTION change:
 *  it re-renders every doc that embedded the old mission/objective (so disk + agent context stop
 *  being stale) and logs the decision. Agent prompts already read the live values from the DB. */
export async function editWorkspaceMeta(mission: string, objective: string) {
  const { org, workspace: ws } = await requireWorkspace();
  const changed = (ws.mission ?? "") !== mission || (ws.objective ?? "") !== objective;
  await db.update(workspace).set({ mission, objective }).where(eq(workspace.id, ws.id));
  if (changed) {
    try {
      rerenderMissionDocs({ orgId: org.id, slug: ws.slug, company: ws.name, mission, objective, stack: (ws.stack ?? {}) as Record<string, string> });
    } catch (e) { console.error("[editWorkspaceMeta] doc rerender failed:", e); }
    await logDecision(ws.id, { text: `Direction updated — objective: ${objective.slice(0, 160)}`, by: "operator", source: "operator-instruction" });
  }
  revalidatePath("/organizations"); revalidatePath("/", "layout");
}

/** Edit the active workspace's PROJECT STACK. On a real change this re-seeds any newly-relevant native
 *  skills, re-links every agent to its stack+role profile (so the right Django/Vue/design/security skills
 *  reach the right agents), re-renders the stack-bearing docs and re-indexes RAG. */
export async function setWorkspaceStack(stack: Record<string, string>) {
  const { org, workspace: ws } = await requireWorkspace();
  const trimmed: Record<string, string> = {};
  for (const [k, v] of Object.entries(stack ?? {})) if (typeof v === "string" && v.trim()) trimmed[k] = v.trim();
  // Final guard: never persist an invalid combination — drop any pick incompatible with the rest.
  const clean = reconcileStack(trimmed).stack;
  const changed = JSON.stringify(ws.stack ?? {}) !== JSON.stringify(clean);
  await db.update(workspace).set({ stack: clean }).where(eq(workspace.id, ws.id));
  if (changed) {
    try {
      const agents = await db.select({ id: agent.id, handle: agent.handle }).from(agent).where(eq(agent.workspaceId, ws.id));
      const agentIds = Object.fromEntries(agents.map((a) => [a.handle, a.id]));
      // seed the stack-relevant skills (no-op if already present), then re-link agents by role + prune.
      seedLibrarySkills({ orgId: org.id, wsId: ws.id, names: librarySkillNamesForStack(clean), agentIds, linkNames: [] });
      reconcileStackRoleSkills(ws.id);
      rerenderMissionDocs({ orgId: org.id, slug: ws.slug, company: ws.name, mission: ws.mission ?? "", objective: ws.objective ?? "", stack: clean });
      await logDecision(ws.id, { text: `Stack updated — ${Object.entries(clean).map(([k, v]) => `${k}:${v}`).filter((s) => !s.endsWith(":None")).join(", ").slice(0, 200)}`, by: "operator", source: "operator-instruction" });
      void indexRag(org.id).catch(() => {});
    } catch (e) { console.error("[setWorkspaceStack] reconcile failed:", e); }
  }
  revalidatePath("/config"); revalidatePath("/", "layout");
}
