/**
 * Dynamic model catalog — shared types + provider mapping + offline fallback.
 *
 * Backbone source: **models.dev** (public, no-auth JSON at https://models.dev/api.json), which carries
 * current model metadata (context window, input/output pricing, capabilities, release dates) for every
 * major provider and is kept up to date upstream. The server module (`@/server/model-catalog`) fetches
 * + caches it; this module is CLIENT-SAFE (pure data/types, no fs/network) so the UI can share the
 * types and the offline fallback.
 *
 * The whole point: model lists are NEVER hardcoded as the source of truth. They come live from
 * models.dev ∩ each provider's `/v1/models`. The fallback below is a small, current snapshot used
 * ONLY when the machine is offline and the disk cache is cold — clearly demoted, not authoritative.
 */

export type ModelCaps = { reasoning: boolean; tools: boolean; vision: boolean };

/** A normalized model entry — the unit both models.dev and `/v1/models` are flattened into. */
export type CatalogModel = {
  id: string;          // provider model id ("claude-opus-5", "gpt-6-astra", "grok-4.6") — what the API/CLI accepts
  name: string;        // display name ("Claude Opus 5")
  context: number;     // max context tokens (0 = unknown)
  outputLimit: number; // max output tokens (0 = unknown)
  inputCost: number;   // USD per 1M input tokens (0 = unknown / free)
  outputCost: number;  // USD per 1M output tokens (0 = unknown / free)
  caps: ModelCaps;
  released: string;    // ISO date "2026-01-15" ("" = unknown) — drives "newest" default pick
};

/** What the cache (provider_model rows) hands the UI: a CatalogModel plus the picked-default flag. */
export type CachedModel = CatalogModel & { isDefault: boolean };

/**
 * Constella catalogId → models.dev top-level provider key. models.dev keys are the canonical
 * lowercase provider ids (anthropic/openai/google/xai/…). Only mappings we can enrich are listed;
 * anything missing falls back to a normalized guess (see `modelsDevKeyForCatalog`).
 */
export const CATALOG_TO_MODELSDEV: Record<string, string> = {
  anthropic: "anthropic",
  openai: "openai",
  google_gemini: "google",
  xai_grok: "xai",
  deepseek: "deepseek",
  cohere: "cohere",
  groq: "groq",
  nvidia_nim: "nvidia",
  together: "togetherai",
  fireworks: "fireworks-ai",
  cerebras: "cerebras",
  perplexity: "perplexity",
  openrouter: "openrouter",
  mistral: "mistral",
  moonshot: "moonshotai",
  dashscope: "alibaba",
  zhipu: "zhipuai",
  azure_openai: "azure",
  aws_bedrock: "amazon-bedrock",
  vertex_ai: "google-vertex",
  // CLI brains are provider-routed but conceptually map to a first-party family — useful when a CLI
  // model list isn't available, so we can still enrich version/context from models.dev.
  claude_code: "anthropic",
  gemini_cli: "google",
  codex_cli: "openai", // its family is "openai" — the prefix-strip heuristic would wrongly yield "codex" (no such models.dev key)
};

/** Resolve the models.dev provider key for a Constella catalogId (explicit map, else a normalized guess). */
export function modelsDevKeyForCatalog(catalogId: string): string {
  if (CATALOG_TO_MODELSDEV[catalogId]) return CATALOG_TO_MODELSDEV[catalogId];
  // Normalized guess: strip Constella suffixes/prefixes so e.g. "groq" → "groq", "openai_cli" → "openai".
  return catalogId.replace(/_(grok|gemini|nim|cli|openai|api|server|rt)$/g, "").replace(/_/g, "-");
}

/** Preference order (substring, best→worst) for the recommended default per models.dev key. The first
 *  available model matching the earliest preference wins; ties broken by newest release. Honest: it's a
 *  heuristic — the user can pick any model. */
export const DEFAULT_PREFERENCE: Record<string, string[]> = {
  // Opus 5 stays first on purpose. Claude Fable 5.1 is the more capable model, but it is Opus-tier ×2 on both
  // sides ($10/$50 vs $5/$25) — a new company should not silently staff its whole roster at that price.
  anthropic: ["opus-5", "opus", "sonnet-5", "sonnet"],
  openai: ["gpt-6", "gpt-5.6-sol", "gpt-5.6", "gpt-5"],
  google: ["gemini-3.8", "gemini-3.7", "gemini-3", "gemini-2.5-pro"],
  xai: ["grok-4.6", "grok-4.5", "grok-4", "grok"],
  groq: ["llama-4", "llama-3.3", "llama-3.1"],
  deepseek: ["deepseek-chat", "deepseek-v3", "deepseek-reasoner"],
  mistral: ["mistral-large", "mistral-medium"],
  openrouter: ["claude-sonnet", "gpt-5", "gemini"],
};

/**
 * Offline fallback — small snapshot per models.dev key, refreshed 2026-09-07 from each vendor's own docs.
 * Used ONLY when both the network and the disk cache are unavailable. NOT the source of truth — the live
 * catalog overrides this whenever reachable.
 *
 * Rules for keeping it honest when you refresh it:
 *  - `released` is the vendor's announcement date and is load-bearing: `defaultModelFor` breaks preference
 *    ties by newest, so a wrong date silently changes which model a new provider defaults to.
 *  - RETIRED ids must be DELETED, not demoted. A retired slug either errors or silently reroutes to a model
 *    priced differently, which is worse than having no fallback at all (0.9.2 removed `gpt-5-codex`,
 *    `grok-4`, `grok-3` and `gemini-3-pro` for exactly this reason).
 *  - Costs are public list prices; `context`/`outputLimit` are the documented maxima. Approximate by design.
 */
const C = (id: string, name: string, context: number, outputLimit: number, inputCost: number, outputCost: number, caps: Partial<ModelCaps>, released: string): CatalogModel =>
  ({ id, name, context, outputLimit, inputCost, outputCost, caps: { reasoning: !!caps.reasoning, tools: !!caps.tools, vision: !!caps.vision }, released });

export const FALLBACK_MODELS: Record<string, CatalogModel[]> = {
  anthropic: [
    C("claude-fable-5-1", "Claude Fable 5.1", 1_000_000, 128_000, 10, 50, { reasoning: true, tools: true, vision: true }, "2026-09-01"),
    C("claude-opus-5", "Claude Opus 5", 1_000_000, 128_000, 5, 25, { reasoning: true, tools: true, vision: true }, "2026-07-24"),
    C("claude-sonnet-5", "Claude Sonnet 5", 1_000_000, 128_000, 2, 10, { reasoning: true, tools: true, vision: true }, "2026-06-30"),
    C("claude-opus-4-8", "Claude Opus 4.8", 1_000_000, 128_000, 5, 25, { reasoning: true, tools: true, vision: true }, "2026-05-28"),
    C("claude-haiku-4-5", "Claude Haiku 4.5", 200_000, 64_000, 1, 5, { tools: true, vision: true }, "2025-10-01"),
  ],
  openai: [
    C("gpt-6-astra", "GPT-6 Astra", 1_050_000, 128_000, 10, 50, { reasoning: true, tools: true, vision: true }, "2026-09-03"),
    C("gpt-5.6-sol", "GPT-5.6 Sol", 1_050_000, 128_000, 4, 20, { reasoning: true, tools: true, vision: true }, "2026-07-09"),
    C("gpt-5.6-terra", "GPT-5.6 Terra", 1_050_000, 128_000, 2, 12, { reasoning: true, tools: true, vision: true }, "2026-07-09"),
    C("gpt-5.6-luna", "GPT-5.6 Luna", 1_050_000, 128_000, 0.2, 1.2, { reasoning: true, tools: true, vision: true }, "2026-07-09"),
  ],
  google: [
    // The 3.6/3.7/3.8 Flash prices are promotional through 2026-12-31 and DOUBLE afterwards — recheck in January.
    C("gemini-3.8-flash", "Gemini 3.8 Flash", 1_000_000, 64_000, 0.75, 3.75, { reasoning: true, tools: true, vision: true }, "2026-09-02"),
    C("gemini-3.7-flash", "Gemini 3.7 Flash", 1_000_000, 64_000, 0.75, 3.75, { reasoning: true, tools: true, vision: true }, "2026-08-13"),
    C("gemini-3.5-flash", "Gemini 3.5 Flash", 1_000_000, 64_000, 1.5, 9, { reasoning: true, tools: true, vision: true }, "2026-05-19"),
    C("gemini-3.5-flash-lite", "Gemini 3.5 Flash Lite", 1_000_000, 64_000, 0.3, 2.5, { tools: true, vision: true }, "2026-07-21"),
    C("gemini-3.1-pro-preview", "Gemini 3.1 Pro (preview)", 1_000_000, 64_000, 2, 12, { reasoning: true, tools: true, vision: true }, "2026-02-19"),
  ],
  xai: [
    // ≥200k-token prompts are billed at double these rates on 4.6/4.5/4.3 — the catalog carries the base tier.
    C("grok-4.6", "Grok 4.6", 500_000, 64_000, 2, 6, { reasoning: true, tools: true, vision: true }, "2026-08-12"),
    C("grok-4.5", "Grok 4.5", 500_000, 64_000, 2, 6, { reasoning: true, tools: true, vision: true }, "2026-07-08"),
    C("grok-4.3", "Grok 4.3", 1_000_000, 64_000, 1.25, 2.5, { reasoning: true, tools: true, vision: true }, "2026-02-01"),
    C("grok-build-0.1", "Grok Build 0.1", 256_000, 64_000, 1, 2, { reasoning: true, tools: true, vision: true }, "2026-05-20"),
  ],
  deepseek: [
    C("deepseek-chat", "DeepSeek Chat", 128_000, 8_000, 0.27, 1.1, { tools: true }, "2025-12-01"),
    C("deepseek-reasoner", "DeepSeek Reasoner", 128_000, 64_000, 0.55, 2.19, { reasoning: true, tools: true }, "2025-12-01"),
  ],
  groq: [
    C("llama-4-scout", "Llama 4 Scout", 131_072, 8_000, 0.11, 0.34, { tools: true, vision: true }, "2025-04-01"),
    C("llama-3.3-70b", "Llama 3.3 70B", 131_072, 32_000, 0.59, 0.79, { tools: true }, "2024-12-01"),
  ],
};

/** Fallback models for a models.dev key, or [] if none. */
export const fallbackForKey = (key: string): CatalogModel[] => FALLBACK_MODELS[key] ?? [];
