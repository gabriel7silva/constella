import "server-only";
import { randomUUID as uid, createHash } from "node:crypto";
import { eq, and, inArray, desc, gte, sum } from "drizzle-orm";
import { db, sqlite } from "@/db";
import { kbEntry, kbQueryLog, ragChunk, workspace, agent, costEntry, goal, spec, issue, goalFile, syncedBlock, skill } from "@/db/schema";
import { embed, chunksOf, cosine, indexRag, indexChat } from "@/server/rag";
import { runAgent, pickBinary, type CliResult } from "@/server/adapters/cli";
import { runHttpStream } from "@/server/adapters/http";
import { llamaServerStatus } from "@/server/local-models";
import { writeWorkspaceFile } from "@/lib/fs-workspace";
import { writeDoc } from "@/lib/workspace-doc";
import { notifyOps } from "@/lib/notify";
import { scrubSecrets } from "@/lib/scrub";
import { KB_AGENT_PROMPT, KB_IDENTITY, KB_RITUAL, KB_TAXONOMY_MD } from "@/data/kb-prompt";

/**
 * The Knowledge Base engine — the curated, classified, state-aware layer the Knowledge agent
 * (Vannevar) owns on top of the raw RAG store. See docs/KB_RAG.md + docs/KB_AGENT.md.
 *
 *  - ingestKnowledge(): deterministic capture (no LLM) — classify, dedup by content hash,
 *    update-in-place on the same source, upsert a kb_entry, and emit its rag_chunk(s) for retrieval.
 *  - kbQuery(): state-aware retrieval — drops obsolete/superseded (and cancelled/archived) knowledge,
 *    prioritizes recency, returns internal references + an explicit "insufficient knowledge" signal,
 *    and logs the consultation.
 *  - ensureKbTables(): idempotent, migration-free DDL run once at boot.
 *
 * Everything is best-effort — KB capture must never break a task run, so callers fire-and-forget.
 */

// The knowledge taxonomy (must match docs/KB_RAG.md). `note` is the catch-all.
export type KbType =
  | "decision" | "spec" | "issue" | "goal" | "plan" | "architecture" | "business-rule"
  | "code-change" | "dependency" | "integration" | "bug" | "fix" | "test" | "review"
  | "vuln" | "doc" | "user-context" | "history" | "command" | "file-structure"
  | "ui-pattern" | "stack" | "env-config" | "note";

export type KbItem = {
  type: KbType;
  title: string;
  body?: string;
  summary?: string;
  goalId?: string | null;
  specId?: string | null;
  issueId?: string | null;
  taskId?: string | null;
  module?: string;
  paths?: string[];
  agentHandle?: string;
  sourceKind: string;   // task | goal | review | test | decision | spec | issue | note | chat
  sourceRef: string;    // origin id/key (jump-back); the dedup key together with type+sourceKind
  confidence?: number;  // 0..100
};

// Agents self-capture learnings by emitting "[[REMEMBER type=<t>: <fact>]]" — shared by the task
// runner + chat replies. Valid types (else → "note"); the token is parsed out and the text stripped.
const KB_LEARN_TYPES = new Set(["decision", "architecture", "business-rule", "integration", "dependency", "bug", "fix", "test", "review", "vuln", "ui-pattern", "stack", "env-config", "command", "note"]);
const REMEMBER_RE = /\[\[REMEMBER(?:\s+type=([a-z-]+))?\s*:?\s*([\s\S]*?)\]\]/gi;

/** Stable short hash (djb2) of a fact → a positional-independent sourceRef key so re-emitting learnings in a
 *  different order updates entries in place instead of duplicating them. */
function kbRefHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/** Pull agent-emitted "[[REMEMBER …]]" learnings from a reply → typed KB items to ingest + the text
 *  with the tokens stripped. */
export function extractRemembered(text: string, ctx: { agentHandle?: string; goalId?: string | null; issueId?: string | null; taskId?: string | null; sourceKind: string; sourceRef: string }): { items: KbItem[]; stripped: string } {
  const items: KbItem[] = [];
  for (const m of text.matchAll(REMEMBER_RE)) {
    const ty = (m[1] && KB_LEARN_TYPES.has(m[1]) ? m[1] : "note") as KbType;
    const fact = m[2].trim();
    // sourceRef keyed on the FACT's content hash (not the running index) — a re-run that reorders/drops
    // [[REMEMBER]] tokens would otherwise shift indices and re-insert the same fact as a new KB entry.
    if (fact.length >= 8) items.push({ type: ty, title: fact.split("\n")[0].slice(0, 80), summary: fact.slice(0, 1200), goalId: ctx.goalId ?? null, issueId: ctx.issueId ?? null, taskId: ctx.taskId ?? null, agentHandle: ctx.agentHandle, sourceKind: ctx.sourceKind, sourceRef: `${ctx.sourceRef}:${kbRefHash(ty + "|" + fact)}` });
  }
  const stripped = text.replace(REMEMBER_RE, "").replace(/\n{3,}/g, "\n\n").trim();
  return { items, stripped };
}

// Agents explicitly CONSULT the KB before acting by emitting "[[CONSULT: <question>]]" — the system
// answers each from the state-aware KB and posts it back into the thread (so the answer is in context
// on the agent's next turn). The complement to [[REMEMBER]]: producer (SEND) + consumer (CONSULT).
const CONSULT_RE = /\[\[CONSULT:\s*([\s\S]*?)\]\]/gi;

/** Resolve agent-emitted "[[CONSULT: …]]" before-action queries against the KB. Returns each
 *  answer + the text with the tokens stripped. Best-effort; a failed query is skipped. */
export async function answerConsults(orgId: string, text: string, agentHandle?: string): Promise<{ answers: { q: string; a: string; sources: string[] }[]; stripped: string }> {
  const answers: { q: string; a: string; sources: string[] }[] = [];
  for (const m of text.matchAll(CONSULT_RE)) {
    const q = m[1].trim();
    if (q.length < 4) continue;
    try {
      const r = await kbQuery(orgId, q, { agentHandle, k: 6 });
      answers.push({ q, a: r.context?.trim() ? r.context : "(no relevant knowledge in the KB yet)", sources: r.sources ?? [] });
    } catch { /* best-effort */ }
  }
  const stripped = text.replace(CONSULT_RE, "").replace(/\n{3,}/g, "\n\n").trim();
  return { answers, stripped };
}

// Agent-invokable KB maintenance tools: "[[KB: reindex|index-chat|health]]" — the Knowledge agent (or
// any agent) can trigger an explicit reindex / chat re-index / embed-server health check mid-run.
const KB_TOOL_RE = /\[\[KB:\s*([a-z-]+)\s*\]\]/gi;

/** Run agent-emitted "[[KB: <tool>]]" maintenance calls. Returns a short status line per call + the
 *  text with the tokens stripped. Best-effort; an unknown/failed tool is skipped. */
export async function runKbTools(orgId: string, text: string): Promise<{ results: string[]; stripped: string }> {
  const results: string[] = [];
  for (const m of text.matchAll(KB_TOOL_RE)) {
    const verb = m[1].toLowerCase();
    try {
      if (verb === "reindex") { const r = await indexRag(orgId); results.push(`reindex → ${r.chunks} chunk(s)${r.embedded ? " (semantic)" : ""}`); }
      else if (verb === "index-chat" || verb === "indexchat") { const n = await indexChat(orgId); results.push(`index-chat → ${n} chunk(s)`); }
      else if (verb === "health") { const s = await llamaServerStatus(); results.push(`embed health → ${s.up ? `up${s.model ? ` (${s.model})` : ""}` : "down"}`); }
    } catch { /* best-effort */ }
  }
  const stripped = text.replace(KB_TOOL_RE, "").replace(/\n{3,}/g, "\n\n").trim();
  return { results, stripped };
}

let tablesEnsured = false;
/** Create the KB tables + the rag_chunk KB columns if missing. Idempotent; safe every boot. */
export function ensureKbTables(): void {
  if (tablesEnsured) return;
  tablesEnsured = true;
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS kb_entry (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
      type TEXT NOT NULL DEFAULT 'note',
      title TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      goal_id TEXT,
      spec_id TEXT,
      issue_id TEXT,
      task_id TEXT,
      module TEXT NOT NULL DEFAULT '',
      paths TEXT,
      agent_handle TEXT NOT NULL DEFAULT '',
      source_kind TEXT NOT NULL DEFAULT '',
      source_ref TEXT NOT NULL DEFAULT '',
      supersedes_id TEXT,
      hash TEXT NOT NULL DEFAULT '',
      confidence INTEGER NOT NULL DEFAULT 70,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS kb_ws_type_idx ON kb_entry (workspace_id, type);
    CREATE INDEX IF NOT EXISTS kb_ws_goal_idx ON kb_entry (workspace_id, goal_id);
    CREATE TABLE IF NOT EXISTS kb_query_log (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
      agent_handle TEXT NOT NULL DEFAULT '',
      query TEXT NOT NULL DEFAULT '',
      hits INTEGER NOT NULL DEFAULT 0,
      mode TEXT NOT NULL DEFAULT '',
      refs TEXT,
      answered_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS kb_query_ws_idx ON kb_query_log (workspace_id, answered_at);
  `);
  // rag_chunk gained two KB columns — add them to existing DBs (constant DEFAULT → clean ADD COLUMN).
  const cols = new Set((sqlite.prepare("PRAGMA table_info(rag_chunk)").all() as { name: string }[]).map((c) => c.name));
  if (!cols.has("kb_entry_id")) sqlite.exec("ALTER TABLE rag_chunk ADD COLUMN kb_entry_id TEXT");
  if (!cols.has("obsolete")) sqlite.exec("ALTER TABLE rag_chunk ADD COLUMN obsolete INTEGER NOT NULL DEFAULT 0");
  // message.task_id — Team Room traceability chip (additive nullable col).
  const mcols = new Set((sqlite.prepare("PRAGMA table_info(message)").all() as { name: string }[]).map((c) => c.name));
  if (!mcols.has("task_id")) sqlite.exec("ALTER TABLE message ADD COLUMN task_id TEXT");
  if (!mcols.has("kind")) sqlite.exec("ALTER TABLE message ADD COLUMN kind TEXT"); // structured KB card render hint
  if (!mcols.has("blocks")) sqlite.exec("ALTER TABLE message ADD COLUMN blocks TEXT"); // synced-block slugs a reply touched
  // agent_skill.auto — distinguishes system-managed stack/role links (reconcilable) from operator
  // hand-toggles. Existing rows default to 1 (managed) so the first boot reconcile can prune the old
  // "all skills linked to everyone" down to each agent's role profile. (constant DEFAULT → clean ADD.)
  const ascols = new Set((sqlite.prepare("PRAGMA table_info(agent_skill)").all() as { name: string }[]).map((c) => c.name));
  if (!ascols.has("auto")) sqlite.exec("ALTER TABLE agent_skill ADD COLUMN auto INTEGER NOT NULL DEFAULT 1");
  // skill.proposed_role — the team role a Vannevar-proposed skill targets (P3 learning→skills).
  const skcols = new Set((sqlite.prepare("PRAGMA table_info(skill)").all() as { name: string }[]).map((c) => c.name));
  if (!skcols.has("proposed_role")) sqlite.exec("ALTER TABLE skill ADD COLUMN proposed_role TEXT");
  // cost_entry.channel — tags spend with its chat channel so the context donut shows real per-agent $ for
  // that conversation (room/dm:<h>/telegram/design). Null for non-chat runs. (nullable → clean ADD COLUMN.)
  const cecols = new Set((sqlite.prepare("PRAGMA table_info(cost_entry)").all() as { name: string }[]).map((c) => c.name));
  if (!cecols.has("channel")) sqlite.exec("ALTER TABLE cost_entry ADD COLUMN channel TEXT");
  // notification_pref.reduced_motion — persists the operator's reduce-motion preference in the DB
  // (cookie is still the fast path; DB is the durable source). Constant DEFAULT 0 → clean ADD COLUMN.
  const npcols = new Set((sqlite.prepare("PRAGMA table_info(notification_pref)").all() as { name: string }[]).map((c) => c.name));
  if (!npcols.has("reduced_motion")) sqlite.exec("ALTER TABLE notification_pref ADD COLUMN reduced_motion INTEGER NOT NULL DEFAULT 0");
  // file_lock — per-file lock for safe parallel agents (Phase 14).
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS file_lock (
      workspace_id TEXT NOT NULL,
      path TEXT NOT NULL,
      task_id TEXT NOT NULL DEFAULT '',
      agent_id TEXT NOT NULL DEFAULT '',
      agent_handle TEXT NOT NULL DEFAULT '',
      acquired_at INTEGER NOT NULL DEFAULT (unixepoch()),
      heartbeat_at INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (workspace_id, path)
    );
  `);
  // synced_block + block_proposal — canonical knowledge blocks + their proposal queue.
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS synced_block (
      workspace_id TEXT NOT NULL,
      slug TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'note',
      title TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL DEFAULT '',
      version INTEGER NOT NULL DEFAULT 1,
      updated_by TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (workspace_id, slug)
    );
    CREATE TABLE IF NOT EXISTS block_proposal (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      slug TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'note',
      title TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL DEFAULT '',
      by_agent_handle TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      decided_at INTEGER,
      decided_by TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS block_prop_ws_idx ON block_proposal (workspace_id, status);
  `);
}

const hashOf = (parts: string[]) => createHash("sha256").update(parts.join("\n")).digest("hex");
const kbPath = (type: string, id: string) => `kb/${type}/${id}`;

async function wsIdFor(orgId: string): Promise<string | null> {
  const [ws] = await db.select({ id: workspace.id }).from(workspace).where(eq(workspace.orgId, orgId));
  return ws?.id ?? null;
}

/** Re-emit a kb_entry's rag_chunk(s): drop the old ones for its path, embed the fresh content. */
async function embedEntry(wsId: string, e: { id: string; type: string; title: string; summary: string; body: string }): Promise<void> {
  const path = kbPath(e.type, e.id);
  await db.delete(ragChunk).where(and(eq(ragChunk.workspaceId, wsId), eq(ragChunk.path, path)));
  const text = `# ${e.title}\n${(e.summary || e.body || "").trim()}`.slice(0, 6000);
  for (const chunk of chunksOf(text)) {
    const v = await embed(chunk);
    await db.insert(ragChunk).values({
      id: uid(), workspaceId: wsId, path, chunk, vector: v ? JSON.stringify(v) : null,
      kbEntryId: e.id, obsolete: false,
    });
  }
}

/**
 * Capture reusable knowledge into the KB (deterministic — no LLM on the hot path). For each item:
 * classify (caller-provided type), dedup by content hash (identical → touch + skip), update-in-place
 * on the same origin slot (type + sourceKind + sourceRef), else insert a new entry; then (re)embed it.
 * Fire-and-forget from callers. Returns how many entries were created/updated.
 */
export async function ingestKnowledge(orgId: string, items: KbItem[]): Promise<{ ingested: number }> {
  if (!items.length) return { ingested: 0 };
  let wsId: string | null = null;
  try { ensureKbTables(); wsId = await wsIdFor(orgId); } catch { return { ingested: 0 }; }
  if (!wsId) return { ingested: 0 };
  let ingested = 0;
  for (const it of items) {
    const title = (it.title || "").trim().slice(0, 200);
    if (!title) continue;
    const summary = (it.summary || "").trim().slice(0, 1200);
    const body = (it.body || "").trim().slice(0, 8000);
    // Content-policy gate: never index a learning that carries a secret shape (API key, token, PEM,
    // bearer, DB URL with creds…). If scrubbing changes the text, a secret was present → refuse it.
    const blob = `${title}\n${summary}\n${body}`;
    if (scrubSecrets(blob) !== blob) { console.warn(`[kb] refused to ingest secret-shaped content (type=${it.type}, source=${it.sourceKind})`); continue; }
    const hash = hashOf([it.type, title, summary || body]);
    try {
      // Identical content already stored → just touch updatedAt, no churn.
      const [dup] = await db.select({ id: kbEntry.id }).from(kbEntry)
        .where(and(eq(kbEntry.workspaceId, wsId), eq(kbEntry.hash, hash))).limit(1);
      if (dup) { await db.update(kbEntry).set({ updatedAt: new Date() }).where(eq(kbEntry.id, dup.id)); continue; }

      // Same origin slot (type + source) → this is an UPDATE of that knowledge: rewrite in place.
      const [existing] = it.sourceRef
        ? await db.select({ id: kbEntry.id }).from(kbEntry).where(and(
            eq(kbEntry.workspaceId, wsId), eq(kbEntry.type, it.type),
            eq(kbEntry.sourceKind, it.sourceKind), eq(kbEntry.sourceRef, it.sourceRef),
          )).limit(1)
        : [];

      const fields = {
        type: it.type, title, summary, body, status: "active" as const,
        goalId: it.goalId ?? null, specId: it.specId ?? null, issueId: it.issueId ?? null, taskId: it.taskId ?? null,
        module: (it.module || "").slice(0, 120), paths: it.paths?.length ? it.paths.slice(0, 40) : null,
        agentHandle: (it.agentHandle || "").slice(0, 60), sourceKind: it.sourceKind, sourceRef: it.sourceRef,
        hash, confidence: Math.max(0, Math.min(100, it.confidence ?? 70)),
      };

      const id = existing?.id ?? uid();
      if (existing) await db.update(kbEntry).set({ ...fields, updatedAt: new Date() }).where(eq(kbEntry.id, id));
      else await db.insert(kbEntry).values({ id, workspaceId: wsId, ...fields });
      await embedEntry(wsId, { id, type: it.type, title, summary, body });
      ingested++;
    } catch { /* best-effort: one bad item never aborts the batch */ }
  }
  if (ingested) scheduleKbCuration(orgId); // periodic Vannevar curation (debounced + cooldown + cap-gated)
  return { ingested };
}

export type KbRef = { kind: string; ref: string };
export type KbAnswer = { context: string; sources: string[]; refs: KbRef[]; mode: "semantic" | "heuristic" | "none"; sufficient: boolean };

/**
 * State-aware KB retrieval. Like rag.retrieve, but excludes obsolete chunks (superseded/obsolete
 * entries + cancelled/archived goals are flagged obsolete=1), returns internal references from the
 * matched kb_entries, signals when knowledge is insufficient, and logs the consultation.
 */
export async function kbQuery(orgId: string, query: string, opts: { agentHandle?: string; k?: number } = {}): Promise<KbAnswer> {
  const k = opts.k ?? 6;
  const empty: KbAnswer = { context: "", sources: [], refs: [], mode: "none", sufficient: false };
  let wsId: string | null = null;
  try { ensureKbTables(); wsId = await wsIdFor(orgId); } catch { return empty; }
  if (!wsId) return empty;

  // Only ACTIVE knowledge: obsolete=0 covers superseded/obsolete KB entries + cancelled/archived goals.
  const sel = () => db.select().from(ragChunk).where(and(eq(ragChunk.workspaceId, wsId!), eq(ragChunk.obsolete, false)));
  let rows = await sel();
  // First run / empty index → build it once (file + chat chunks), then re-query (mirrors rag.retrieve).
  if (rows.length === 0) { try { await indexRag(orgId); } catch { /* embed server may be down */ } rows = await sel(); }
  if (rows.length === 0) return logQuery(wsId, query, opts.agentHandle, empty);

  let top: typeof rows = [];
  let mode: "semantic" | "heuristic" = "heuristic";
  const qv = await embed(query, "query");
  if (qv) {
    const withVec = rows.filter((r) => r.vector);
    if (withVec.length) {
      top = withVec.map((r) => ({ r, s: cosine(qv, JSON.parse(r.vector!)) })).sort((a, b) => b.s - a.s).slice(0, k).map((x) => x.r);
      mode = "semantic";
    }
  }
  if (top.length === 0) {
    const terms = query.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
    top = rows.map((r) => ({ r, s: terms.reduce((acc, w) => acc + (r.chunk.toLowerCase().includes(w) ? 1 : 0), 0) }))
      .sort((a, b) => b.s - a.s).filter((x) => x.s > 0).slice(0, k).map((x) => x.r);
  }
  if (top.length === 0) return logQuery(wsId, query, opts.agentHandle, { ...empty, mode });

  const sources = [...new Set(top.map((r) => r.path))];
  const context = top.map((r) => `# ${r.path}\n${r.chunk}`).join("\n\n").slice(0, 4000);
  // Internal references from the matched KB entries (file:/SPEC:/issue:/goal: jump-backs).
  const refs = await refsFor(wsId, top.map((r) => r.kbEntryId).filter((x): x is string => !!x));
  const ans: KbAnswer = { context, sources, refs, mode, sufficient: true };
  return logQuery(wsId, query, opts.agentHandle, ans);
}

/** Build internal references (spec/issue/goal/file) from the matched kb_entries. */
async function refsFor(wsId: string, kbEntryIds: string[]): Promise<KbRef[]> {
  if (!kbEntryIds.length) return [];
  const entries = await db.select().from(kbEntry).where(and(eq(kbEntry.workspaceId, wsId), inArray(kbEntry.id, [...new Set(kbEntryIds)])));
  const refs: KbRef[] = [];
  const seen = new Set<string>();
  const add = (kind: string, ref: string) => { const key = `${kind}:${ref}`; if (ref && !seen.has(key)) { seen.add(key); refs.push({ kind, ref }); } };
  for (const e of entries) {
    if (e.specId) add("spec", e.specId);
    if (e.issueId) add("issue", e.issueId);
    if (e.goalId) add("goal", e.goalId);
    if (e.sourceRef) add(e.sourceKind || e.type, e.sourceRef);
    for (const p of e.paths ?? []) add("file", p);
  }
  return refs.slice(0, 20);
}

async function logQuery(wsId: string, query: string, agentHandle: string | undefined, ans: KbAnswer): Promise<KbAnswer> {
  try {
    await db.insert(kbQueryLog).values({
      id: uid(), workspaceId: wsId, agentHandle: (agentHandle || "").slice(0, 60),
      query: query.slice(0, 500), hits: ans.sources.length, mode: ans.mode,
      refs: ans.refs.length ? ans.refs.map((r) => `${r.kind}:${r.ref}`) : null,
    });
  } catch { /* logging is best-effort */ }
  return ans;
}

/* ----------------------------------------------------------- knowledge graph (multi-hop traversal) */

export type RelatedNode = { id: string; type: string; title: string; confidence: number };
export type RelatedKnowledge = { seed: { kind: "goal" | "spec" | "issue"; id: string }; nodes: RelatedNode[]; byType: Record<string, RelatedNode[]> };

/**
 * Multi-hop knowledge graph. From a seed work item (a goal/spec/issue id) walk the `kb_entry` link
 * columns (goalId/specId/issueId + the supersedes chain) up to `hops` hops and return the connected
 * knowledge grouped by type. Decisions are themselves `kb_entry` rows (type="decision"), so this
 * naturally links decisions ↔ specs ↔ issues ↔ prior fixes/reviews/patterns. State-aware (active only).
 */
export async function relatedKnowledge(orgId: string, seed: { goalId?: string; specId?: string; issueId?: string }, hops = 2): Promise<RelatedKnowledge | null> {
  let wsId: string | null = null;
  try { ensureKbTables(); wsId = await wsIdFor(orgId); } catch { return null; }
  if (!wsId) return null;
  const seedId = seed.goalId || seed.specId || seed.issueId;
  if (!seedId) return null;
  const all = await db.select().from(kbEntry).where(and(eq(kbEntry.workspaceId, wsId), eq(kbEntry.status, "active")));
  const byId = new Map(all.map((e) => [e.id, e]));
  const found = new Map<string, (typeof all)[number]>();
  let fGoals = new Set<string>(seed.goalId ? [seed.goalId] : []);
  let fSpecs = new Set<string>(seed.specId ? [seed.specId] : []);
  let fIssues = new Set<string>(seed.issueId ? [seed.issueId] : []);
  for (let h = 0; h < hops; h++) {
    const nGoals = new Set<string>(), nSpecs = new Set<string>(), nIssues = new Set<string>();
    for (const e of all) {
      if (found.has(e.id)) continue;
      if (!((e.goalId && fGoals.has(e.goalId)) || (e.specId && fSpecs.has(e.specId)) || (e.issueId && fIssues.has(e.issueId)))) continue;
      found.set(e.id, e);
      if (e.goalId) nGoals.add(e.goalId);
      if (e.specId) nSpecs.add(e.specId);
      if (e.issueId) nIssues.add(e.issueId);
      if (e.supersedesId && byId.has(e.supersedesId)) found.set(e.supersedesId, byId.get(e.supersedesId)!); // follow the supersedes chain
    }
    fGoals = nGoals; fSpecs = nSpecs; fIssues = nIssues;
    if (!nGoals.size && !nSpecs.size && !nIssues.size) break;
  }
  const nodes: RelatedNode[] = [...found.values()]
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 40)
    .map((e) => ({ id: e.id, type: e.type, title: e.title, confidence: e.confidence }));
  const byType: Record<string, RelatedNode[]> = {};
  for (const n of nodes) (byType[n.type] ??= []).push(n);
  return { seed: { kind: seed.goalId ? "goal" : seed.specId ? "spec" : "issue", id: seedId }, nodes, byType };
}

/**
 * State cascade: when a goal is cancelled/archived, its knowledge must stop surfacing as current.
 * Mark the goal's kb_entries obsolete + flag their rag_chunks obsolete=1 (state-aware retrieval drops
 * them). Idempotent; best-effort. Returns how many entries were retired.
 */
export async function markKbObsoleteForGoal(wsId: string, goalId: string): Promise<number> {
  try {
    ensureKbTables();
    const entries = await db.select({ id: kbEntry.id, type: kbEntry.type }).from(kbEntry)
      .where(and(eq(kbEntry.workspaceId, wsId), eq(kbEntry.goalId, goalId), inArray(kbEntry.status, ["active", "superseded"])));
    if (!entries.length) return 0;
    await db.update(kbEntry).set({ status: "obsolete", updatedAt: new Date() })
      .where(and(eq(kbEntry.workspaceId, wsId), eq(kbEntry.goalId, goalId), inArray(kbEntry.status, ["active", "superseded"])));
    for (const e of entries) {
      await db.update(ragChunk).set({ obsolete: true }).where(and(eq(ragChunk.workspaceId, wsId), eq(ragChunk.path, kbPath(e.type, e.id))));
    }
    return entries.length;
  } catch { return 0; }
}

/** Lightweight KB stats for the (future) visual module / health. */
export async function kbStats(wsId: string): Promise<{ entries: number; active: number; obsolete: number }> {
  try {
    ensureKbTables();
    const rows = await db.select({ status: kbEntry.status }).from(kbEntry).where(eq(kbEntry.workspaceId, wsId));
    return {
      entries: rows.length,
      active: rows.filter((r) => r.status === "active").length,
      obsolete: rows.filter((r) => r.status === "obsolete" || r.status === "superseded").length,
    };
  } catch { return { entries: 0, active: 0, obsolete: 0 }; }
}

export type KbOverview = {
  index: { chunks: number; embedded: number; kbChunks: number; active: number; obsolete: number; dim: number; lastUpdated: number | null; semantic: boolean };
  lifecycle: { active: number; superseded: number; obsolete: number; archived: number };
  byType: { type: string; total: number; active: number }[];
  goals: { id: string; title: string; status: string; specs: number; issues: number; files: number; entries: number }[];
  queries: { agentHandle: string; query: string; hits: number; mode: string; refs: string[]; answeredAt: number | null }[];
  gaps: string[];
  total: number;
};

const topDir = (p: string) => (p || "").replace(/\\/g, "/").split("/")[0] || "";

/** Everything the visual KB module renders: index status, lifecycle, type coverage, the
 *  Goal↔Spec↔Issue↔file relations, recent agent recall, and coverage gaps. */
export async function kbOverview(wsId: string): Promise<KbOverview> {
  ensureKbTables();
  const [entries, chunks, queries, goals, specs, issues, files] = await Promise.all([
    db.select().from(kbEntry).where(eq(kbEntry.workspaceId, wsId)),
    db.select({ path: ragChunk.path, vector: ragChunk.vector, obsolete: ragChunk.obsolete, kbEntryId: ragChunk.kbEntryId, updatedAt: ragChunk.updatedAt }).from(ragChunk).where(eq(ragChunk.workspaceId, wsId)),
    db.select().from(kbQueryLog).where(eq(kbQueryLog.workspaceId, wsId)).orderBy(desc(kbQueryLog.answeredAt)).limit(20),
    db.select({ id: goal.id, title: goal.title, status: goal.status }).from(goal).where(eq(goal.workspaceId, wsId)),
    db.select({ goalId: spec.goalId }).from(spec).where(eq(spec.workspaceId, wsId)),
    db.select({ goalId: issue.goalId }).from(issue).where(eq(issue.workspaceId, wsId)),
    db.select({ goalId: goalFile.goalId, path: goalFile.path }).from(goalFile).where(eq(goalFile.workspaceId, wsId)),
  ]);

  const embeddedChunks = chunks.filter((c) => c.vector);
  let dim = 0;
  try { if (embeddedChunks[0]?.vector) dim = (JSON.parse(embeddedChunks[0].vector) as number[]).length; } catch { dim = 0; }
  const activeChunks = chunks.filter((c) => !c.obsolete).length;
  const lastUpdated = chunks.reduce((m, c) => Math.max(m, c.updatedAt ? new Date(c.updatedAt).getTime() : 0), 0) || null;

  const lifecycle = { active: 0, superseded: 0, obsolete: 0, archived: 0 };
  const typeMap = new Map<string, { total: number; active: number }>();
  const kbModules = new Set<string>();
  for (const e of entries) {
    if (e.status in lifecycle) (lifecycle as Record<string, number>)[e.status]++;
    const t = typeMap.get(e.type) ?? { total: 0, active: 0 };
    t.total++; if (e.status === "active") t.active++;
    typeMap.set(e.type, t);
    if (e.status === "active") for (const p of e.paths ?? []) kbModules.add(topDir(p));
  }
  const byType = [...typeMap.entries()].map(([type, v]) => ({ type, ...v })).sort((a, b) => b.total - a.total);

  const countByGoal = (rows: { goalId: string | null }[]) => {
    const m = new Map<string, number>();
    for (const r of rows) if (r.goalId) m.set(r.goalId, (m.get(r.goalId) ?? 0) + 1);
    return m;
  };
  const specsBy = countByGoal(specs), issuesBy = countByGoal(issues), filesBy = countByGoal(files), entriesBy = countByGoal(entries);
  const rank = (s: string) => (s === "active" ? 0 : s === "done" ? 1 : 2);
  const goalsOut = goals
    .map((g) => ({ id: g.id, title: g.title, status: g.status, specs: specsBy.get(g.id) ?? 0, issues: issuesBy.get(g.id) ?? 0, files: filesBy.get(g.id) ?? 0, entries: entriesBy.get(g.id) ?? 0 }))
    .sort((a, b) => rank(a.status) - rank(b.status) || b.entries - a.entries)
    .slice(0, 14);

  // Coverage gaps: modules (top dir) that have produced files but carry no captured knowledge.
  const codeModules = new Set<string>();
  for (const f of files) { const m = topDir(f.path); if (m) codeModules.add(m); }
  const gaps = [...codeModules].filter((m) => !kbModules.has(m)).slice(0, 20).map((m) => `Module “${m}/” has produced files but no captured knowledge yet`);

  return {
    index: { chunks: chunks.length, embedded: embeddedChunks.length, kbChunks: chunks.filter((c) => c.kbEntryId).length, active: activeChunks, obsolete: chunks.length - activeChunks, dim, lastUpdated, semantic: embeddedChunks.length > 0 },
    lifecycle,
    byType,
    goals: goalsOut,
    queries: queries.map((q) => ({ agentHandle: q.agentHandle, query: q.query, hits: q.hits, mode: q.mode, refs: q.refs ?? [], answeredAt: q.answeredAt ? new Date(q.answeredAt).getTime() : null })),
    gaps,
    total: entries.length,
  };
}

/* ------------------------------------------------------------------ KB answer (curated)

   The single clean answer path for "Ask the KB" (the home central chat + the /kb command). It NEVER
   dumps raw retrieved chunks. Meta/status questions ("how is the KB?") are answered deterministically
   from real stats; content questions get a short model-written answer + a tidy Sources line.            */

const KB_META_RE = /\b(knowledge[ -]?base|base de conhecimento|the kb|kb status|status do kb|what do we (?:already )?know|o que (?:j[áa] )?sabemos|coverage|cobertura|gaps?|lacunas|how is the kb|como est[áa] (?:a|o) (?:base|kb))\b/i;

export type KbReply = { text: string; mode: "overview" | "answer" | "none"; sources?: string[] };

/** Ask the Knowledge Base and get a clean, curated answer (never a raw context dump). The `overview`
 *  mode is the structured KB card (rendered with action buttons); sources are returned separately so
 *  the chat shows them as a collapsible "View sources" rather than pasting them into the text. */
export async function kbAnswer(orgId: string, question: string): Promise<KbReply> {
  let wsId: string | null = null;
  try { ensureKbTables(); wsId = await wsIdFor(orgId); } catch { wsId = null; }

  // Meta / status questions → deterministic curated overview from real numbers (the KB card).
  if (wsId && KB_META_RE.test(question)) {
    try {
      const [ov, blocks] = await Promise.all([
        kbOverview(wsId),
        db.select({ slug: syncedBlock.slug }).from(syncedBlock).where(eq(syncedBlock.workspaceId, wsId)),
      ]);
      return { text: formatKbOverview(ov, blocks.map((b) => b.slug)), mode: "overview", sources: [] };
    } catch { /* fall through to retrieval */ }
  }

  // Content questions → retrieve, then a short model-written answer (no echo of raw context).
  const a = await kbQuery(orgId, question, { agentHandle: "operator", k: 6 });
  if (!a.sufficient || !a.context) {
    return { text: "I don't have enough in the Knowledge Base to answer that yet. It fills in as agents complete work — or run `/reindex` to (re)index the project docs.", mode: "none" };
  }
  const refs = (a.refs.length ? a.refs.map((r) => `${r.kind}:${r.ref}`) : a.sources).slice(0, 6);
  const written = await summarizeWithKbAgent(orgId, question, a.context);
  if (written) return { text: written, mode: "answer", sources: refs };
  // Model unavailable → a short note; the sources render as a collapsible (never the raw dump).
  return { text: "Here's what I found in the Knowledge Base (the writer model is offline — open the sources below for detail).", mode: "answer", sources: refs };
}

/** Deterministic, action-oriented summary of the KB's current state. */
function formatKbOverview(ov: KbOverview, blockSlugs: string[]): string {
  const want = ["mission", "official-stack", "business-rules"];
  const missing = want.filter((s) => !blockSlugs.includes(s));
  const lines: string[] = [];
  lines.push(ov.total > 0
    ? `The Knowledge Base has **${ov.total}** curated entr${ov.total === 1 ? "y" : "ies"}.`
    : `The Knowledge Base layer is still empty — knowledge fills in as agents complete work.`);
  lines.push("");
  lines.push("**What exists**");
  lines.push(`- ${ov.index.chunks} indexed chunk(s) (${ov.index.embedded} embedded · ${ov.index.semantic ? "semantic" : "keyword"} search)`);
  lines.push(`- ${blockSlugs.length} central knowledge block(s)`);
  lines.push(`- ${ov.queries.length} recent quer${ov.queries.length === 1 ? "y" : "ies"}`);
  if (missing.length) {
    lines.push("");
    lines.push("**What's missing**");
    lines.push(`- Central blocks: ${missing.join(", ")} — create them so every agent shares the same canon.`);
  }
  if (ov.gaps.length) {
    lines.push("");
    lines.push("**Coverage gaps**");
    for (const g of ov.gaps.slice(0, 4)) lines.push(`- ${g}`);
  }
  lines.push("");
  lines.push("**Next steps**");
  if (missing.length) lines.push("- Create the missing central blocks in Knowledge.");
  if (ov.total >= 4) lines.push("- Run `/curate` to dedupe and tighten the KB.");
  lines.push("- Ask me a specific question and I'll answer from the indexed knowledge.");
  return lines.join("\n");
}

const LLAMACPP_URL = process.env.LLAMACPP_URL ?? "http://127.0.0.1:8082";

/**
 * RAG generation is the LOCAL model's job. When a local llama.cpp chat server is up (:8082), run the
 * prompt there — free, OpenAI-compatible — so ALL RAG-related LLM work (KB answers + curation) uses the
 * local model instead of a paid provider. Returns null when there's no local server OR it fails/empties,
 * so the caller falls back to the agent's (possibly paid) CLI. Strips <think> blocks (reasoning GGUFs
 * like DeepSeek-R1 distills) so the KB answer is clean.
 */
async function runLocalRag(prompt: string, timeoutMs: number): Promise<CliResult | null> {
  const st = await llamaServerStatus().catch(() => ({ up: false, model: null as string | null }));
  if (!st.up) return null;
  const r = await runHttpStream(prompt, { provider: "openai", baseUrl: `${LLAMACPP_URL}/v1`, apiKey: "", model: st.model || "local" }, { timeoutMs }, () => {}).catch(() => null);
  if (!r || !r.ok || !r.text.trim()) return null;
  r.text = r.text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  r.binary = "local";
  return r;
}

/** Run the Knowledge agent (Vannevar) over retrieved context to WRITE a concise answer. Cost-booked. */
async function summarizeWithKbAgent(orgId: string, question: string, context: string): Promise<string> {
  try {
    const [ws] = await db.select().from(workspace).where(eq(workspace.orgId, orgId));
    if (!ws) return "";
    const agents = await db.select().from(agent).where(eq(agent.workspaceId, ws.id));
    const van = agents.find((a) => a.handle === "vannevar") ?? agents.find((a) => /knowledge/i.test(a.role));
    if (!van || await overCap(van.id, van.dailyCapUsd)) return "";
    const prompt = `You are Vannevar, the Knowledge agent. Answer the operator's question using ONLY the context below.
Be concise and clear — a few sentences or short bullets. Reply in the same language as the question.
Cite the relevant source file/ref names inline when useful. If the context does not contain the answer, say so plainly — do NOT invent.
Do NOT repeat, paste, or echo the raw context; write a real answer.

QUESTION: ${question}

CONTEXT:
${context}`;
    // Prefer the LOCAL model for RAG generation; only fall back to the agent's (possibly paid) CLI.
    let res = await runLocalRag(prompt, 60_000);
    if (!res) { const binary = pickBinary(van.adapter, van.model); res = await runAgent(prompt, { orgId, binary, model: kbModel(binary, van.model), timeoutMs: 60_000 }); }
    if (res.usd > 0 || res.inputTokens + res.outputTokens > 0) {
      await db.insert(costEntry).values({ id: uid(), workspaceId: ws.id, agentId: van.id, provider: res.binary, model: res.model ?? van.model, usd: res.usd, tokens: res.inputTokens + res.outputTokens, at: new Date() });
    }
    return (res.text || "").trim().slice(0, 3500);
  } catch { return ""; }
}

/* ------------------------------------------------------------------ Vannevar */

/** Seed/refresh Vannevar's central KB-Agent prompt into its persona + mirror the taxonomy to disk
 *  (RAG-indexed). Idempotent; runs at boot. Only writes when the systemPrompt actually changed. */
export async function seedKbAgent(): Promise<{ updated: number }> {
  let updated = 0;
  try {
    const wss = await db.select().from(workspace);
    for (const ws of wss) {
      const [van] = await db.select().from(agent).where(and(eq(agent.workspaceId, ws.id), eq(agent.handle, "vannevar")));
      if (!van) continue;
      const cur = (van.persona ?? {}) as { identity?: string; ritual?: string; tone?: string; systemPrompt?: string };
      if (cur.systemPrompt === KB_AGENT_PROMPT) continue;
      await db.update(agent).set({ persona: { ...cur, identity: KB_IDENTITY, ritual: KB_RITUAL, tone: cur.tone ?? "precise", systemPrompt: KB_AGENT_PROMPT } }).where(eq(agent.id, van.id));
      try { writeWorkspaceFile(ws.orgId, ".claude/kb/TAXONOMY.md", KB_TAXONOMY_MD); } catch { /* disk best-effort */ }
      updated++;
    }
  } catch { /* best-effort */ }
  return { updated };
}

/** Within today's spend cap for an agent? (local copy to avoid a runner import cycle). */
async function overCap(agentId: string, cap: number): Promise<boolean> {
  if (!cap) return false;
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const [row] = await db.select({ total: sum(costEntry.usd) }).from(costEntry).where(and(eq(costEntry.agentId, agentId), gte(costEntry.at, start)));
  return Number(row?.total ?? 0) >= cap;
}

function kbModel(binary: string, model: string): string | undefined {
  if (binary === "claude") { const m = (model || "").toLowerCase(); return m.includes("opus") ? "opus" : m.includes("haiku") ? "haiku" : "sonnet"; }
  if (binary === "codex") return undefined;
  return model || undefined;
}

type Curation = {
  merges?: { keep: string; drop: string[] }[];
  obsolete?: string[];
  summaries?: { id: string; summary: string }[];
  gaps?: string[];
};

/**
 * Vannevar's curation run (the LLM half of hybrid ingestion). Over the recent active entries: merge
 * near-duplicates (drops → superseded), retire contradicted/obsolete entries, tighten summaries, and
 * surface coverage gaps → Reports/kb-health.md. Budget-gated, off the hot path, best-effort. The
 * deterministic capture path keeps working even if this never runs.
 */
export async function runKbCuration(orgId: string): Promise<{ ok: boolean; merged: number; retired: number; summarized: number; gaps: number }> {
  const zero = { ok: false, merged: 0, retired: 0, summarized: 0, gaps: 0 };
  try {
    ensureKbTables();
    const [ws] = await db.select().from(workspace).where(eq(workspace.orgId, orgId));
    if (!ws) return zero;
    const agents = await db.select().from(agent).where(eq(agent.workspaceId, ws.id));
    const van = agents.find((a) => a.handle === "vannevar") ?? agents.find((a) => /knowledge/i.test(a.role));
    if (!van) return zero;
    if (await overCap(van.id, van.dailyCapUsd)) return zero;

    const entries = await db.select().from(kbEntry)
      .where(and(eq(kbEntry.workspaceId, ws.id), inArray(kbEntry.status, ["active", "superseded"])))
      .orderBy(desc(kbEntry.updatedAt)).limit(60);
    if (entries.length < 4) return zero; // not enough to be worth a paid run
    const validIds = new Set(entries.map((e) => e.id));
    const compact = entries.map((e) => ({ id: e.id, type: e.type, title: e.title, summary: (e.summary || e.body).slice(0, 300), ref: e.sourceRef, goalId: e.goalId, status: e.status }));

    const prompt = `${KB_AGENT_PROMPT}

## Curate the knowledge base
Below are this workspace's recent KB entries (JSON). Find near-duplicates, contradictions and weak summaries.
Output ONLY a JSON object (no prose, no markdown fences):
{
  "merges":   [{ "keep": "<id>", "drop": ["<id>", ...] }],   // canonical entry to keep + duplicates to supersede
  "obsolete": ["<id>", ...],                                  // entries no longer true / contradicted
  "summaries":[{ "id": "<id>", "summary": "<tighter technical summary>" }],
  "gaps":     ["<short description of missing knowledge>"]
}
Use ONLY ids present below. If nothing needs changing, output {"merges":[],"obsolete":[],"summaries":[],"gaps":[]}.

ENTRIES:
${JSON.stringify(compact)}`;

    // Prefer the LOCAL model for the curation pass too; fall back to the agent's CLI only if it's down.
    let res = await runLocalRag(prompt, 180_000);
    if (!res) { const binary = pickBinary(van.adapter, van.model); res = await runAgent(prompt, { orgId, binary, model: kbModel(binary, van.model), timeoutMs: 180_000 }); }
    if (res.usd > 0 || res.inputTokens + res.outputTokens > 0) {
      await db.insert(costEntry).values({ id: uid(), workspaceId: ws.id, agentId: van.id, provider: res.binary, model: res.model ?? van.model, usd: res.usd, tokens: res.inputTokens + res.outputTokens, at: new Date() });
    }
    let plan: Curation = {};
    const m = res.text.match(/\{[\s\S]*\}/);
    if (m) { try { plan = JSON.parse(m[0]); } catch { plan = {}; } }

    let merged = 0, retired = 0, summarized = 0;
    for (const mg of plan.merges ?? []) {
      if (!validIds.has(mg.keep)) continue;
      for (const d of mg.drop ?? []) {
        if (d === mg.keep || !validIds.has(d)) continue;
        const [e] = await db.select({ type: kbEntry.type }).from(kbEntry).where(eq(kbEntry.id, d));
        if (!e) continue;
        await db.update(kbEntry).set({ status: "superseded", supersedesId: mg.keep, updatedAt: new Date() }).where(eq(kbEntry.id, d));
        await db.update(ragChunk).set({ obsolete: true }).where(and(eq(ragChunk.workspaceId, ws.id), eq(ragChunk.path, kbPath(e.type, d))));
        merged++;
      }
    }
    for (const id of plan.obsolete ?? []) {
      if (!validIds.has(id)) continue;
      const [e] = await db.select({ type: kbEntry.type }).from(kbEntry).where(eq(kbEntry.id, id));
      if (!e) continue;
      await db.update(kbEntry).set({ status: "obsolete", updatedAt: new Date() }).where(eq(kbEntry.id, id));
      await db.update(ragChunk).set({ obsolete: true }).where(and(eq(ragChunk.workspaceId, ws.id), eq(ragChunk.path, kbPath(e.type, id))));
      retired++;
    }
    for (const s of plan.summaries ?? []) {
      if (!validIds.has(s.id) || !s.summary?.trim()) continue;
      const [e] = await db.select().from(kbEntry).where(eq(kbEntry.id, s.id));
      if (!e || e.status !== "active") continue;
      await db.update(kbEntry).set({ summary: s.summary.slice(0, 1200), updatedAt: new Date() }).where(eq(kbEntry.id, s.id));
      await embedEntry(ws.id, { id: e.id, type: e.type, title: e.title, summary: s.summary, body: e.body });
      summarized++;
    }
    const gaps = (plan.gaps ?? []).filter((g) => typeof g === "string" && g.trim()).slice(0, 30);

    // File a KB health report (write-through + indexed → appears in /reports).
    const stats = await kbStats(ws.id);
    const body = `# KB health\n\n_Curated by @${van.handle} · ${stats.active} active · ${stats.obsolete} retired entr(y/ies)_\n\n`
      + `This pass: merged ${merged}, retired ${retired}, re-summarised ${summarized}.\n\n`
      + (gaps.length ? `## Coverage gaps\n${gaps.map((g) => `- ${g}`).join("\n")}\n` : "No coverage gaps reported.\n");
    try { await writeDoc(ws.orgId, "Reports/kb-health.md", body); } catch { /* disk best-effort */ }
    if (merged + retired + summarized + gaps.length > 0) {
      await notifyOps(ws.id, { kind: "report", text: "KB curated", detail: `merged ${merged}, retired ${retired}, re-summarised ${summarized}, ${gaps.length} gap(s).`, agentId: van.id });
    }
    return { ok: res.ok, merged, retired, summarized, gaps: gaps.length };
  } catch { return zero; }
}

/**
 * P3 — learning → skills. Vannevar reads the validated, recurring knowledge the team has accumulated
 * (researched docs, patterns, fixes, decisions) and PROPOSES 0-3 new reusable skills that distill it into
 * repeatable procedures. Each lands as a `provisional` skill (native=false) targeting a role — NOT linked
 * to any agent until the operator APPROVES it in /skills (approveProvisional links it by role). Budget-
 * gated, best-effort; dedups against existing skills. Operator-triggered (or schedulable).
 */
export async function proposeSkillsFromLearnings(orgId: string): Promise<{ ok: boolean; proposed: number }> {
  const zero = { ok: false, proposed: 0 };
  try {
    ensureKbTables();
    const [ws] = await db.select().from(workspace).where(eq(workspace.orgId, orgId));
    if (!ws) return zero;
    const agents = await db.select().from(agent).where(eq(agent.workspaceId, ws.id));
    const van = agents.find((a) => a.handle === "vannevar") ?? agents.find((a) => /knowledge/i.test(a.role));
    if (!van) return zero;
    if (await overCap(van.id, van.dailyCapUsd)) return zero;
    const roles = [...new Set(agents.map((a) => a.role))];

    const REUSABLE = ["doc", "research", "ui-pattern", "stack", "integration", "fix", "decision", "architecture", "business-rule"];
    const entries = await db.select().from(kbEntry)
      .where(and(eq(kbEntry.workspaceId, ws.id), eq(kbEntry.status, "active"), inArray(kbEntry.type, REUSABLE)))
      .orderBy(desc(kbEntry.updatedAt)).limit(50);
    const strong = entries.filter((e) => (e.confidence ?? 70) >= 60);
    if (strong.length < 4) return zero; // not enough validated material to distill

    const existing = new Set((await db.select({ name: skill.name }).from(skill).where(eq(skill.workspaceId, ws.id))).map((s) => s.name.toLowerCase()));
    const compact = strong.slice(0, 40).map((e) => ({ type: e.type, title: e.title, summary: (e.summary || e.body).slice(0, 280), source: e.sourceRef }));
    const prompt = `${KB_AGENT_PROMPT}

## Propose reusable skills from what the team has learned
Below are validated knowledge entries this workspace accumulated (researched docs, patterns, fixes, decisions).
Where the SAME reusable technique/approach recurs and would help FUTURE work, propose a SKILL that distills it
into a repeatable procedure. Propose ONLY genuinely reusable skills — skip one-off facts. 0-3 proposals.

Team roles (pick the best fit, or "all"): ${roles.join(", ")}.
Existing skills (do NOT duplicate these): ${[...existing].slice(0, 120).join(", ")}.

Output ONLY a JSON array (no prose, no markdown fences):
[{"name":"kebab-case-id","role":"<one team role or all>","trigger":"when to use it","summary":"one line","instructions":"the concrete reusable procedure in markdown (4-12 steps), grounded in the learnings + their sources"}]
If nothing is worth proposing, output [].

LEARNINGS:
${JSON.stringify(compact)}`;

    let res = await runLocalRag(prompt, 180_000);
    if (!res) { const binary = pickBinary(van.adapter, van.model); res = await runAgent(prompt, { orgId, binary, model: kbModel(binary, van.model), timeoutMs: 180_000 }); }
    if (res.usd > 0 || res.inputTokens + res.outputTokens > 0) {
      await db.insert(costEntry).values({ id: uid(), workspaceId: ws.id, agentId: van.id, provider: res.binary, model: res.model ?? van.model, usd: res.usd, tokens: res.inputTokens + res.outputTokens, at: new Date() });
    }
    let proposals: { name?: string; role?: string; trigger?: string; summary?: string; instructions?: string }[] = [];
    const m = res.text.match(/\[[\s\S]*\]/);
    if (m) { try { proposals = JSON.parse(m[0]); } catch { proposals = []; } }
    if (!Array.isArray(proposals)) return zero;

    let proposed = 0;
    for (const p of proposals.slice(0, 3)) {
      const name = String(p.name ?? "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
      const instructions = String(p.instructions ?? "").trim();
      if (!name || existing.has(name) || instructions.length < 40) continue;
      const summary = (String(p.summary ?? "").trim() || `Learned skill: ${name}.`).slice(0, 200);
      const trigger = (String(p.trigger ?? "").trim() || `When working on ${name}.`).slice(0, 160);
      const role = roles.find((r) => r.toLowerCase() === String(p.role ?? "").toLowerCase()) ?? null;
      const id = uid();
      await db.insert(skill).values({ id, workspaceId: ws.id, name, summary, trigger, instructions, native: false, provisional: true, indexed: "pending", proposedRole: role });
      try { writeWorkspaceFile(ws.orgId, `.claude/skills/${name}.md`, `# Skill — ${name}\n\n**Trigger:** ${trigger}\n\n${summary}\n\n## Procedure\n${instructions}\n`); } catch { /* disk best-effort */ }
      existing.add(name);
      proposed++;
    }
    if (proposed) await notifyOps(ws.id, { kind: "review", text: `${van.name} proposed ${proposed} new skill${proposed === 1 ? "" : "s"} from learnings`, detail: "Review + approve in /skills.", agentId: van.id });
    return { ok: true, proposed };
  } catch { return zero; }
}

// Debounced + cooldown'd per-org curation trigger. Curation is a paid LLM run, so it coalesces a
// burst of ingests (4 min debounce) and never runs more than once per cooldown window per workspace.
const COOLDOWN_MS = 30 * 60_000;
const curationTimers = new Map<string, ReturnType<typeof setTimeout>>();
const lastCuration = new Map<string, number>();
export function scheduleKbCuration(orgId: string): void {
  if (process.env.CONSTELLA_KB_CURATION === "0") return; // opt-out
  const prev = curationTimers.get(orgId);
  if (prev) clearTimeout(prev);
  curationTimers.set(orgId, setTimeout(() => {
    curationTimers.delete(orgId);
    const last = lastCuration.get(orgId) ?? 0;
    const now = Date.now();
    if (now - last < COOLDOWN_MS) return; // within cooldown → skip this round
    lastCuration.set(orgId, now);
    void runKbCuration(orgId).catch(() => {});
  }, 4 * 60_000));
}
