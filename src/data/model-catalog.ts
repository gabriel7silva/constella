/**
 * Curated downloadable local models. Ollama entries are pulled via the Ollama daemon (`/api/pull`);
 * GGUF entries are downloaded to disk for llama.cpp. `nomic-embed-text` is the embedding model that
 * powers semantic workspace RAG.
 *
 * The GGUF catalog is GENERATED from a compact family spec using lmstudio-community's reliable naming
 * convention — `lmstudio-community/<Repo>-GGUF/resolve/main/<Repo>-<QUANT>.gguf` — across the quants
 * they actually ship (Q3_K_L, Q4_K_M, Q6_K, Q8_0), capped per size so every file is single-part.
 * `sizeBytes` is estimated from params × bits-per-weight (good enough for the GPU fit check).
 */
export type OllamaModel = { name: string; label: string; size: string; kind: "embed" | "chat" | "code"; note?: string };
export type GgufKind = "chat" | "code" | "embed" | "reasoning";
export type GgufModel = { id: string; name: string; url: string; params: string; quant: string; sizeBytes: number; sha256?: string; kind?: GgufKind; paramsB?: number };

export const OLLAMA_CATALOG: OllamaModel[] = [
  { name: "nomic-embed-text", label: "Nomic Embed Text", size: "274 MB", kind: "embed", note: "Powers semantic workspace RAG — pull this to enable embeddings." },
  { name: "mxbai-embed-large", label: "mxbai Embed Large", size: "670 MB", kind: "embed", note: "Higher-quality embeddings (set CONSTELLA_EMBED_MODEL)." },
  { name: "llama3.2:3b", label: "Llama 3.2 3B", size: "2.0 GB", kind: "chat" },
  { name: "qwen2.5:7b", label: "Qwen 2.5 7B", size: "4.7 GB", kind: "chat" },
  { name: "qwen2.5-coder:7b", label: "Qwen 2.5 Coder 7B", size: "4.7 GB", kind: "code" },
  { name: "gemma2:2b", label: "Gemma 2 2B", size: "1.6 GB", kind: "chat" },
  { name: "phi3.5", label: "Phi 3.5", size: "2.2 GB", kind: "chat" },
];

/* --------------------------------------------------------------- GGUF family spec → catalog */
type Family = { repo: string; paramsB: number; kind: GgufKind; vendor?: string };

// All verified present on lmstudio-community (HEAD-checked). vendor overrides the default source.
const GGUF_FAMILIES: Family[] = [
  // ── Qwen 2.5 (Alibaba) ──
  { repo: "Qwen2.5-0.5B-Instruct", paramsB: 0.5, kind: "chat" }, { repo: "Qwen2.5-1.5B-Instruct", paramsB: 1.5, kind: "chat" },
  { repo: "Qwen2.5-3B-Instruct", paramsB: 3, kind: "chat" }, { repo: "Qwen2.5-7B-Instruct", paramsB: 7, kind: "chat" },
  { repo: "Qwen2.5-14B-Instruct", paramsB: 14, kind: "chat" }, { repo: "Qwen2.5-32B-Instruct", paramsB: 32, kind: "chat" },
  { repo: "Qwen2.5-72B-Instruct", paramsB: 72, kind: "chat" },
  { repo: "Qwen2.5-Coder-1.5B-Instruct", paramsB: 1.5, kind: "code" }, { repo: "Qwen2.5-Coder-3B-Instruct", paramsB: 3, kind: "code" },
  { repo: "Qwen2.5-Coder-7B-Instruct", paramsB: 7, kind: "code" }, { repo: "Qwen2.5-Coder-14B-Instruct", paramsB: 14, kind: "code" },
  { repo: "Qwen2.5-Coder-32B-Instruct", paramsB: 32, kind: "code" },
  // ── Qwen 3 ──
  { repo: "Qwen3-0.6B", paramsB: 0.6, kind: "chat" }, { repo: "Qwen3-1.7B", paramsB: 1.7, kind: "chat" },
  { repo: "Qwen3-4B", paramsB: 4, kind: "chat" }, { repo: "Qwen3-8B", paramsB: 8, kind: "chat" },
  { repo: "Qwen3-14B", paramsB: 14, kind: "chat" }, { repo: "Qwen3-32B", paramsB: 32, kind: "chat" },
  // ── Llama (Meta) ──
  { repo: "Llama-3.2-1B-Instruct", paramsB: 1, kind: "chat" }, { repo: "Llama-3.2-3B-Instruct", paramsB: 3, kind: "chat" },
  { repo: "Meta-Llama-3.1-8B-Instruct", paramsB: 8, kind: "chat" }, { repo: "Meta-Llama-3.1-70B-Instruct", paramsB: 70, kind: "chat" },
  { repo: "Llama-3.3-70B-Instruct", paramsB: 70, kind: "chat" },
  // ── Gemma (Google) ──
  { repo: "gemma-2-2b-it", paramsB: 2, kind: "chat" }, { repo: "gemma-2-9b-it", paramsB: 9, kind: "chat" }, { repo: "gemma-2-27b-it", paramsB: 27, kind: "chat" },
  { repo: "gemma-3-1b-it", paramsB: 1, kind: "chat" }, { repo: "gemma-3-4b-it", paramsB: 4, kind: "chat" },
  { repo: "gemma-3-12b-it", paramsB: 12, kind: "chat" }, { repo: "gemma-3-27b-it", paramsB: 27, kind: "chat" },
  // ── Mistral ──
  { repo: "Mistral-7B-Instruct-v0.3", paramsB: 7, kind: "chat" }, { repo: "Mistral-Nemo-Instruct-2407", paramsB: 12, kind: "chat" },
  { repo: "Mistral-Small-Instruct-2409", paramsB: 22, kind: "chat" }, { repo: "Mistral-Small-24B-Instruct-2501", paramsB: 24, kind: "chat" },
  { repo: "Codestral-22B-v0.1", paramsB: 22, kind: "code" },
  // ── Phi (Microsoft) ──
  { repo: "Phi-3.1-mini-4k-instruct", paramsB: 3.8, kind: "chat" },
  // ── DeepSeek ──
  { repo: "DeepSeek-R1-Distill-Qwen-1.5B", paramsB: 1.5, kind: "reasoning" }, { repo: "DeepSeek-R1-Distill-Qwen-7B", paramsB: 7, kind: "reasoning" },
  { repo: "DeepSeek-R1-Distill-Qwen-14B", paramsB: 14, kind: "reasoning" }, { repo: "DeepSeek-R1-Distill-Qwen-32B", paramsB: 32, kind: "reasoning" },
  { repo: "DeepSeek-R1-Distill-Llama-8B", paramsB: 8, kind: "reasoning" }, { repo: "DeepSeek-Coder-V2-Lite-Instruct", paramsB: 16, kind: "code" },
  // ── Others ──
  { repo: "Yi-1.5-9B-Chat", paramsB: 9, kind: "chat" }, { repo: "Yi-1.5-34B-Chat", paramsB: 34, kind: "chat" },
  { repo: "granite-3.0-8b-instruct", paramsB: 8, kind: "chat" }, { repo: "granite-3.1-8b-instruct", paramsB: 8, kind: "chat" },
  { repo: "SmolLM2-360M-Instruct", paramsB: 0.36, kind: "chat" }, { repo: "SmolLM2-1.7B-Instruct", paramsB: 1.7, kind: "chat" },
  { repo: "aya-expanse-8b", paramsB: 8, kind: "chat" }, { repo: "aya-expanse-32b", paramsB: 32, kind: "chat" },
  { repo: "Falcon3-7B-Instruct", paramsB: 7, kind: "chat" }, { repo: "Falcon3-10B-Instruct", paramsB: 10, kind: "chat" },
  { repo: "EXAONE-3.5-2.4B-Instruct", paramsB: 2.4, kind: "chat" }, { repo: "EXAONE-3.5-7.8B-Instruct", paramsB: 7.8, kind: "chat" },
  // ── Library fill: verified present on lmstudio-community (HF API + HEAD-checked, 2026-06) ──
  { repo: "Qwen3.5-0.8B", paramsB: 0.8, kind: "chat" }, { repo: "Qwen3.5-2B", paramsB: 2, kind: "chat" },
  { repo: "Qwen3.5-9B", paramsB: 9, kind: "chat" }, { repo: "Qwen3.5-27B", paramsB: 27, kind: "chat" },
  { repo: "Qwen3.5-35B-A3B", paramsB: 35, kind: "chat" }, { repo: "Qwen3.6-27B", paramsB: 27, kind: "chat" },
  { repo: "Qwen3.6-35B-A3B", paramsB: 35, kind: "chat" }, { repo: "Qwen3-30B-A3B", paramsB: 30, kind: "chat" },
  { repo: "Qwen3-30B-A3B-Instruct-2507", paramsB: 30, kind: "chat" }, { repo: "Qwen3-Next-80B-A3B-Instruct", paramsB: 80, kind: "chat" },
  { repo: "Qwen3-4B-Thinking-2507", paramsB: 4, kind: "reasoning" }, { repo: "QwQ-32B", paramsB: 32, kind: "reasoning" },
  { repo: "Qwen2.5-7B-Instruct-1M", paramsB: 7, kind: "chat" }, { repo: "Qwen2.5-Coder-0.5B-Instruct", paramsB: 0.5, kind: "code" },
  { repo: "Qwen2.5-Coder-3B", paramsB: 3, kind: "code" }, { repo: "Qwen2.5-Coder-32B", paramsB: 32, kind: "code" },
  { repo: "Qwen2.5-Math-7B-Instruct", paramsB: 7, kind: "chat" }, { repo: "Qwen2-500M-Instruct", paramsB: 0.5, kind: "chat" },
  { repo: "Qwen1.5-32B-Chat", paramsB: 32, kind: "chat" },
  { repo: "gemma-4-E2B-it", paramsB: 2, kind: "chat" }, { repo: "gemma-4-E4B-it", paramsB: 4, kind: "chat" },
  { repo: "gemma-4-12B-it", paramsB: 12, kind: "chat" }, { repo: "gemma-4-26B-A4B-it", paramsB: 26, kind: "chat" },
  { repo: "gemma-4-31B-it", paramsB: 31, kind: "chat" }, { repo: "gemma-3-270m-it", paramsB: 0.27, kind: "chat" },
  { repo: "gemma-1.1-2b-it", paramsB: 2, kind: "chat" }, { repo: "codegemma-2b", paramsB: 2, kind: "code" },
  { repo: "codegemma-7b", paramsB: 7, kind: "code" }, { repo: "codegemma-7b-it", paramsB: 7, kind: "code" },
  { repo: "codegemma-1.1-7b-it", paramsB: 7, kind: "code" },
  { repo: "Ministral-3-3B-Instruct-2512", paramsB: 3, kind: "chat" }, { repo: "Ministral-3-8B-Instruct-2512", paramsB: 8, kind: "chat" },
  { repo: "Ministral-3-14B-Instruct-2512", paramsB: 14, kind: "chat" }, { repo: "Ministral-3-3B-Reasoning-2512", paramsB: 3, kind: "reasoning" },
  { repo: "Ministral-3-8B-Reasoning-2512", paramsB: 8, kind: "reasoning" }, { repo: "Ministral-3-14B-Reasoning-2512", paramsB: 14, kind: "reasoning" },
  { repo: "Mistral-Small-3.1-24B-Instruct-2503", paramsB: 24, kind: "chat" }, { repo: "Mistral-Small-3.2-24B-Instruct-2506", paramsB: 24, kind: "chat" },
  { repo: "Devstral-Small-2-24B-Instruct-2512", paramsB: 24, kind: "code" }, { repo: "mathstral-7B-v0.1", paramsB: 7, kind: "chat" },
  { repo: "dolphin-2.8-mistral-7b-v02", paramsB: 7, kind: "chat" }, { repo: "WizardLM-2-7B", paramsB: 7, kind: "chat" },
  { repo: "DeepSeek-R1-0528-Qwen3-8B", paramsB: 8, kind: "reasoning" }, { repo: "DeepSeek-R1-Distill-Llama-70B", paramsB: 70, kind: "reasoning" },
  { repo: "deepseek-coder-1.3B-kexer", paramsB: 1.3, kind: "code" }, { repo: "deepseek-coder-6.7B-kexer", paramsB: 6.7, kind: "code" },
  { repo: "granite-3.2-8b-instruct", paramsB: 8, kind: "chat" }, { repo: "granite-4.1-3b", paramsB: 3, kind: "chat" },
  { repo: "granite-4.1-8b", paramsB: 8, kind: "chat" }, { repo: "granite-4.1-30b", paramsB: 30, kind: "chat" },
  { repo: "Olmo-3-32B-Think", paramsB: 32, kind: "reasoning" }, { repo: "Seed-OSS-36B-Instruct", paramsB: 36, kind: "chat" },
  { repo: "ERNIE-4.5-21B-A3B-PT", paramsB: 21, kind: "chat" }, { repo: "LFM2-24B-A2B", paramsB: 24, kind: "chat" },
  { repo: "LFM2.5-1.2B-Instruct", paramsB: 1.2, kind: "chat" }, { repo: "LFM2.5-1.2B-Thinking", paramsB: 1.2, kind: "reasoning" },
  { repo: "NVIDIA-Nemotron-3-Nano-4B", paramsB: 4, kind: "chat" }, { repo: "Hermes-4-70B", paramsB: 70, kind: "chat" },
  { repo: "Llama-3.1-Tulu-3-8B", paramsB: 8, kind: "chat" }, { repo: "Meta-Llama-3-70B-Instruct", paramsB: 70, kind: "chat" },
  { repo: "Llama3-ChatQA-1.5-70B", paramsB: 70, kind: "chat" }, { repo: "Llama-3-Groq-8B-Tool-Use", paramsB: 8, kind: "chat" },
  { repo: "aya-23-8B", paramsB: 8, kind: "chat" }, { repo: "aya-23-35B", paramsB: 35, kind: "chat" },
  { repo: "SmolLM2-135M-Instruct", paramsB: 0.135, kind: "chat" }, { repo: "Yi-Coder-1.5B", paramsB: 1.5, kind: "code" },
  { repo: "Yi-Coder-9B-Chat", paramsB: 9, kind: "code" }, { repo: "OpenCoder-1.5B-Instruct", paramsB: 1.5, kind: "code" },
  { repo: "stable-code-instruct-3b", paramsB: 3, kind: "code" },
  { repo: "internlm2-math-plus-7b", paramsB: 7, kind: "chat" }, { repo: "internlm2-math-plus-20b", paramsB: 20, kind: "chat" },
];

// bytes-per-param by quant (≈ bpw/8, tuned to real GGUF file sizes).
const QUANT_MULT: Record<string, number> = { Q3_K_L: 0.55, Q4_K_M: 0.67, Q6_K: 0.90, Q8_0: 1.13 };

function quantsFor(p: number): string[] {
  if (p <= 9) return ["Q3_K_L", "Q4_K_M", "Q6_K", "Q8_0"];
  if (p <= 34) return ["Q3_K_L", "Q4_K_M", "Q6_K"];
  return ["Q3_K_L", "Q4_K_M"]; // ≥35B: only quants that stay single-file
}
function paramLabel(p: number): string { return p < 1 ? `${Math.round(p * 1000)}M` : `${p}B`; }

function generateGguf(): GgufModel[] {
  const out: GgufModel[] = [];
  for (const f of GGUF_FAMILIES) {
    const vendor = f.vendor ?? "lmstudio-community";
    for (const q of quantsFor(f.paramsB)) {
      const file = `${f.repo}-${q}.gguf`;
      out.push({
        id: `${f.repo}-${q}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        name: `${f.repo} (${q})`,
        url: `https://huggingface.co/${vendor}/${f.repo}-GGUF/resolve/main/${file}`,
        params: paramLabel(f.paramsB), quant: q, sizeBytes: Math.round(f.paramsB * 1e9 * QUANT_MULT[q]),
        kind: f.kind, paramsB: f.paramsB,
      });
    }
  }
  return out;
}

export const GGUF_CATALOG: GgufModel[] = [
  // The embedding model that powers semantic workspace RAG (kept first; special-cased everywhere).
  { id: "nomic-embed-q8", name: "nomic-embed-text-v1.5 (Q8_0)", url: "https://huggingface.co/nomic-ai/nomic-embed-text-v1.5-GGUF/resolve/main/nomic-embed-text-v1.5.Q8_0.gguf", params: "137M", quant: "Q8_0", sizeBytes: 146_000_000, kind: "embed", paramsB: 0.137 },
  ...generateGguf(),
];
