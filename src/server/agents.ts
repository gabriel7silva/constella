"use server";

import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { agent, skill, agentSkill, task, goal, spec, issue, report, notification, costEntry, event, routine, cronJob, cronRun, inboxItem, activity } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";
import { readWorkspaceFile, deleteWorkspacePath } from "@/lib/fs-workspace";
import { writeDoc } from "@/lib/workspace-doc";
import { setFrontMatter, setInlineField, setSection } from "@/lib/md-patch";
import { temperatureBehavior } from "@/data/temperature";
import { pickBinary, cliVersion, detectCliAuth, LOGIN_HINTS, validateAdapterModel } from "@/server/adapters/cli";
import { createAgentRow } from "@/server/agent-create";
import { reconcileStackRoleSkills } from "@/server/seed-library-skills";
import type { AgentDef, ScaffoldCtx } from "@/data/scaffold";

/** Re-assign who an agent reports to (Org Chart). Guards against self/cycles. */
export async function setReportsTo(agentId: string, reportsTo: string | null) {
  const { workspace } = await requireWorkspace();
  if (agentId === reportsTo) return;
  const agents = await db.select().from(agent).where(eq(agent.workspaceId, workspace.id));
  const byId = Object.fromEntries(agents.map((a) => [a.id, a]));
  // cycle check: walking up from reportsTo must not reach agentId
  let cur = reportsTo;
  const seen = new Set<string>();
  while (cur) {
    if (cur === agentId) return; // would create a cycle
    if (seen.has(cur)) break;
    seen.add(cur);
    cur = byId[cur]?.reportsTo ?? null;
  }
  await db.update(agent).set({ reportsTo }).where(and(eq(agent.id, agentId), eq(agent.workspaceId, workspace.id)));
  revalidatePath("/org");
}

/**
 * Re-assign who an agent reports to, keyed by handle (Org Chart canvas).
 * `agent.reportsTo` stores the MANAGER'S HANDLE (see db/seed.ts), so the org
 * chart works in handle-space end to end. Guards against self/cycles.
 * Pass managerHandle = null to detach (becomes a root / CEO).
 */
export async function setReportsToByHandle(agentHandle: string, managerHandle: string | null) {
  const { workspace } = await requireWorkspace();
  if (agentHandle === managerHandle) return;
  const agents = await db.select().from(agent).where(eq(agent.workspaceId, workspace.id));
  const byHandle = Object.fromEntries(agents.map((a) => [a.handle, a]));
  const self = byHandle[agentHandle];
  if (!self) return;
  // manager must exist in this workspace (or be null = detach)
  if (managerHandle !== null && !byHandle[managerHandle]) return;
  // cycle check: walking up from the proposed manager must not reach the agent itself
  let cur: string | null = managerHandle;
  const seen = new Set<string>();
  while (cur) {
    if (cur === agentHandle) return; // would create a cycle
    if (seen.has(cur)) break;
    seen.add(cur);
    cur = byHandle[cur]?.reportsTo ?? null;
  }
  await db.update(agent).set({ reportsTo: managerHandle }).where(and(eq(agent.id, self.id), eq(agent.workspaceId, workspace.id)));
  revalidatePath("/org");
}

/** Update an agent's model config — writes through to Agent.md frontmatter (disk is truth). */
export async function saveAgentModel(agentId: string, input: { adapter?: string; model?: string; temperature?: number; effort?: "low" | "medium" | "high" | "max"; dailyCapUsd?: number; tierFloor?: "light" | "heavy" | "critical" }) {
  const { org, workspace } = await requireWorkspace();
  const [a] = await db.select().from(agent).where(and(eq(agent.id, agentId), eq(agent.workspaceId, workspace.id)));
  if (!a) return;
  await db.update(agent).set({
    ...(input.adapter !== undefined ? { adapter: input.adapter } : {}),
    ...(input.model !== undefined ? { model: input.model } : {}),
    ...(input.temperature !== undefined ? { temperature: input.temperature } : {}),
    ...(input.effort !== undefined ? { effort: input.effort } : {}),
    ...(input.dailyCapUsd !== undefined ? { dailyCapUsd: input.dailyCapUsd } : {}),
    ...(input.tierFloor !== undefined ? { tierFloor: input.tierFloor } : {}),
  }).where(eq(agent.id, agentId));

  const rel = `.claude/agents/${a.handle}/Agent.md`;
  let md = readWorkspaceFile(org.id, rel);
  if (md) {
    if (input.adapter !== undefined) md = setFrontMatter(md, "provider", input.adapter);
    if (input.model !== undefined) md = setFrontMatter(md, "model", input.model);
    if (input.temperature !== undefined) { md = setFrontMatter(md, "temperature", input.temperature); md = setSection(md, "Behavior", temperatureBehavior(input.temperature)); }
    if (input.effort !== undefined) md = setFrontMatter(md, "effort", input.effort);
    if (input.dailyCapUsd !== undefined) md = setFrontMatter(md, "dailyCapUsd", input.dailyCapUsd);
    if (input.tierFloor !== undefined) md = setFrontMatter(md, "tierFloor", input.tierFloor);
    await writeDoc(org.id, rel, md);
  }
  revalidatePath("/agents/[handle]", "page");
}

/** Fire (delete) a HIRED agent: re-point its direct reports to its manager, NULL the non-cascading
 *  references (history rows survive, attributed to nobody), delete the row (pulse + agentSkill cascade),
 *  then remove its on-disk persona dir. Native roster agents are NOT fireable — they're defined in code
 *  and re-seeded on boot, so firing one is futile. */
export async function deleteAgent(agentId: string): Promise<{ ok: boolean; error?: string }> {
  const { org, workspace } = await requireWorkspace();
  const [a] = await db.select().from(agent).where(and(eq(agent.id, agentId), eq(agent.workspaceId, workspace.id)));
  if (!a) return { ok: false, error: "Agent not found." };
  if (a.origin !== "hired") return { ok: false, error: "Only hired agents can be fired (the native roster is defined in code)." };

  const wsId = workspace.id;
  // Promote direct reports to the fired agent's manager (reportsTo is a HANDLE).
  await db.update(agent).set({ reportsTo: a.reportsTo ?? null }).where(and(eq(agent.workspaceId, wsId), eq(agent.reportsTo, a.handle)));
  // NULL the non-cascading FKs (pulse + agentSkill cascade on the row delete below).
  await db.update(task).set({ assigneeId: null }).where(eq(task.assigneeId, agentId));
  await db.update(goal).set({ ownerId: null }).where(eq(goal.ownerId, agentId));
  await db.update(spec).set({ authorId: null }).where(eq(spec.authorId, agentId));
  await db.update(issue).set({ assigneeId: null }).where(eq(issue.assigneeId, agentId));
  await db.update(report).set({ authorId: null }).where(eq(report.authorId, agentId));
  await db.update(notification).set({ agentId: null }).where(eq(notification.agentId, agentId));
  await db.update(costEntry).set({ agentId: null }).where(eq(costEntry.agentId, agentId));
  await db.update(event).set({ agentId: null }).where(eq(event.agentId, agentId));
  await db.update(routine).set({ agentId: null }).where(eq(routine.agentId, agentId));
  await db.update(cronJob).set({ agentId: null }).where(eq(cronJob.agentId, agentId));
  await db.update(cronRun).set({ agentId: null }).where(eq(cronRun.agentId, agentId));
  await db.update(inboxItem).set({ fromAgentId: null }).where(eq(inboxItem.fromAgentId, agentId));
  await db.update(activity).set({ agentId: null }).where(eq(activity.agentId, agentId));

  await db.delete(agent).where(and(eq(agent.id, agentId), eq(agent.workspaceId, wsId)));
  try { deleteWorkspacePath(org.id, `.claude/agents/${a.handle}`); } catch { /* best-effort */ }

  revalidatePath("/org");
  revalidatePath("/agents/[handle]", "page");
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Set (or clear) an agent's avatar image. New avatars are DB-stored data URLs; this also cleans up a
 *  LEGACY workspace-stored avatar (uploads/<id>/<name>) when it's replaced/removed, so old photos stop
 *  polluting the workspace file tree. Each upload had its own uuid dir, so deleting it is safe. */
export async function saveAgentImage(agentId: string, imagePath: string | null) {
  const { org, workspace } = await requireWorkspace();
  const [a] = await db.select().from(agent).where(and(eq(agent.id, agentId), eq(agent.workspaceId, workspace.id)));
  if (!a) return;
  if (a.image && a.image.startsWith("uploads/") && a.image !== imagePath) {
    try { deleteWorkspacePath(org.id, a.image.split("/").slice(0, 2).join("/")); } catch { /* best-effort */ }
  }
  await db.update(agent).set({ image: imagePath ?? null }).where(eq(agent.id, agentId));
  revalidatePath("/agents/[handle]", "page");
  revalidatePath("/", "layout");
}

/** Update an agent's persona — patches Agent.md (Identity/Ritual/Tone/System prompt) on disk. */
export async function saveAgentPersona(agentId: string, persona: { identity: string; ritual: string; tone: string; systemPrompt: string }) {
  const { org, workspace } = await requireWorkspace();
  const [a] = await db.select().from(agent).where(and(eq(agent.id, agentId), eq(agent.workspaceId, workspace.id)));
  if (!a) return;
  await db.update(agent).set({ persona }).where(eq(agent.id, agentId));

  const rel = `.claude/agents/${a.handle}/Agent.md`;
  let md = readWorkspaceFile(org.id, rel);
  if (md) {
    md = setInlineField(md, "Identity", persona.identity);
    md = setInlineField(md, "Ritual", persona.ritual);
    md = setSection(md, "System prompt", persona.systemPrompt);
  } else {
    md = `---\nhandle: ${a.handle}\nname: ${a.name}\nrole: ${a.role}\n---\n# ${a.name} — ${a.role}\n\n**Identity:** ${persona.identity}\n\n**Ritual:** ${persona.ritual}\n\n## System prompt\n${persona.systemPrompt}\n`;
  }
  await writeDoc(org.id, rel, md);
  revalidatePath("/agents/[handle]", "page");
}

/** Persist an agent's org-chart card position (drag-to-arrange layout). No revalidate — keep the canvas stable. */
export async function saveOrgLayout(handle: string, x: number, y: number) {
  const { workspace } = await requireWorkspace();
  await db.update(agent).set({ orgX: Math.round(x), orgY: Math.round(y) }).where(and(eq(agent.handle, handle), eq(agent.workspaceId, workspace.id)));
}

/** Persist this agent's RAG source toggles + custom sources (used by retrieval at run time). */
export async function saveAgentRag(agentId: string, rag: { repo: boolean; room: boolean; reports: boolean; skills: boolean; external: boolean; sources?: string[] }) {
  const { workspace } = await requireWorkspace();
  const [a] = await db.select().from(agent).where(and(eq(agent.id, agentId), eq(agent.workspaceId, workspace.id)));
  if (!a) return;
  await db.update(agent).set({ rag }).where(eq(agent.id, agentId));
  revalidatePath("/agents/[handle]", "page");
}

/** Live pre-flight for the Hire-Agent UI: is the CLI for this adapter installed + logged in? */
export async function checkAdapterReady(adapter: string): Promise<{ bin: string; installed: boolean; auth: string; hint: string }> {
  const bin = pickBinary(adapter);
  const installed = (await cliVersion(bin)) !== null;
  const auth = installed ? await detectCliAuth(bin) : "needs_login";
  return { bin, installed, auth, hint: LOGIN_HINTS[bin] ?? "" };
}

/**
 * Hire a new agent at runtime (the "Contratar Agente" UI). The single source of agent creation
 * ([createAgentRow]) writes the adapter/model explicitly; here we add the validation + a BLOCKING
 * pre-flight: the chosen CLI must be installed AND logged in, otherwise the agent would fail on its
 * first tick. Adapter/model are checked against the CLI allowlist (no arbitrary command).
 */
export async function hireAgent(input: {
  handle: string; name: string; role: string; color?: string;
  reportsTo?: string | null; adapter: string; model: string;
  temperature?: number; effort?: "low" | "medium" | "high" | "max"; dailyCapUsd?: number; tierFloor?: "light" | "heavy" | "critical";
  identity?: string; ritual?: string; tone?: string; systemPrompt?: string;
}): Promise<{ ok: boolean; agentId?: string; error?: string }> {
  const { org, workspace } = await requireWorkspace();

  // 1) Basic shape.
  const handle = (input.handle || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  if (!handle) return { ok: false, error: "Handle is required (letters, numbers, - or _)." };
  if (!input.name?.trim()) return { ok: false, error: "Name is required." };
  if (!input.role?.trim()) return { ok: false, error: "Role is required." };
  const tier = input.tierFloor ?? "heavy";
  if (!["light", "heavy", "critical"].includes(tier)) return { ok: false, error: "Invalid budget tier." };
  const cap = input.dailyCapUsd ?? 15;
  if (!(cap > 0)) return { ok: false, error: "Daily cap must be greater than 0." };

  // 2) Adapter + model against the allowlist (defense against an arbitrary CLI / model injection).
  const v = validateAdapterModel(input.adapter, input.model);
  if (!v.ok) return { ok: false, error: v.error };

  // 3) Unique handle + manager exists (a brand-new agent can't form a cycle — nobody reports to it yet).
  const agents = await db.select().from(agent).where(eq(agent.workspaceId, workspace.id));
  const byHandle = Object.fromEntries(agents.map((a) => [a.handle, a]));
  if (byHandle[handle]) return { ok: false, error: `An agent "@${handle}" already exists.` };
  const reportsTo = input.reportsTo?.trim() || null;
  if (reportsTo && !byHandle[reportsTo]) return { ok: false, error: `Manager "@${reportsTo}" not found in this workspace.` };

  // 4) BLOCKING pre-flight — the CLI must be installed AND ready, or the agent dies on the first tick.
  const bin = pickBinary(input.adapter);
  if ((await cliVersion(bin)) === null) return { ok: false, error: `The ${bin} CLI is not installed on this host.` };
  if ((await detectCliAuth(bin)) !== "ready") return { ok: false, error: `The ${bin} CLI isn't ready — ${LOGIN_HINTS[bin] ?? "sign in to it"}, then try again.` };

  // 5) Create (single source) with persona JSON, then link skills.
  const def: AgentDef = {
    handle, name: input.name.trim(), role: input.role.trim(), color: input.color || "#7ac5e0",
    reportsTo, model: input.model, provider: input.adapter, temperature: input.temperature ?? 0.4,
    dailyCapUsd: cap, tier, identity: input.identity?.trim() || "", ritual: input.ritual?.trim() || "",
  };
  const ctx: ScaffoldCtx = {
    orgId: org.id, slug: workspace.slug, company: workspace.name,
    mission: workspace.mission, objective: workspace.objective, stack: (workspace.stack ?? {}) as Record<string, string>,
  };
  const persona = { identity: def.identity, ritual: def.ritual, tone: input.tone?.trim() || "", systemPrompt: input.systemPrompt?.trim() || "" };
  const agentId = createAgentRow(org.id, workspace.id, def, ctx, { origin: "hired", hiredAt: new Date(), persona, effort: input.effort ?? "medium" });

  // Link the non-provisional native skills + reconcile this agent's stack/role skills.
  const enableSkillIds = (await db.select({ id: skill.id }).from(skill)
    .where(and(eq(skill.workspaceId, workspace.id), eq(skill.provisional, false)))).map((s) => s.id);
  for (const sid of enableSkillIds) { try { await db.insert(agentSkill).values({ agentId, skillId: sid }); } catch { /* dup link */ } }
  try { reconcileStackRoleSkills(workspace.id); } catch { /* best-effort */ }

  revalidatePath("/org");
  revalidatePath("/agents/[handle]", "page");
  return { ok: true, agentId };
}
