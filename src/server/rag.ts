import "server-only";
import { randomUUID as uid } from "node:crypto";
import { eq, and, like, asc, isNull } from "drizzle-orm";
import { db } from "@/db";
import { ragChunk, workspace, message } from "@/db/schema";
import { listFiles, readWorkspaceFile } from "@/lib/fs-workspace";

/**
 * Org-scoped retrieval over the workspace Markdown. Semantic when a local Ollama
 * embedding model is available; otherwise a keyword heuristic. Strictly isolated:
 * only the active org's workspace files are ever read or returned.
 */
const OLLAMA = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";
const EMBED_MODEL = process.env.CONSTELLA_EMBED_MODEL ?? "nomic-embed-text";
// nomic-embed-text(-v1.5) was trained with ASYMMETRIC task-instruction prefixes and REQUIRES them:
// documents → "search_document: …", queries → "search_query: …". Omitting them silently degrades
// retrieval. We only prefix when the embed model is nomic (other families use different schemes).
const EMBED_IS_NOMIC = /nomic/i.test(EMBED_MODEL);
const nomicPrefix = (text: string, kind: "document" | "query") => `search_${kind}: ${text}`;
// Dedicated local llama.cpp embedding server (the downloaded nomic GGUF) — see local-models.ensureEmbedServer.
const EMBED_URL = process.env.CONSTELLA_EMBED_URL ?? "http://127.0.0.1:8083";
const RAG_DIRS = [".claude", "DOCS", "PO", "Reports", "specs", "issues", "design-skills"];
// Workspaces we've already tried to auto-upgrade to embeddings this process (avoids reindex storms).
const autoReindexed = new Set<string>();

function inRagDirs(p: string): boolean {
  const u = p.replace(/\\/g, "/");
  // Never index internal plumbing — the KB agent's own prompt/taxonomy (.claude/kb) or the agent
  // skill library (.claude/skills). A question would otherwise retrieve + surface these internals.
  if (u.startsWith(".claude/kb/") || u.startsWith(".claude/skills/")) return false;
  // The attached mock/prototype + the Design module's output: index their text files so agents (and the
  // CEO Planner) retrieve the prototype + the approved design as project context.
  if (u.startsWith("mock/") || u.startsWith("design-mock/")) return /\.(md|html?|css|jsx?|tsx?|txt|json)$/i.test(u);
  return u.endsWith(".md") && RAG_DIRS.some((d) => u === `${d}.md` || u.startsWith(`${d}/`));
}

/** Embed text. `kind` matters for nomic-embed-text (asymmetric): index document chunks with
 *  "document" and search queries with "query" — both index AND query sides must use the same model
 *  with the matching prefix, or cosine similarity is meaningless. */
export async function embed(text: string, kind: "document" | "query" = "document"): Promise<number[] | null> {
  // 1) Ollama (if running with an embed model pulled).
  try {
    const res = await fetch(`${OLLAMA}/api/embeddings`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: EMBED_MODEL, prompt: EMBED_IS_NOMIC ? nomicPrefix(text, kind) : text }),
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const j = await res.json();
      if (Array.isArray(j.embedding) && j.embedding.length) return j.embedding as number[];
    }
  } catch { /* fall through to llama.cpp */ }
  // 2) Dedicated local llama.cpp embedding server (the downloaded nomic GGUF) — OpenAI-compatible.
  //    Always nomic here, so always apply the nomic task prefix.
  try {
    const res = await fetch(`${EMBED_URL}/v1/embeddings`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ input: nomicPrefix(text, kind), model: "nomic-embed" }),
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const j = await res.json();
      const v = j?.data?.[0]?.embedding;
      if (Array.isArray(v) && v.length) return v as number[];
    }
  } catch { /* no embedding backend → caller falls back to keyword heuristic */ }
  return null;
}

export function chunksOf(md: string): string[] {
  const parts = md.split(/\n(?=#{1,3}\s)/).map((s) => s.trim()).filter(Boolean);
  const out: string[] = [];
  for (const p of parts.length ? parts : [md]) {
    if (!p) continue;
    if (p.length <= 1200) out.push(p);
    else for (let i = 0; i < p.length; i += 1200) out.push(p.slice(i, i + 1200));
  }
  return out.slice(0, 40);
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

/** Build/refresh the per-org embedding index over workspace .md AND the chat (best-effort). */
export async function indexRag(orgId: string): Promise<{ ok: boolean; chunks: number; embedded: boolean }> {
  const [ws] = await db.select().from(workspace).where(eq(workspace.orgId, orgId));
  if (!ws) return { ok: false, chunks: 0, embedded: false };
  const files = listFiles(orgId).filter(inRagDirs);
  // Refresh ONLY non-KB chunks (file + chat both have a null kbEntryId). Curated KB-entry chunks (kbEntryId
  // set, path kb/<type>/<id>) are owned + embedded by the Knowledge layer and must survive a file/chat
  // reindex — a blanket delete here wiped them, emptying curated KB retrieval until every entry was re-ingested.
  await db.delete(ragChunk).where(and(eq(ragChunk.workspaceId, ws.id), isNull(ragChunk.kbEntryId)));
  let n = 0, embedded = false;
  for (const path of files) {
    const md = readWorkspaceFile(orgId, path) ?? "";
    for (const chunk of chunksOf(md)) {
      const v = await embed(chunk);
      if (v) embedded = true;
      await db.insert(ragChunk).values({ id: uid(), workspaceId: ws.id, path, chunk, vector: v ? JSON.stringify(v) : null });
      n++;
    }
  }
  // Also embed the conversations so agents recall what was discussed (team room, DMs, Telegram).
  n += await indexChat(orgId);
  return { ok: true, chunks: n, embedded };
}

/** Index the CHAT into RAG: embed the team-room, DM and Telegram conversations so any agent can
 *  recall what was decided/asked, not just the docs. Owned by the Knowledge agent (@vannevar).
 *  Refreshes ONLY the `chat/<channel>` chunks (file chunks are left intact). Returns chunks written. */
export async function indexChat(orgId: string): Promise<number> {
  const [ws] = await db.select().from(workspace).where(eq(workspace.orgId, orgId));
  if (!ws) return 0;
  await db.delete(ragChunk).where(and(eq(ragChunk.workspaceId, ws.id), like(ragChunk.path, "chat/%")));
  const msgs = await db.select().from(message).where(eq(message.workspaceId, ws.id)).orderBy(asc(message.createdAt));
  // Group into a transcript per channel (room · dm:<handle> · telegram).
  const byChannel = new Map<string, string[]>();
  for (const m of msgs) {
    const text = (m.text ?? "").replace(/\s+/g, " ").trim();
    if (!text) continue;
    const who = m.fromKind === "operator" ? "Operator" : "@" + (m.fromHandle ?? "agent");
    let arr = byChannel.get(m.channel);
    if (!arr) { arr = []; byChannel.set(m.channel, arr); }
    arr.push(`${who}: ${text}`);
  }
  let n = 0;
  for (const [channel, lines] of byChannel) {
    // Newest conversation matters most + keeps the index bounded — embed the tail of each channel.
    const transcript = lines.slice(-400).join("\n");
    for (const chunk of chunksOf(transcript)) {
      const v = await embed(chunk);
      await db.insert(ragChunk).values({ id: uid(), workspaceId: ws.id, path: `chat/${channel}`, chunk, vector: v ? JSON.stringify(v) : null });
      n++;
    }
  }
  return n;
}

// Debounced per-org chat re-index — chat is chatty, so coalesce a burst of new messages into one
// re-embed. Fire-and-forget; called after a message is posted to any channel.
const chatTimers = new Map<string, ReturnType<typeof setTimeout>>();
export function scheduleChatReindex(orgId: string): void {
  const prev = chatTimers.get(orgId);
  if (prev) clearTimeout(prev);
  chatTimers.set(orgId, setTimeout(() => { chatTimers.delete(orgId); void indexChat(orgId).catch(() => {}); }, 6000));
}

/** Incrementally (re)index ONE workspace file's chunks — re-embed just this path, not the whole
 *  workspace. Used by the file-watcher so RAG stays current automatically as files change. Best-effort:
 *  if the embed server is down, chunks are stored without vectors (keyword fallback) and the lazy
 *  reindex upgrades them once it's up. No-op for non-RAG files. */
export async function indexRagFile(orgId: string, rel: string): Promise<void> {
  if (!inRagDirs(rel)) return;
  const [ws] = await db.select().from(workspace).where(eq(workspace.orgId, orgId));
  if (!ws) return;
  await db.delete(ragChunk).where(and(eq(ragChunk.workspaceId, ws.id), eq(ragChunk.path, rel)));
  const md = readWorkspaceFile(orgId, rel) ?? "";
  for (const chunk of chunksOf(md)) {
    const v = await embed(chunk);
    await db.insert(ragChunk).values({ id: uid(), workspaceId: ws.id, path: rel, chunk, vector: v ? JSON.stringify(v) : null });
  }
}

/** Drop a deleted file's chunks from the index (disk is truth). No-op for non-RAG files. */
export async function deindexRagFile(orgId: string, rel: string): Promise<void> {
  if (!inRagDirs(rel)) return;
  const [ws] = await db.select().from(workspace).where(eq(workspace.orgId, orgId));
  if (ws) await db.delete(ragChunk).where(and(eq(ragChunk.workspaceId, ws.id), eq(ragChunk.path, rel)));
}

// Debounce per (org,file) so a burst of edits to the same file triggers a single re-embed.
const ragTimers = new Map<string, ReturnType<typeof setTimeout>>();
/** Schedule a debounced incremental RAG re-index for a changed file (the watcher's hook). No-op for
 *  non-RAG files. Fire-and-forget — keeps the workspace memory current with no manual Reindex. */
export function scheduleRagReindex(orgId: string, rel: string): void {
  if (!inRagDirs(rel)) return;
  const key = orgId + "::" + rel;
  const prev = ragTimers.get(key);
  if (prev) clearTimeout(prev);
  ragTimers.set(key, setTimeout(() => { ragTimers.delete(key); void indexRagFile(orgId, rel).catch(() => {}); }, 2500));
}

/** Retrieve org-scoped context for a query. Semantic (Ollama) → keyword heuristic fallback. */
export async function retrieve(orgId: string, query: string, k = 5): Promise<{ context: string; sources: string[]; mode: "semantic" | "heuristic" | "none" }> {
  const [ws] = await db.select().from(workspace).where(eq(workspace.orgId, orgId));
  if (!ws) return { context: "", sources: [], mode: "none" };
  let rows = await db.select().from(ragChunk).where(eq(ragChunk.workspaceId, ws.id));
  if (rows.length === 0) { await indexRag(orgId); rows = await db.select().from(ragChunk).where(eq(ragChunk.workspaceId, ws.id)); }
  if (rows.length === 0) return { context: "", sources: [], mode: "none" };

  let top: typeof rows = [];
  let mode: "semantic" | "heuristic" = "heuristic";
  const qv = await embed(query, "query");
  if (qv) {
    let withVec = rows.filter((r) => r.vector);
    // Embeddings just became available (embed server came up) but the index predates it → rebuild
    // ONCE per process so chunks get vectors, then everyone's retrieval is semantic with no manual
    // reindex. The guard stops repeated heavy re-indexing if chunk embedding genuinely fails.
    if (withVec.length === 0 && !autoReindexed.has(ws.id)) {
      autoReindexed.add(ws.id);
      await indexRag(orgId);
      rows = await db.select().from(ragChunk).where(eq(ragChunk.workspaceId, ws.id));
      withVec = rows.filter((r) => r.vector);
    }
    if (withVec.length) {
      top = withVec.map((r) => ({ r, s: cosine(qv, JSON.parse(r.vector!)) })).sort((a, b) => b.s - a.s).slice(0, k).map((x) => x.r);
      mode = "semantic";
    }
  }
  if (top.length === 0) {
    const terms = query.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
    const scored = rows.map((r) => {
      const t = r.chunk.toLowerCase();
      return { r, s: terms.reduce((acc, w) => acc + (t.includes(w) ? 1 : 0), 0) };
    }).sort((a, b) => b.s - a.s);
    top = scored.filter((x) => x.s > 0).slice(0, k).map((x) => x.r);
    if (top.length === 0) top = rows.slice(0, Math.min(k, 3));
  }
  const sources = [...new Set(top.map((r) => r.path))];
  const context = top.map((r) => `# ${r.path}\n${r.chunk}`).join("\n\n").slice(0, 4000);
  return { context, sources, mode };
}
