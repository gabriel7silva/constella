"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/workspace";
import { runKbCuration } from "@/server/kb";
import { indexRag } from "@/server/rag";

/** Operator-triggered Vannevar curation pass (dedup / retire / re-summarise / find gaps). */
export async function curateKbAction(): Promise<{ ok: boolean; merged: number; retired: number; summarized: number; gaps: number }> {
  const { org } = await requireWorkspace();
  const r = await runKbCuration(org.id);
  revalidatePath("/knowledge");
  revalidatePath("/reports");
  return r;
}

/** Full RAG/KB reindex on demand. */
export async function reindexKbAction(): Promise<{ ok: boolean; chunks: number }> {
  const { org } = await requireWorkspace();
  const r = await indexRag(org.id);
  revalidatePath("/knowledge");
  return { ok: r.ok, chunks: r.chunks };
}
