"use server";

import { randomUUID as uid } from "node:crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { report, agent, costEntry } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";
import { runAgent, pickBinary } from "@/server/adapters/cli";
import { writeWorkspaceFile } from "@/lib/fs-workspace";
import { notifyOps } from "@/lib/notify";

/**
 * REAL report generation: an agent reviews the actual workspace directory and
 * writes a Markdown status report to disk + a `report` row. Real cost is booked;
 * the markdown is the agent's real output (the reader renders it). Honest: a
 * failed/empty run files no report and notifies why.
 */
export async function generateReport(): Promise<{ ok: boolean; id?: string; error?: string }> {
  const { org, workspace } = await requireWorkspace();
  const agents = await db.select().from(agent).where(eq(agent.workspaceId, workspace.id));
  const author = agents.find((a) => a.handle === "ada") ?? agents.find((a) => /ceo|docs|chief/i.test(a.role)) ?? agents[0];
  if (!author) return { ok: false, error: "no agent" };

  const binary = pickBinary(author.adapter, author.model);
  const model = binary === "claude" ? (author.model.includes("opus") ? "opus" : author.model.includes("haiku") ? "haiku" : "sonnet") : undefined;
  const prompt = [
    `You are ${author.name} (@${author.handle}), ${author.role} at ${workspace.name}.`,
    `Review the current state of this workspace directory (files, code, docs) and write a concise STATUS REPORT in GitHub-flavoured Markdown.`,
    `Begin with a single H1 title line. Cover: what exists now, notable risks, and recommended next steps. Be specific and truthful — do NOT invent metrics you cannot verify from the files.`,
    `Output ONLY the Markdown report (no code fences).`,
  ].join("\n");

  const res = await runAgent(prompt, { orgId: org.id, binary, model, timeoutMs: 240_000 });
  if (res.usd > 0 || res.inputTokens + res.outputTokens > 0) {
    await db.insert(costEntry).values({ id: uid(), workspaceId: workspace.id, agentId: author.id, provider: res.binary, model: res.model ?? author.model, usd: res.usd, tokens: res.inputTokens + res.outputTokens, at: new Date() });
  }

  const body = res.text.trim();
  if (!res.ok || !body) {
    await notifyOps(workspace.id, { kind: "info", text: "Report generation failed", detail: (res.error ?? "no output").slice(0, 300), agentId: author.id });
    return { ok: false, error: res.error };
  }

  const titleLine = body.split("\n").find((l) => l.trim());
  const title = (titleLine ?? "Status report").replace(/^#+\s*/, "").slice(0, 120) || "Status report";
  const slugName = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "report";
  const id = uid();
  writeWorkspaceFile(org.id, `Reports/${slugName}.md`, body);
  await db.insert(report).values({ id, workspaceId: workspace.id, title, type: "Report", authorId: author.id, body });
  await notifyOps(workspace.id, { kind: "done", text: `${author.name} filed a report: ${title}`, detail: `Saved to Reports/${slugName}.md`, agentId: author.id });
  revalidatePath("/reports");
  return { ok: true, id };
}
