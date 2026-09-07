import "server-only";
import { randomUUID as uid } from "node:crypto";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db";
import { syncedBlock, blockProposal, ragChunk, workspace } from "@/db/schema";
import { embed, chunksOf } from "@/server/rag";
import { ensureKbTables } from "@/server/kb";
import { pushInbox, resolveInboxFor } from "@/server/inbox";
import { notifyOps } from "@/lib/notify";

/**
 * Synced knowledge blocks — one canonical, named knowledge unit (slug + body) edited in a single place
 * and surfaced by reference everywhere (agent prompts, the welcome home, docs). Editing it once bumps
 * the version and re-embeds it, so every surface reflects the latest with no copy-paste drift.
 * See docs/SYNCED_BLOCKS.md. Distinct from kb_entry (auto-captured knowledge).
 */

export type Block = typeof syncedBlock.$inferSelect;
export type Proposal = typeof blockProposal.$inferSelect;

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,60}$/;
const normSlug = (s: string) => (s || "").toLowerCase().trim().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

async function wsIdFor(orgId: string): Promise<string | null> {
  const [ws] = await db.select({ id: workspace.id }).from(workspace).where(eq(workspace.orgId, orgId));
  return ws?.id ?? null;
}

export async function listBlocks(wsId: string): Promise<Block[]> {
  try { ensureKbTables(); return await db.select().from(syncedBlock).where(eq(syncedBlock.workspaceId, wsId)).orderBy(desc(syncedBlock.updatedAt)); } catch { return []; }
}
export async function getBlock(wsId: string, slug: string): Promise<Block | null> {
  try { ensureKbTables(); const [b] = await db.select().from(syncedBlock).where(and(eq(syncedBlock.workspaceId, wsId), eq(syncedBlock.slug, slug))); return b ?? null; } catch { return null; }
}

/** Embed a block's body into rag_chunk (path block/<slug>) so agents also RETRIEVE the current block. */
async function embedBlock(wsId: string, slug: string, title: string, body: string): Promise<void> {
  const path = `block/${slug}`;
  await db.delete(ragChunk).where(and(eq(ragChunk.workspaceId, wsId), eq(ragChunk.path, path)));
  const text = `# ${title || slug}\n${(body || "").trim()}`.slice(0, 6000);
  for (const chunk of chunksOf(text)) {
    const v = await embed(chunk);
    await db.insert(ragChunk).values({ id: uid(), workspaceId: wsId, path, chunk, vector: v ? JSON.stringify(v) : null, obsolete: false });
  }
}

/** Create or update a block (operator or a merged proposal). Bumps version + re-embeds. */
export async function upsertBlock(wsId: string, b: { slug: string; kind?: string; title?: string; body?: string; updatedBy?: string }): Promise<{ ok: boolean; slug: string }> {
  try {
    ensureKbTables();
    const slug = normSlug(b.slug);
    if (!slug || !SLUG_RE.test(slug)) return { ok: false, slug: "" };
    const title = (b.title ?? "").slice(0, 200);
    const body = (b.body ?? "").slice(0, 20000);
    const kind = (b.kind ?? "note").slice(0, 40);
    const updatedBy = (b.updatedBy ?? "operator").slice(0, 60);
    const [cur] = await db.select().from(syncedBlock).where(and(eq(syncedBlock.workspaceId, wsId), eq(syncedBlock.slug, slug)));
    if (cur) {
      await db.update(syncedBlock).set({ kind, title: title || cur.title, body, version: cur.version + 1, updatedBy, updatedAt: new Date() }).where(and(eq(syncedBlock.workspaceId, wsId), eq(syncedBlock.slug, slug)));
    } else {
      await db.insert(syncedBlock).values({ workspaceId: wsId, slug, kind, title: title || slug, body, version: 1, updatedBy });
    }
    await embedBlock(wsId, slug, title || cur?.title || slug, body);
    return { ok: true, slug };
  } catch { return { ok: false, slug: "" }; }
}

export async function deleteBlock(wsId: string, slug: string): Promise<void> {
  try {
    ensureKbTables();
    await db.delete(syncedBlock).where(and(eq(syncedBlock.workspaceId, wsId), eq(syncedBlock.slug, slug)));
    await db.delete(ragChunk).where(and(eq(ragChunk.workspaceId, wsId), eq(ragChunk.path, `block/${slug}`)));
  } catch { /* best-effort */ }
}

/** Replace {{kb:slug}} markers with the block's current body. Missing → a LOUD visible marker. */
export async function resolveBlocks(orgId: string, text: string): Promise<string> {
  if (!text || !text.includes("{{kb:")) return text;
  try {
    const wsId = await wsIdFor(orgId);
    if (!wsId) return text;
    const rows = await db.select({ slug: syncedBlock.slug, body: syncedBlock.body }).from(syncedBlock).where(eq(syncedBlock.workspaceId, wsId));
    const map = new Map(rows.map((r) => [r.slug, r.body]));
    return text.replace(/\{\{kb:([a-z0-9-]+)\}\}/gi, (_m, s) => map.get(String(s).toLowerCase()) ?? `[[missing block: ${s}]]`);
  } catch { return text; }
}

/** Compact "Canonical project facts" block for prompt injection (the active blocks, bounded). */
export async function canonicalFactsSection(wsId: string): Promise<string> {
  try {
    ensureKbTables();
    const rows = await db.select().from(syncedBlock).where(eq(syncedBlock.workspaceId, wsId)).orderBy(desc(syncedBlock.updatedAt)).limit(20);
    if (!rows.length) return "";
    return rows.map((r) => `### ${r.title || r.slug} (${r.kind})\n${(r.body || "").trim().slice(0, 800)}`).join("\n\n").slice(0, 5000);
  } catch { return ""; }
}

/** Seed default blocks from the workspace's canonical fields (idempotent — only if absent + non-empty). */
export async function seedDefaultBlocks(orgId: string): Promise<{ seeded: number }> {
  let seeded = 0;
  try {
    ensureKbTables();
    const [ws] = await db.select().from(workspace).where(eq(workspace.orgId, orgId));
    if (!ws) return { seeded };
    const existing = new Set((await db.select({ slug: syncedBlock.slug }).from(syncedBlock).where(eq(syncedBlock.workspaceId, ws.id))).map((r) => r.slug));
    const stack = Object.entries((ws.stack ?? {}) as Record<string, string>).filter(([, v]) => v && v !== "None").map(([k, v]) => `- **${k}:** ${v}`).join("\n");
    const defaults = [
      { slug: "mission", kind: "mission", title: "Mission", body: ws.mission || "" },
      { slug: "objective", kind: "objective", title: "Objective", body: ws.objective || "" },
      { slug: "official-stack", kind: "stack", title: "Official stack", body: stack },
    ];
    for (const d of defaults) {
      if (existing.has(d.slug) || !d.body.trim()) continue;
      await upsertBlock(ws.id, { ...d, updatedBy: "system" });
      seeded++;
    }
  } catch { /* best-effort */ }
  return { seeded };
}

// The full canonical set the operator action seeds: mission/objective/stack from the workspace, and
// the rest as STARTER placeholders (so they actually get created + show up to be filled in/edited).
const CANONICAL_BLOCKS: { slug: string; kind: string; title: string; starter: string }[] = [
  { slug: "mission", kind: "mission", title: "Mission", starter: "" },
  { slug: "objective", kind: "objective", title: "Objective", starter: "" },
  { slug: "official-stack", kind: "stack", title: "Official stack", starter: "" },
  { slug: "current-architecture", kind: "architecture", title: "Current architecture", starter: "_Describe the system's current shape, modules and data flow — the architecture every agent should treat as canonical._" },
  { slug: "business-rules", kind: "business-rule", title: "Business rules", starter: "_List the domain rules the product must always obey._" },
  { slug: "ui-patterns", kind: "ui-pattern", title: "UI patterns", starter: "_Canonical UI/UX conventions and component patterns._" },
  { slug: "security-patterns", kind: "security", title: "Security patterns", starter: "_Required security practices: auth, secrets, isolation, input validation._" },
  { slug: "deploy-checklist", kind: "deploy-checklist", title: "Deploy checklist", starter: "_Steps that must pass before a deploy._" },
  { slug: "code-review-checklist", kind: "review-checklist", title: "Code review checklist", starter: "_What every review must check before merge._" },
  { slug: "glossary", kind: "glossary", title: "Glossary", starter: "_Shared vocabulary for the project._" },
  { slug: "technical-decisions", kind: "note", title: "Technical decisions", starter: "_The durable “why we chose X” log._" },
];

/** Operator-triggered: ensure the full canonical block set exists. mission/objective/stack come from
 *  the workspace; everything else is created as an editable starter placeholder. Returns how many
 *  were newly created (idempotent — never overwrites an existing block). */
export async function seedCanonicalBlocks(orgId: string): Promise<{ seeded: number }> {
  let seeded = 0;
  try {
    ensureKbTables();
    const [ws] = await db.select().from(workspace).where(eq(workspace.orgId, orgId));
    if (!ws) return { seeded };
    const existing = new Set((await db.select({ slug: syncedBlock.slug }).from(syncedBlock).where(eq(syncedBlock.workspaceId, ws.id))).map((r) => r.slug));
    const stack = Object.entries((ws.stack ?? {}) as Record<string, string>).filter(([, v]) => v && v !== "None").map(([k, v]) => `- **${k}:** ${v}`).join("\n");
    const fromWs: Record<string, string> = { mission: ws.mission || "", objective: ws.objective || "", "official-stack": stack };
    for (const c of CANONICAL_BLOCKS) {
      if (existing.has(c.slug)) continue;
      const body = (fromWs[c.slug] ?? "").trim() || c.starter;
      if (!body) continue;
      await upsertBlock(ws.id, { slug: c.slug, kind: c.kind, title: c.title, body, updatedBy: "system" });
      seeded++;
    }
  } catch { /* best-effort */ }
  return { seeded };
}

/** Seed default blocks across every workspace at boot (idempotent). */
export async function seedDefaultBlocksForExistingWorkspaces(): Promise<{ seeded: number }> {
  let seeded = 0;
  try {
    const wss = await db.select({ orgId: workspace.orgId }).from(workspace);
    for (const ws of wss) seeded += (await seedDefaultBlocks(ws.orgId)).seeded;
  } catch { /* best-effort */ }
  return { seeded };
}

/* ------------------------------------------------------------------ proposals */

/** An agent proposes a block edit → pending queue + Inbox (the operator / KB agent merges or rejects). */
export async function proposeBlockEdit(orgId: string, p: { slug: string; kind?: string; title?: string; body: string; byAgentHandle: string }): Promise<{ ok: boolean }> {
  try {
    ensureKbTables();
    const wsId = await wsIdFor(orgId);
    if (!wsId) return { ok: false };
    const slug = normSlug(p.slug);
    if (!slug || !p.body.trim()) return { ok: false };
    const id = uid();
    await db.insert(blockProposal).values({ id, workspaceId: wsId, slug, kind: (p.kind ?? "note").slice(0, 40), title: (p.title ?? "").slice(0, 200), body: p.body.slice(0, 20000), byAgentHandle: (p.byAgentHandle ?? "").slice(0, 60), status: "pending" });
    await pushInbox(wsId, { kind: "review", refType: "validation", refId: id, fromAgentId: null, title: `Block edit proposed — ${slug}`, detail: `@${p.byAgentHandle} proposed an edit to the “${slug}” knowledge block. Review + merge in Knowledge.`.slice(0, 400) });
    await notifyOps(wsId, { kind: "review", text: `Knowledge block edit proposed — ${slug}`, detail: `by @${p.byAgentHandle}` });
    return { ok: true };
  } catch { return { ok: false }; }
}
export async function listProposals(wsId: string): Promise<Proposal[]> {
  try { ensureKbTables(); return await db.select().from(blockProposal).where(and(eq(blockProposal.workspaceId, wsId), eq(blockProposal.status, "pending"))).orderBy(desc(blockProposal.createdAt)); } catch { return []; }
}
export async function mergeProposal(wsId: string, id: string, by = "operator"): Promise<{ ok: boolean }> {
  try {
    ensureKbTables();
    const [p] = await db.select().from(blockProposal).where(and(eq(blockProposal.workspaceId, wsId), eq(blockProposal.id, id)));
    if (!p || p.status !== "pending") return { ok: false };
    await upsertBlock(wsId, { slug: p.slug, kind: p.kind, title: p.title, body: p.body, updatedBy: p.byAgentHandle || by });
    await db.update(blockProposal).set({ status: "merged", decidedAt: new Date(), decidedBy: by }).where(eq(blockProposal.id, id));
    await resolveInboxFor(wsId, "validation", id);
    return { ok: true };
  } catch { return { ok: false }; }
}
export async function rejectProposal(wsId: string, id: string, by = "operator"): Promise<{ ok: boolean }> {
  try {
    ensureKbTables();
    await db.update(blockProposal).set({ status: "rejected", decidedAt: new Date(), decidedBy: by }).where(and(eq(blockProposal.workspaceId, wsId), eq(blockProposal.id, id)));
    await resolveInboxFor(wsId, "validation", id);
    return { ok: true };
  } catch { return { ok: false }; }
}
