/**
 * Brand-logo mapping for local GGUF models — same approach as the provider/stack icons: a LobeHub
 * CDN SVG with graceful fallback. The catalog model `name` (e.g. "Qwen2.5-Coder-7B-Instruct (Q4_K_M)")
 * is matched to its VENDOR/family by regex → a LobeHub slug (monochrome SVG, rendered on a white chip
 * by `ModelGlyph`). Unknown families → null → caller falls back to the generic llama.cpp glyph.
 *
 * LobeHub icons: https://github.com/lobehub/lobe-icons — icons/<slug>.svg
 */
const CDN = "https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg/icons";

// Ordered: first regex that matches the model name wins (verified present on LobeHub).
const FAMILY: [RegExp, string][] = [
  [/qwen/i, "qwen"],
  [/(^|[-_ ])(meta-?)?llama/i, "meta"],
  [/codestral|mixtral|mistral|ministral/i, "mistral"],
  [/gemma/i, "gemma"],
  [/phi-?\d/i, "microsoft"],
  [/deepseek/i, "deepseek"],
  [/(^|[-_ ])yi-?\d/i, "yi"],
  [/granite/i, "ibm"],
  [/smollm/i, "huggingface"],
  [/aya|command-?r|^c4ai/i, "cohere"],
  [/falcon/i, "tii"],
  [/exaone/i, "lg"],
];

/** Brand SVG URL for a catalog model name, or null → ModelGlyph shows the generic llama.cpp glyph. */
export function modelIconUrl(name: string): string | null {
  for (const [re, slug] of FAMILY) if (re.test(name)) return `${CDN}/${slug}.svg`;
  return null; // nomic-embed + anything unmapped → fallback glyph
}
