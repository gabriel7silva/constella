/**
 * Surgical model normalizer — NOT a reseed (never wipes, never touches auth).
 *
 * Fixes the legacy default where every agent was created on the keyless
 * `http_anthropic` adapter with non-real model ids (`claude-sonnet-4`,
 * `claude-haiku`). Re-points those agents to the working `cli_claude_code`
 * runtime + real CLI aliases (opus/sonnet/haiku), in BOTH the DB rows and each
 * agent's on-disk `Agent.md` front-matter (disk stays the source of truth).
 * Idempotent — safe to run repeatedly. Run:
 *
 *   npx tsx src/db/defake-models.ts
 */
import { eq } from "drizzle-orm";
import { db } from "./index";
import { organization, agent, workspace } from "./schema";
import { readWorkspaceFile, writeWorkspaceFile } from "../lib/fs-workspace";
import { setFrontMatter } from "../lib/md-patch";

/** Map a stored model string to the real CLI alias; leave non-Claude ids (gpt/o4/ollama) untouched. */
function aliasModel(m: string): string {
  const s = (m || "").toLowerCase();
  if (s.includes("opus")) return "opus";
  if (s.includes("haiku")) return "haiku";
  if (s.includes("sonnet")) return "sonnet";
  return m;
}

function main() {
  const orgs = db.select().from(organization).all();
  let dbChanged = 0, fileChanged = 0;
  for (const o of orgs) {
    const [ws] = db.select().from(workspace).where(eq(workspace.orgId, o.id)).all();
    if (!ws) continue;
    const agents = db.select().from(agent).where(eq(agent.workspaceId, ws.id)).all();
    for (const a of agents) {
      const newAdapter = a.adapter === "http_anthropic" ? "cli_claude_code" : a.adapter;
      const newModel = aliasModel(a.model);
      if (newAdapter !== a.adapter || newModel !== a.model) {
        db.update(agent).set({ adapter: newAdapter, model: newModel }).where(eq(agent.id, a.id)).run();
        dbChanged++;
      }
      const rel = `.claude/agents/${a.handle}/Agent.md`;
      const md = readWorkspaceFile(o.id, rel);
      if (md) {
        const next = setFrontMatter(setFrontMatter(md, "provider", newAdapter), "model", newModel);
        if (next !== md) { writeWorkspaceFile(o.id, rel, next); fileChanged++; }
      }
      // Normalize the display lines in tools.md + pulse.md too (no stale ids anywhere).
      const tools = readWorkspaceFile(o.id, `.claude/agents/${a.handle}/tools.md`);
      if (tools) {
        const next = tools.replace(/Provider:\s*\S+\s*·\s*Model:\s*\S+/, `Provider: ${newAdapter} · Model: ${newModel}`);
        if (next !== tools) { writeWorkspaceFile(o.id, `.claude/agents/${a.handle}/tools.md`, next); fileChanged++; }
      }
      const pulse = readWorkspaceFile(o.id, `.claude/agents/${a.handle}/pulse.md`);
      if (pulse) {
        const next = pulse.replace(/ping to .+ \(.+\)/, `ping to ${newAdapter} (${newModel})`);
        if (next !== pulse) { writeWorkspaceFile(o.id, `.claude/agents/${a.handle}/pulse.md`, next); fileChanged++; }
      }
    }
    console.log(`· ${o.id}: ${agents.length} agents checked`);
  }
  console.log(`✓ defake-models done — DB rows updated: ${dbChanged}, Agent.md files updated: ${fileChanged}`);
}
main();
