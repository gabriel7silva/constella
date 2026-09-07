/** Display name + concrete version for models, so the UI can show "Claude Opus 5" instead of a
 *  bare alias like "opus". CLI adapters only accept the runtime alias (the CLI resolves it to the
 *  current version); this maps each alias to the version it resolves to today. Client-safe.
 *
 *  `version` is COSMETIC — it is what the picker prints, not what gets sent. It drifts every time a
 *  vendor ships a new generation behind the same alias, so refresh it with the catalog (last: 2026-09-07). */
export type ModelVersion = { id: string; label: string; version: string; note?: string };

export const MODEL_VERSIONS: Record<string, ModelVersion[]> = {
  cli_claude_code: [
    { id: "opus", label: "Claude Opus", version: "5", note: "most capable" },
    { id: "sonnet", label: "Claude Sonnet", version: "5", note: "balanced" },
    { id: "haiku", label: "Claude Haiku", version: "4.5", note: "fast" },
    { id: "fable", label: "Claude Fable", version: "5.1", note: "deepest reasoning" },
  ],
  cli_codex: [
    { id: "gpt-6-astra", label: "GPT-6 Astra", version: "6", note: "most capable" },
    { id: "gpt-5.6-sol", label: "GPT-5.6 Sol", version: "5.6", note: "complex work" },
    { id: "gpt-5.6-terra", label: "GPT-5.6 Terra", version: "5.6", note: "balanced" },
    { id: "gpt-5.6-luna", label: "GPT-5.6 Luna", version: "5.6", note: "fast" },
  ],
  cli_aider: [
    { id: "(default)", label: "Aider", version: "default", note: "configured provider" },
    { id: "anthropic/claude-sonnet-5", label: "Claude Sonnet", version: "5" },
    { id: "openai/gpt-5.6-sol", label: "GPT Sol", version: "5.6" },
    { id: "deepseek/deepseek-chat", label: "DeepSeek Chat", version: "" },
  ],
  cli_opencode: [
    { id: "(default)", label: "OpenCode", version: "default", note: "configured provider" },
    { id: "anthropic/claude-sonnet-5", label: "Claude Sonnet", version: "5" },
    { id: "openai/gpt-5.6-sol", label: "GPT Sol", version: "5.6" },
  ],
  cli_copilot: [
    { id: "(default)", label: "Copilot", version: "default", note: "configured provider" },
    { id: "claude-sonnet-4.5", label: "Claude Sonnet", version: "4.5" },
    { id: "gpt-5", label: "GPT", version: "5" },
  ],
  cli_cursor: [
    { id: "(default)", label: "Cursor", version: "default", note: "configured provider" },
    { id: "claude-4.5-sonnet", label: "Claude Sonnet", version: "4.5" },
    { id: "gpt-5", label: "GPT", version: "5" },
  ],
  cli_cline: [{ id: "(default)", label: "Cline", version: "default", note: "configured provider" }],
  cli_kilo: [{ id: "(default)", label: "Kilo Code", version: "default", note: "configured provider" }],
};

/** Known CLI model versions for an adapter, or null for HTTP/local providers (which list live). */
export function versionsFor(adapter: string): ModelVersion[] | null {
  return MODEL_VERSIONS[adapter] ?? null;
}

/** Best-effort display label + version pulled from a raw model id (HTTP/local providers).
 *  e.g. "claude-opus-5" → {label:"Claude Opus", version:"5"}; "gpt-4o" → {label:"GPT 4o"}. */
export function prettyModel(id: string): { label: string; version: string } {
  if (!id) return { label: "", version: "" };
  // Strip a trailing parameter-size token (e.g. "-70b", "-8x7b", "_3b") FIRST so it isn't folded into the
  // version — otherwise "llama-3.3-70b" → version "3.3.70" (size lost, nonsense 3-part version).
  const base = id.replace(/[-_.\s]\d+(?:x\d+)?[bm]\b/i, "");
  // Pull a trailing version like 4.8 / 2.5 / 4-8 (→ 4.8) / 3.5.
  const vm = base.match(/(\d+(?:[.\-]\d+){0,2})(?!.*\d)/);
  let version = vm ? vm[1].replace(/-/g, ".") : "";
  const core = (vm ? base.slice(0, vm.index).replace(/[-_.\s]+$/, "") : base);
  const label = core
    .split(/[-_.\s]+/).filter(Boolean)
    .map((w) => (/^(gpt|llm|api|ai)$/i.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ") || id;
  return { label, version };
}
