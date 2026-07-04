"use server";

import { randomUUID as uid } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { agent, skill, agentSkill, report, docIndex, workspace } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";
import { readDir, readWorkspaceFile } from "@/lib/fs-workspace";
import { scheduleRagReindex, deindexRagFile } from "@/server/rag";

/* The directory is the source of truth; these indexers mirror it into the DB so
   the UI + search agree. Idempotent (upserts). Disk wins on every conflict. */

function frontMatter(md: string): Record<string, string> {
  const m = md.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const out: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const i = line.indexOf(":");
    if (i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}
function section(md: string, heading: string): string {
  const re = new RegExp(`##\\s+${heading}\\s*\\n([\\s\\S]*?)(?:\\n##\\s|$)`, "i");
  return md.match(re)?.[1].trim() ?? "";
}
function summaryOf(md: string): string {
  return md.split("\n").find((l) => l.trim() && !l.startsWith("#") && !l.startsWith("**") && !l.startsWith("---") && !l.startsWith("|"))?.trim() ?? "";
}
function titleOf(md: string, fallback: string): string {
  const h = md.split("\n").find((l) => l.startsWith("# "));
  return h ? h.slice(2).trim() : fallback;
}

async function wsByOrg(orgId: string) {
  const [ws] = await db.select().from(workspace).where(eq(workspace.orgId, orgId));
  return ws ?? null;
}

/* ---- per-type indexers ---- */
async function indexSkillFile(wsId: string, orgId: string, name: string) {
  const md = readWorkspaceFile(orgId, `.claude/skills/${name}.md`) ?? "";
  const summary = summaryOf(md);
  const trigger = (md.match(/\*\*Trigger:\*\*\s*(.+)/)?.[1] ?? "").trim();
  const instructions = section(md, "Procedure") || "";
  const [existing] = await db.select().from(skill).where(and(eq(skill.workspaceId, wsId), eq(skill.name, name)));
  if (existing) await db.update(skill).set({ summary, trigger, ...(instructions ? { instructions } : {}), indexed: "indexed" }).where(eq(skill.id, existing.id));
  else await db.insert(skill).values({ id: uid(), workspaceId: wsId, name, summary, trigger, instructions, native: true, provisional: false, indexed: "indexed" });
}

async function indexAgentFile(wsId: string, orgId: string, handle: string) {
  const md = readWorkspaceFile(orgId, `.claude/agents/${handle}/Agent.md`) ?? "";
  if (!md) return;
  const [a] = await db.select().from(agent).where(and(eq(agent.workspaceId, wsId), eq(agent.handle, handle)));
  if (!a) return;
  const fm = frontMatter(md);
  const persona = {
    identity: (md.match(/\*\*Identity:\*\*\s*(.+)/)?.[1] ?? "").trim(),
    ritual: (md.match(/\*\*Ritual:\*\*\s*(.+)/)?.[1] ?? "").trim(),
    // Tone has no canonical line in the template — keep what's stored unless the file declares it.
    tone: (md.match(/\*\*Tone:\*\*\s*(.+)/)?.[1] ?? "").trim() || (a.persona?.tone ?? ""),
    systemPrompt: section(md, "System prompt"),
  };
  const patch = {
    ...(fm.provider ? { adapter: fm.provider } : {}),
    ...(fm.model ? { model: fm.model } : {}),
    ...(fm.temperature ? { temperature: parseFloat(fm.temperature) } : {}),
    ...(fm.dailyCapUsd ? { dailyCapUsd: parseFloat(fm.dailyCapUsd) } : {}),
    ...(fm.tierFloor ? { tierFloor: fm.tierFloor as "light" | "heavy" | "critical" } : {}),
    ...(fm.reportsTo && fm.reportsTo !== "null" ? { reportsTo: fm.reportsTo } : {}),
    persona,
  };
  await db.update(agent).set(patch).where(eq(agent.id, a.id));
  // enable skills listed in skills.md (backtick-wrapped names)
  const sm = readWorkspaceFile(orgId, `.claude/agents/${handle}/skills.md`) ?? "";
  const enabled = [...sm.matchAll(/`([a-z0-9-]+)`/g)].map((m) => m[1]);
  for (const sn of enabled) {
    const [sk] = await db.select().from(skill).where(and(eq(skill.workspaceId, wsId), eq(skill.name, sn)));
    if (sk) await db.insert(agentSkill).values({ agentId: a.id, skillId: sk.id }).onConflictDoNothing();
  }
}

async function indexReportFile(wsId: string, orgId: string, rel: string) {
  const name = rel.split("/").pop() ?? rel;
  if (name === "README.md") return;
  const md = readWorkspaceFile(orgId, rel) ?? "";
  // Key on the markdown H1 title — the SAME value generateReport stores — so a file
  // written by an agent + later re-indexed by the watcher updates one row, never duplicates.
  const title = titleOf(md, name);
  const [existing] = await db.select().from(report).where(and(eq(report.workspaceId, wsId), eq(report.title, title)));
  if (existing) await db.update(report).set({ body: md }).where(eq(report.id, existing.id));
  else await db.insert(report).values({ id: uid(), workspaceId: wsId, title, type: "Report", body: md });
}

async function indexDocFile(wsId: string, orgId: string, rel: string, kind: "docs" | "po") {
  const md = readWorkspaceFile(orgId, rel) ?? "";
  const title = titleOf(md, rel.split("/").pop() ?? rel);
  const summary = summaryOf(md);
  const [existing] = await db.select().from(docIndex).where(and(eq(docIndex.workspaceId, wsId), eq(docIndex.path, rel)));
  if (existing) await db.update(docIndex).set({ title, summary, updatedAt: new Date() }).where(eq(docIndex.id, existing.id));
  else await db.insert(docIndex).values({ id: uid(), workspaceId: wsId, kind, path: rel, title, summary });
}

function revalidateFor(rel: string) {
  if (rel.startsWith(".claude/skills") || rel.endsWith("/skills.md")) revalidatePath("/skills");
  if (rel.startsWith(".claude/agents")) revalidatePath("/agents/[handle]", "page");
  if (rel.startsWith("DOCS")) revalidatePath("/docs");
  if (rel.startsWith("PO")) revalidatePath("/pm");
  if (rel.startsWith("Reports")) revalidatePath("/reports");
  revalidatePath("/code");
}

/* ---- public: per-file + full ---- */
/** Mirror one workspace file (by relative path) into the DB.
 *  Pass revalidate=false when indexing during a render (revalidatePath is illegal then). */
export async function indexFile(orgId: string, rel: string, revalidate = true): Promise<{ ok: boolean }> {
  const ws = await wsByOrg(orgId);
  if (!ws) return { ok: false };
  const wsId = ws.id;
  // Keep workspace RAG memory current automatically: any change to a RAG file (.md under
  // .claude/DOCS/PO/Reports/specs/issues) schedules a debounced incremental re-embed. No-op otherwise.
  scheduleRagReindex(orgId, rel);
  let m: RegExpMatchArray | null;
  if ((m = rel.match(/^\.claude\/skills\/(.+)\.md$/))) await indexSkillFile(wsId, orgId, m[1]);
  else if ((m = rel.match(/^\.claude\/agents\/([^/]+)\/(?:Agent|skills)\.md$/))) await indexAgentFile(wsId, orgId, m[1]);
  else if (/^Reports\/.+\.md$/.test(rel)) await indexReportFile(wsId, orgId, rel);
  else if (/^DOCS\/.+\.md$/.test(rel)) await indexDocFile(wsId, orgId, rel, "docs");
  else if (/^PO\/.+\.md$/.test(rel)) await indexDocFile(wsId, orgId, rel, "po");
  else return { ok: true };
  if (revalidate) revalidateFor(rel);
  return { ok: true };
}

/** Remove the DB index for a deleted file (disk is truth). */
export async function deindexFile(orgId: string, rel: string): Promise<{ ok: boolean }> {
  const ws = await wsByOrg(orgId);
  if (!ws) return { ok: false };
  const wsId = ws.id;
  void deindexRagFile(orgId, rel).catch(() => {}); // drop the deleted file's RAG chunks too
  let m: RegExpMatchArray | null;
  if ((m = rel.match(/^\.claude\/skills\/(.+)\.md$/))) await db.delete(skill).where(and(eq(skill.workspaceId, wsId), eq(skill.name, m[1])));
  else if (/^(?:DOCS|PO)\/.+\.md$/.test(rel)) await db.delete(docIndex).where(and(eq(docIndex.workspaceId, wsId), eq(docIndex.path, rel)));
  revalidateFor(rel);
  return { ok: true };
}

/** Full reconciliation — index the whole .claude/ tree + DOCS/PO/Reports for the active org.
 *  Pass revalidate=false when called during a render (e.g. index-on-load). */
export async function indexWorkspace(revalidate = true): Promise<{ ok: boolean }> {
  const { org } = await requireWorkspace();
  const orgId = org.id;
  for (const e of readDir(orgId, ".claude/skills")) if (!e.isDir && e.name.endsWith(".md")) await indexFile(orgId, e.path, false);
  for (const dir of readDir(orgId, ".claude/agents")) if (dir.isDir) await indexFile(orgId, `${dir.path}/Agent.md`, false);
  for (const top of ["DOCS", "PO", "Reports"]) for (const e of readDir(orgId, top)) if (!e.isDir && e.name.endsWith(".md")) await indexFile(orgId, e.path, false);
  if (revalidate) revalidatePath("/", "layout");
  return { ok: true };
}
