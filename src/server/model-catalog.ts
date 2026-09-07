import "server-only";
import { mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { constellaHome } from "@/lib/fs-workspace";
import { cliModels } from "@/server/adapters/cli";
import {
  type CatalogModel, type ModelCaps,
  modelsDevKeyForCatalog, fallbackForKey, DEFAULT_PREFERENCE,
} from "@/data/models-dev";

/**
 * Server-side model catalog: fetch + cache models.dev, fetch each connected provider's live model
 * list, intersect/enrich them, and pick a recommended default. No DB writes here (providers.ts owns
 * that) — pure data so it stays reusable from boot/cron/connect.
 *
 * Caching: in-memory + on-disk at <constellaHome>/cache/models-dev.json, ~24h TTL, fail-silent.
 * Offline → stale disk cache → hardcoded FALLBACK_MODELS. The hardcoded list is fallback ONLY.
 */

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MODELSDEV_URL = "https://models.dev/api.json";

type CatalogMap = Record<string, CatalogModel[]>; // keyed by models.dev provider key
let mem: { at: number; data: CatalogMap } | null = null;

function cacheFile(): string { return join(constellaHome(), "cache", "models-dev.json"); }

function readDiskCache(): { at: number; data: CatalogMap } | null {
  try {
    const p = cacheFile();
    if (!existsSync(p)) return null;
    const parsed = JSON.parse(readFileSync(p, "utf8")) as { at?: number; data?: CatalogMap };
    if (!parsed?.data || typeof parsed.data !== "object") return null;
    return { at: Number(parsed.at ?? statSync(p).mtimeMs), data: parsed.data };
  } catch { return null; }
}

function writeDiskCache(data: CatalogMap): void {
  try {
    mkdirSync(join(constellaHome(), "cache"), { recursive: true });
    writeFileSync(cacheFile(), JSON.stringify({ at: Date.now(), data }), "utf8");
  } catch { /* best-effort */ }
}

/** Flatten one models.dev provider entry's `models` map into normalized CatalogModel[]. Defensive:
 *  the upstream shape is trusted but versioned, so every field is optional-guarded. */
function normalizeProvider(modelsObj: unknown): CatalogModel[] {
  if (!modelsObj || typeof modelsObj !== "object") return [];
  const out: CatalogModel[] = [];
  for (const [key, raw] of Object.entries(modelsObj as Record<string, unknown>)) {
    const m = (raw ?? {}) as Record<string, unknown>;
    const rawId = String(m.id ?? key);
    const id = rawId.includes("/") ? rawId.split("/").pop()! : rawId; // bare id → matches /v1/models
    if (!id) continue;
    const modal = (m.modalities ?? {}) as { input?: unknown };
    const input = Array.isArray(modal.input) ? (modal.input as string[]) : [];
    const limit = (m.limit ?? {}) as { context?: unknown; output?: unknown };
    const cost = (m.cost ?? {}) as { input?: unknown; output?: unknown };
    const caps: ModelCaps = {
      reasoning: m.reasoning === true,
      tools: m.tool_call === true,
      vision: m.attachment === true || input.includes("image"),
    };
    out.push({
      id,
      name: String(m.name ?? id),
      context: Number(limit.context ?? 0) || 0,
      outputLimit: Number(limit.output ?? 0) || 0,
      inputCost: Number(cost.input ?? 0) || 0,
      outputCost: Number(cost.output ?? 0) || 0,
      caps,
      released: typeof m.release_date === "string" ? m.release_date : "",
    });
  }
  return out;
}

/** Fetch + parse models.dev into a per-provider-key map. Returns null on any failure (caller falls back). */
async function fetchModelsDev(): Promise<CatalogMap | null> {
  try {
    const r = await fetch(MODELSDEV_URL, { signal: AbortSignal.timeout(10_000), headers: { accept: "application/json" } });
    if (!r.ok) return null;
    const j = (await r.json()) as Record<string, unknown>;
    if (!j || typeof j !== "object") return null;
    const out: CatalogMap = {};
    for (const [key, prov] of Object.entries(j)) {
      const models = (prov as { models?: unknown })?.models;
      const list = normalizeProvider(models);
      if (list.length) out[key] = list;
    }
    return Object.keys(out).length ? out : null;
  } catch { return null; }
}

/** The cached models.dev map (mem → fresh disk → network → stale disk → {}). Never throws. */
async function getCatalogMap(): Promise<CatalogMap> {
  if (mem && Date.now() - mem.at < CACHE_TTL_MS) return mem.data;
  const disk = readDiskCache();
  if (disk && Date.now() - disk.at < CACHE_TTL_MS) { mem = disk; return disk.data; }
  const fresh = await fetchModelsDev();
  if (fresh) { mem = { at: Date.now(), data: fresh }; writeDiskCache(fresh); return fresh; }
  if (disk) { mem = disk; return disk.data; }   // stale-but-present beats nothing
  return {};
}

/** Warm the models.dev cache (boot/cron). Returns the number of providers loaded. */
export async function warmModelsDev(): Promise<number> {
  const map = await getCatalogMap();
  return Object.keys(map).length;
}

/** All models models.dev knows for a Constella catalogId (live cache, else offline fallback). */
export async function modelsForCatalog(catalogId: string): Promise<CatalogModel[]> {
  const key = modelsDevKeyForCatalog(catalogId);
  const map = await getCatalogMap();
  return map[key]?.length ? map[key] : fallbackForKey(key);
}

/* ------------------------------------------------------------------ live per-provider lists */

export type LiveModel = { id: string; name?: string; context?: number; inputCost?: number; outputCost?: number };

async function getJson(url: string, headers: Record<string, string>, timeoutMs = 9_000): Promise<unknown | null> {
  try {
    const r = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

/**
 * The provider's REAL available models, parsed from its own endpoint. Returns:
 *   - LiveModel[] (possibly empty) when the provider has a reachable endpoint, or
 *   - null when there's no endpoint to query (CLI providers) → caller skips the live step.
 * Routers (OpenRouter) return rich rows (pricing + context) we keep verbatim; first-party providers
 * usually return id-only rows that get enriched from models.dev.
 */
export async function liveModels(opts: { catalogId: string; adapter: string; baseUrl?: string; apiKey: string | null }): Promise<LiveModel[] | null> {
  const { catalogId, adapter, baseUrl, apiKey } = opts;
  if (adapter.startsWith("cli_")) {
    // CLIs with a real list command (opencode/aider) → live ids; the rest have no clean list and
    // keep their static options (return null → caller no-ops the cache).
    if (adapter === "cli_opencode") return (await cliModels("opencode")).map((id) => ({ id }));
    if (adapter === "cli_aider") return (await cliModels("aider")).map((id) => ({ id }));
    return null;
  }

  const isOllama = /ollama/i.test(catalogId) || adapter.includes("ollama");
  if (isOllama) {
    const base = (baseUrl || "http://127.0.0.1:11434").replace(/\/$/, "").replace(/\/v1$/, "");
    const j = (await getJson(`${base}/api/tags`, {})) as { models?: { name?: string }[] } | null;
    if (!j) return [];
    return (j.models ?? []).map((m) => ({ id: String(m.name ?? "") })).filter((m) => m.id);
  }

  if (!baseUrl) return null; // no public endpoint → nothing live to fetch

  // Anthropic uses x-api-key; everything else is OpenAI-compatible Bearer auth.
  const base = baseUrl.replace(/\/$/, "");
  const isAnthropic = adapter === "http_anthropic" || catalogId === "anthropic";
  const url = isAnthropic
    ? "https://api.anthropic.com/v1/models"
    : base.endsWith("/models") ? base : base + (base.includes("/v1") ? "/models" : "/v1/models");
  const headers: Record<string, string> = isAnthropic
    ? (apiKey ? { "x-api-key": apiKey, "anthropic-version": "2023-06-01" } : {})
    : (apiKey ? { authorization: `Bearer ${apiKey}` } : {});
  const j = (await getJson(url, headers)) as { data?: unknown[]; models?: unknown[] } | null;
  if (!j) return [];
  const rows = (Array.isArray(j.data) ? j.data : Array.isArray(j.models) ? j.models : []) as Record<string, unknown>[];
  return rows.map((m) => {
    const id = String(m.id ?? m.name ?? "");
    if (!id) return null;
    const out: LiveModel = { id };
    // Anthropic exposes display_name; OpenRouter exposes name + pricing{prompt,completion} (per-token strings) + context_length.
    if (typeof m.display_name === "string") out.name = m.display_name;
    else if (typeof m.name === "string") out.name = m.name;
    if (typeof m.context_length === "number") out.context = m.context_length;
    const pricing = m.pricing as { prompt?: string | number; completion?: string | number } | undefined;
    if (pricing) {
      const pin = Number(pricing.prompt), pout = Number(pricing.completion);
      if (Number.isFinite(pin) && pin > 0) out.inputCost = pin * 1_000_000;   // per-token → per-1M
      if (Number.isFinite(pout) && pout > 0) out.outputCost = pout * 1_000_000;
    }
    return out;
  }).filter((m): m is LiveModel => !!m).slice(0, 200);
}

/* ------------------------------------------------------------------ enrich + default pick */

/** A global bare-id → CatalogModel index across ALL models.dev providers. Lets router/CLI ids
 *  ("anthropic/claude-…", "openai/gpt-…" from OpenRouter/OpenCode/Aider) be enriched even when the
 *  provider's own catalogId has no metadata. Rebuilt from the (cached) map — cheap, no extra network. */
async function globalIndex(): Promise<Map<string, CatalogModel>> {
  const cmap = await getCatalogMap();
  const m = new Map<string, CatalogModel>();
  for (const list of Object.values(cmap)) for (const cm of list) { const k = cm.id.toLowerCase(); if (!m.has(k)) m.set(k, cm); }
  return m;
}

/**
 * Intersect the provider's live ids with models.dev metadata, producing rich CatalogModels. Live rows
 * keep any richer fields they already carry (OpenRouter pricing/context); the rest is filled from the
 * provider's models.dev set, then a global cross-provider index (for router/CLI provider-prefixed ids).
 * When the live list is empty/unavailable, fall back to the full models.dev/offline list for that
 * catalogId so the UI still shows current models.
 */
export async function enrichModels(catalogId: string, live: LiveModel[] | null): Promise<CatalogModel[]> {
  const meta = await modelsForCatalog(catalogId);
  if (!live || live.length === 0) return meta; // no live list → the known catalog for this provider

  const metaById = new Map<string, CatalogModel>();
  for (const m of meta) metaById.set(m.id.toLowerCase(), m);
  const gidx = await globalIndex();
  const lookup = (id: string): CatalogModel | undefined => {
    const lc = id.toLowerCase();
    const bare = id.includes("/") ? id.split("/").pop()!.toLowerCase() : lc;
    return metaById.get(lc) ?? metaById.get(bare) ?? gidx.get(lc) ?? gidx.get(bare);
  };

  const out: CatalogModel[] = [];
  for (const lv of live) {
    const md = lookup(lv.id);
    out.push({
      id: lv.id,
      name: lv.name || md?.name || lv.id,
      context: lv.context ?? md?.context ?? 0,
      outputLimit: md?.outputLimit ?? 0,
      inputCost: lv.inputCost ?? md?.inputCost ?? 0,
      outputCost: lv.outputCost ?? md?.outputCost ?? 0,
      caps: md?.caps ?? { reasoning: false, tools: false, vision: false },
      released: md?.released ?? "",
    });
  }
  return out;
}

/** Pick the recommended default model id: curated preference first, then newest by release date. */
export function defaultModelFor(catalogId: string, models: CatalogModel[]): string {
  if (!models.length) return "";
  const key = modelsDevKeyForCatalog(catalogId);
  const prefs = DEFAULT_PREFERENCE[key];
  if (prefs) {
    for (const pref of prefs) {
      const matches = models.filter((m) => m.id.toLowerCase().includes(pref));
      if (matches.length) {
        matches.sort((a, b) => (b.released || "").localeCompare(a.released || ""));
        return matches[0].id;
      }
    }
  }
  // No preference hit → newest by release date (then keep input order for ties).
  const withDates = models.filter((m) => m.released);
  if (withDates.length) {
    withDates.sort((a, b) => b.released.localeCompare(a.released));
    return withDates[0].id;
  }
  return models[0].id;
}
