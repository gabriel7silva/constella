"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/workspace";
import { upsertBlock, deleteBlock, mergeProposal, rejectProposal, seedCanonicalBlocks } from "@/server/blocks";

/** Seed the full canonical block set — mission/objective/stack from the workspace + editable starter
 *  placeholders for architecture, business rules, UI/security patterns, checklists, glossary, etc.
 *  Wired to the KB card + the Welcome Home "Create central blocks" button. */
export async function seedDefaultBlocksAction() {
  const { org } = await requireWorkspace();
  const r = await seedCanonicalBlocks(org.id);
  revalidatePath("/knowledge");
  revalidatePath("/");
  return r;
}

/** Operator creates/edits a synced block (canonical knowledge). */
export async function saveBlockAction(input: { slug: string; kind?: string; title?: string; body: string }) {
  const { workspace } = await requireWorkspace();
  const r = await upsertBlock(workspace.id, { ...input, updatedBy: "operator" });
  revalidatePath("/knowledge");
  revalidatePath("/");
  return r;
}
export async function deleteBlockAction(slug: string) {
  const { workspace } = await requireWorkspace();
  await deleteBlock(workspace.id, slug);
  revalidatePath("/knowledge");
  revalidatePath("/");
  return { ok: true };
}
/** Operator (or KB agent) merges an agent's proposed block edit → applies it + bumps the version. */
export async function mergeProposalAction(id: string) {
  const { workspace } = await requireWorkspace();
  const r = await mergeProposal(workspace.id, id, "operator");
  revalidatePath("/knowledge");
  revalidatePath("/");
  return r;
}
export async function rejectProposalAction(id: string) {
  const { workspace } = await requireWorkspace();
  const r = await rejectProposal(workspace.id, id, "operator");
  revalidatePath("/knowledge");
  return r;
}
