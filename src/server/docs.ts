"use server";

import { randomUUID as uid } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { docIndex, agent, costEntry } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";
import { writeDoc } from "@/lib/workspace-doc";
import { runAgent, pickBinary } from "@/server/adapters/cli";
import { notifyOps } from "@/lib/notify";

/** Save a DOCS/PO markdown file — writes through to disk (truth) then re-indexes. */
export async function saveDoc(docId: string, content: string): Promise<{ ok: boolean }> {
  const { org, workspace } = await requireWorkspace();
  const [row] = await db.select().from(docIndex).where(and(eq(docIndex.id, docId), eq(docIndex.workspaceId, workspace.id)));
  if (!row) return { ok: false };
  await writeDoc(org.id, row.path, content);
  return { ok: true };
}

/**
 * REAL docs generation — the Docs agent (@barbara) reviews the actual workspace
 * directory and writes/updates a Markdown doc under DOCS/. Write-through + indexed,
 * so it appears in /docs immediately. Real cost booked; honest on an empty run.
 */
export async function generateDocs(): Promise<{ ok: boolean; path?: string; error?: string }> {
  const { org, workspace } = await requireWorkspace();
  const agents = await db.select().from(agent).where(eq(agent.workspaceId, workspace.id));
  const author = agents.find((a) => a.handle === "barbara") ?? agents.find((a) => /docs|writer/i.test(a.role)) ?? agents[0];
  if (!author) return { ok: false, error: "no docs agent" };

  const binary = pickBinary(author.adapter, author.model);
  const model = binary === "claude" ? (author.model.includes("opus") ? "opus" : author.model.includes("haiku") ? "haiku" : "sonnet") : undefined;
  const prompt = [
    `You are ${author.name} (@${author.handle}), ${author.role} at ${workspace.name}.`,
    `Review the current state of this workspace directory (code, specs, structure) and write or refresh a single piece of project documentation in GitHub-flavoured Markdown.`,
    `Begin with one H1 title line. Cover what exists, how it is organised, and how to work with it. Be specific and truthful — describe only what the files actually show; do not invent features.`,
    `Output ONLY the Markdown document (no code fences).`,
  ].join("\n");

  const res = await runAgent(prompt, { orgId: org.id, binary, model, timeoutMs: 240_000 });
  if (res.usd > 0 || res.inputTokens + res.outputTokens > 0) {
    await db.insert(costEntry).values({ id: uid(), workspaceId: workspace.id, agentId: author.id, provider: res.binary, model: res.model ?? author.model, usd: res.usd, tokens: res.inputTokens + res.outputTokens, at: new Date() });
  }

  const md = res.text.trim();
  if (!res.ok || !md) {
    await notifyOps(workspace.id, { kind: "info", text: "Docs generation failed", detail: (res.error ?? "no output").slice(0, 300), agentId: author.id });
    return { ok: false, error: res.error };
  }
  const titleLine = md.split("\n").find((l) => l.trim());
  const title = (titleLine ?? "Documentation").replace(/^#+\s*/, "").slice(0, 120) || "Documentation";
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "doc";
  const rel = `DOCS/${slug}.md`;
  await writeDoc(org.id, rel, md);
  await notifyOps(workspace.id, { kind: "done", text: `${author.name} updated the docs: ${title}`, detail: `Saved to ${rel}`, agentId: author.id });
  return { ok: true, path: rel };
}
