"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { agent } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";
import { readWorkspaceFile } from "@/lib/fs-workspace";
import { scaffoldMissing } from "@/data/scaffold";

export type ValidationIssue = { path: string; problem: "missing" | "empty" };

const REQUIRED_FILES = [
  ".claude/organization.md", ".claude/workspace.md", ".claude/permissions.md",
  ".claude/memory.md", ".claude/routing.md", ".claude/index.md", ".claude/CLAUDE.md", ".claude/settings.json",
  "DOCS/architecture.md", "DOCS/code-standards.md", "PO/roadmap.md", "PO/backlog.md",
  "Reports/system-health.md", "Reports/agent-status.md", "README.md",
];
const AGENT_FILES = ["Agent.md", "pulse.md", "tools.md", "skills.md"];

/**
 * Enforce the no-empty-workspace rule: every required folder/file exists and is
 * non-empty, each agent has its persona/pulse/tools/skills, etc. A failing
 * workspace is invalid → optionally auto-repaired from the templates.
 */
export async function validateWorkspace(opts?: { repair?: boolean }): Promise<{ ok: boolean; issues: ValidationIssue[]; repaired: string[] }> {
  const { org, workspace } = await requireWorkspace();
  const agents = await db.select().from(agent).where(eq(agent.workspaceId, workspace.id));

  const issues: ValidationIssue[] = [];
  const check = (rel: string) => {
    const c = readWorkspaceFile(org.id, rel);
    if (c == null) issues.push({ path: rel, problem: "missing" });
    else if (c.trim() === "") issues.push({ path: rel, problem: "empty" });
  };
  for (const rel of REQUIRED_FILES) check(rel);
  for (const a of agents) for (const f of AGENT_FILES) check(`.claude/agents/${a.handle}/${f}`);

  let repaired: string[] = [];
  if (opts?.repair && issues.length) {
    repaired = scaffoldMissing({
      orgId: org.id, slug: workspace.slug, company: workspace.name, mission: workspace.mission,
      objective: workspace.objective, stack: (workspace.stack ?? {}) as Record<string, string>,
      runMode: org.runMode, createdAt: new Date().toISOString().slice(0, 10),
    });
    revalidatePath("/pulse");
    revalidatePath("/code");
  }
  return { ok: issues.length === 0, issues, repaired };
}
