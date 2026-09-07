import { eq, and, inArray, like } from "drizzle-orm";
import { db } from "@/db";
import { skill, agentSkill, agent, event } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";
import { loadLibraryIndex } from "@/server/skills-library";
import { Topbar } from "@/components/shell/topbar";
import { SkillsClient, type SkillRow, type AgentRow } from "@/components/modules/skill-actions";

// The 6 procedural natives seeded directly (not in the stack library) → "core".
const CORE_SKILLS = new Set(["open-pr", "run-suite", "secret-scan", "telegram-notify", "moscow-prioritise", "gguf-validate"]);

export default async function SkillsPage() {
  const { workspace } = await requireWorkspace();
  const skills = await db.select().from(skill).where(eq(skill.workspaceId, workspace.id));
  const links = await db.select().from(agentSkill);
  const agents = await db.select().from(agent).where(eq(agent.workspaceId, workspace.id));
  const byAgent = Object.fromEntries(agents.map((a) => [a.id, a]));

  // Category — derived from the native library's folder (stacks/design/engineering/process/languages/…),
  // else "core" for the procedural natives, else "custom" (operator/Vannevar-proposed).
  const lib = loadLibraryIndex();
  const categoryFor = (name: string, native: boolean): string => {
    const top = lib.get(name)?.relPath?.split("/")[0];
    if (top) return top;
    if (CORE_SKILLS.has(name)) return "core";
    return native ? "core" : "custom";
  };

  // "Consulted by agents" — count agent run-events that READ/EDITED a skill file (`.claude/skills/<name>.md`).
  // Skills aren't in RAG (excluded by design); the truthful "used" signal is the agent reading the file.
  const evs = await db.select({ target: event.target, agentId: event.agentId, seq: event.seq }).from(event)
    .where(and(eq(event.workspaceId, workspace.id), inArray(event.kind, ["read", "edit"]), like(event.target, "%skills%")));
  const use = new Map<string, { count: number; lastSeq: number; lastAgent: string | null }>();
  for (const e of evs) {
    const m = (e.target || "").replace(/\\/g, "/").match(/([^/]+)\.md$/);
    if (!m) continue;
    const cur = use.get(m[1]) ?? { count: 0, lastSeq: 0, lastAgent: null };
    cur.count++;
    if ((e.seq ?? 0) > cur.lastSeq) { cur.lastSeq = e.seq ?? 0; cur.lastAgent = e.agentId; }
    use.set(m[1], cur);
  }

  const agentRows: AgentRow[] = agents.map((a) => ({ id: a.id, handle: a.handle, name: a.name, role: a.role, color: a.color, health: a.health }));

  const rows: SkillRow[] = skills.map((s) => {
    const u = use.get(s.name);
    return {
      id: s.id,
      name: s.name,
      summary: s.summary,
      instructions: s.instructions,
      trigger: s.trigger,
      native: s.native,
      provisional: s.provisional,
      indexed: s.indexed,
      file: "skills/" + s.name + ".md",
      category: categoryFor(s.name, s.native),
      usedCount: u?.count ?? 0,
      lastBy: u?.lastAgent ? (byAgent[u.lastAgent]?.name ?? null) : null,
      users: links
        .filter((l) => l.skillId === s.id)
        .map((l) => byAgent[l.agentId])
        .filter(Boolean)
        .map((u) => ({ id: u.id, name: u.name, color: u.color, health: u.health })),
    };
  });

  return <><Topbar title="Skills" /><SkillsClient skills={rows} agents={agentRows} /></>;
}
