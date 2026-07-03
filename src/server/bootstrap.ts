"use server";

import { randomUUID as uid } from "node:crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { workspace, costEntry } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";
import { writeWorkspaceFile, readWorkspaceFile } from "@/lib/fs-workspace";
import { runAgent, pickBinary, cliVersion } from "@/server/adapters/cli";

/**
 * OPTIONAL workspace enrichment. The deterministic templates already make the
 * workspace complete + valid; this runs a REAL Claude pass to tailor the key
 * narrative files to the org's brief. Manual + CLI-gated (it spends real money,
 * so it is never auto-triggered); honest fallback leaves the templates in place.
 */
const ENRICH_TARGETS = [".claude/organization.md", ".claude/CLAUDE.md", "DOCS/architecture.md", "PO/roadmap.md"];

export async function enrichWorkspace(): Promise<{ ok: boolean; enriched: number; error?: string }> {
  const { org, workspace: ws } = await requireWorkspace();
  const binary = pickBinary();
  if (!(await cliVersion(binary))) return { ok: false, enriched: 0, error: "no CLI available" };

  await db.update(workspace).set({ bootstrap: "enriching" }).where(eq(workspace.id, ws.id));

  let enriched = 0;
  for (const rel of ENRICH_TARGETS) {
    const cur = readWorkspaceFile(org.id, rel) ?? "";
    const prompt = [
      `You are the bootstrap writer for the organization "${ws.name}".`,
      `Mission: ${ws.mission || "(none set)"}. Objective: ${ws.objective || "(none set)"}.`,
      `Rewrite the Markdown file ${rel} so it is specific and genuinely useful for THIS organization.`,
      `Keep the same headings/structure; expand with real, concrete content grounded in the mission.`,
      `Output ONLY the Markdown (no code fences, no preamble).`,
      ``,
      `--- current ${rel} ---`,
      cur,
    ].join("\n");
    const res = await runAgent(prompt, { orgId: org.id, binary, model: binary === "claude" ? "sonnet" : undefined, timeoutMs: 120_000 });
    if (res.usd > 0 || res.inputTokens + res.outputTokens > 0) {
      await db.insert(costEntry).values({ id: uid(), workspaceId: ws.id, agentId: null, provider: res.binary, model: res.model ?? "bootstrap", usd: res.usd, tokens: res.inputTokens + res.outputTokens, at: new Date() });
    }
    const body = res.text.trim();
    if (res.ok && body.length > 40) { writeWorkspaceFile(org.id, rel, body); enriched++; }
  }

  await db.update(workspace).set({ bootstrap: enriched > 0 ? "done" : "template-only" }).where(eq(workspace.id, ws.id));
  revalidatePath("/", "layout");
  return { ok: enriched > 0, enriched };
}
