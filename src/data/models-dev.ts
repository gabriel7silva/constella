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
  id: string;          // provider model id ("claude-opus-4-8", "gpt-5.2", "grok-4") — what the API/CLI accepts
  name: string;        // display name ("Claude Opus 4.8")
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
  anthropic: ["sonnet-4", "sonnet", "opus-4", "opus"],
  openai: ["gpt-5.2", "gpt-5.1", "gpt-5", "gpt-4.1", "o4"],
  google: ["gemini-3-pro", "gemini-3", "gemini-2.5-pro", "pro"],
  xai: ["grok-4", "grok-3", "grok"],
  groq: ["llama-4", "llama-3.3", "llama-3.1"],
  deepseek: ["deepseek-chat", "deepseek-v3", "deepseek-reasoner"],
  mistral: ["mistral-large", "mistral-medium"],
  openrouter: ["claude-sonnet", "gpt-5", "gemini"],
};

/**
 * Offline fallback — small, current (mid-2026) snapshot per models.dev key. Used ONLY when both the
 * network and the disk cache are unavailable. Costs are public list prices at time of writing; treated
 * as approximate. NOT the source of truth — the live catalog overrides this whenever reachable.
 */
const C = (id: string, name: string, context: number, outputLimit: number, inputCost: number, outputCost: number, caps: Partial<ModelCaps>, released: string): CatalogModel =>
  ({ id, name, context, outputLimit, inputCost, outputCost, caps: { reasoning: !!caps.reasoning, tools: !!caps.tools, vision: !!caps.vision }, released });

export const FALLBACK_MODELS: Record<string, CatalogModel[]> = {
  anthropic: [
    C("claude-opus-4-8", "Claude Opus 4.8", 1_000_000, 64_000, 5, 25, { reasoning: true, tools: true, vision: true }, "2026-02-01"),
    C("claude-opus-4-7", "Claude Opus 4.7", 1_000_000, 64_000, 5, 25, { reasoning: true, tools: true, vision: true }, "2025-12-01"),
    C("claude-sonnet-4-6", "Claude Sonnet 4.6", 1_000_000, 64_000, 3, 15, { reasoning: true, tools: true, vision: true }, "2026-01-15"),
    C("claude-haiku-4-5", "Claude Haiku 4.5", 200_000, 32_000, 1, 5, { tools: true, vision: true }, "2025-10-01"),
  ],
  openai: [
    C("gpt-5.2", "GPT-5.2", 400_000, 128_000, 1.25, 10, { reasoning: true, tools: true, vision: true }, "2026-03-01"),
    C("gpt-5.1", "GPT-5.1", 400_000, 128_000, 1.25, 10, { reasoning: true, tools: true, vision: true }, "2025-12-01"),
    C("gpt-5", "GPT-5", 400_000, 128_000, 1.25, 10, { reasoning: true, tools: true, vision: true }, "2025-08-01"),
    C("o4-mini", "o4-mini", 200_000, 100_000, 1.1, 4.4, { reasoning: true, tools: true }, "2025-04-01"),
  ],
  google: [
    C("gemini-3-pro", "Gemini 3 Pro", 2_000_000, 64_000, 2, 12, { reasoning: true, tools: true, vision: true }, "2026-02-01"),
    C("gemini-3-flash", "Gemini 3 Flash", 1_000_000, 64_000, 0.3, 2.5, { tools: true, vision: true }, "2026-02-01"),
    C("gemini-2.5-pro", "Gemini 2.5 Pro", 2_000_000, 64_000, 1.25, 10, { reasoning: true, tools: true, vision: true }, "2025-06-01"),
  ],
  xai: [
    C("grok-4.3", "Grok 4.3", 256_000, 64_000, 3, 15, { reasoning: true, tools: true, vision: true }, "2026-02-01"),
    C("grok-4", "Grok 4", 256_000, 64_000, 3, 15, { reasoning: true, tools: true, vision: true }, "2025-09-01"),
    C("grok-3", "Grok 3", 131_072, 32_000, 3, 15, { tools: true, vision: true }, "2025-02-01"),
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
