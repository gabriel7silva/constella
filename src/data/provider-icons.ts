/**
 * Brand-logo mapping for AI providers — same approach as the Project Stack icons ([stack-icons.ts]):
 * a CDN SVG with graceful monogram fallback. Uses LobeHub's icon set (purpose-built for AI providers,
 * near-complete coverage incl. OpenAI/DeepSeek/Cohere/Groq/Grok/Qwen…). The SVGs are monochrome
 * (currentColor → black via <img>), so `ProviderGlyph` renders them on a white chip. Unknown ids /
 * 404 slugs fall back to the 2-letter monogram (via onError), so it degrades gracefully.
 *
 * LobeHub icons: https://github.com/lobehub/lobe-icons — icons/<slug>.svg
 */
const CDN = "https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg/icons";

const PROVIDER_SLUG: Record<string, string> = {
  anthropic: "anthropic", claude_code: "claude",
  openai: "openai", codex_cli: "openai",
  google: "google", google_gemini: "gemini", gemini_cli: "gemini", vertex_ai: "vertexai",
  mistral: "mistral", deepseek: "deepseek", cohere: "cohere", perplexity: "perplexity",
  xai_grok: "grok", groq: "groq", ai21: "ai21",
  nvidia_nim: "nvidia", huggingface: "huggingface", replicate: "replicate",
  azure_openai: "azure", aws_bedrock: "bedrock", cloudflare: "cloudflare",
  dashscope: "qwen", zhipu: "zhipu", moonshot: "moonshot", minimax: "minimax",
  together: "together", openrouter: "openrouter", fireworks: "fireworks", cerebras: "cerebras",
  ollama: "ollama", ollama_cli: "ollama", lmstudio: "lmstudio", vllm: "vllm", localai: "localai",
  elevenlabs: "elevenlabs", stability: "stability", jina: "jina", voyage: "voyage",
  // Coding-agent CLIs (LobeHub has these; aider/openclaw have no icon → monogram fallback).
  copilot_cli: "githubcopilot", cursor_cli: "cursor", cline_cli: "cline",
  opencode: "opencode", kilo_code: "kilocode", grok_build_cli: "grok", hermes_cli: "nousresearch", windsurf: "windsurf",
};

/** Brand SVG URL for a provider, or null → ProviderGlyph shows its monogram. */
export function providerIconUrl(id: string): string | null {
  const slug = PROVIDER_SLUG[id];
  return slug ? `${CDN}/${slug}.svg` : null;
}
