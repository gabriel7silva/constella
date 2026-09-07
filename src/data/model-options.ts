/** Client-safe model option lists — the CURATED FALLBACK shown when the live per-binary model list
 *  (provider_model cache, fed by `cliModels()`) is unavailable. CLI adapters accept the runtime's real
 *  aliases / provider-routed ids; HTTP providers list live /v1/models.
 *
 *  MIRRORED in `CLI_MODELS` (`@/server/adapters/cli`) — that one is the server-side allowlist. Edit BOTH,
 *  in the SAME ORDER. Refreshed 2026-09-07 (`gpt-5-codex` shut down 2026-07-23, `grok-code-fast-1`
 *  retired 2026-08-15 — both were still on offer here until 0.9.2). */
export type ModelOpt = { value: string; label: string };

export const CLI_MODEL_OPTIONS: Record<string, ModelOpt[]> = {
  // Aliases, not ids — the Claude CLI resolves each to its current version, so these labels stay unversioned.
  cli_claude_code: [
    { value: "opus", label: "Claude Opus · most capable" },
    { value: "sonnet", label: "Claude Sonnet · balanced" },
    { value: "haiku", label: "Claude Haiku · fast" },
    { value: "fable", label: "Claude Fable · deepest reasoning" },
  ],
  cli_codex: [
    { value: "gpt-6-astra", label: "GPT-6 Astra · most capable" },
    { value: "gpt-5.6-sol", label: "GPT-5.6 Sol · complex work" },
    { value: "gpt-5.6-terra", label: "GPT-5.6 Terra · balanced" },
    { value: "gpt-5.6-luna", label: "GPT-5.6 Luna · fast" },
  ],
  cli_aider: [
    { value: "(default)", label: "Configured default" },
    { value: "anthropic/claude-sonnet-5", label: "Anthropic · Claude Sonnet 5" },
    { value: "openai/gpt-5.6-sol", label: "OpenAI · GPT-5.6 Sol" },
    { value: "deepseek/deepseek-chat", label: "DeepSeek · Chat" },
  ],
  cli_opencode: [
    { value: "(default)", label: "Configured default" },
    { value: "anthropic/claude-sonnet-5", label: "Anthropic · Claude Sonnet 5" },
    { value: "openai/gpt-5.6-sol", label: "OpenAI · GPT-5.6 Sol" },
  ],
  cli_copilot: [
    { value: "(default)", label: "Configured default" },
    { value: "claude-sonnet-4.5", label: "Claude Sonnet 4.5" },
    { value: "gpt-5", label: "GPT-5" },
  ],
  cli_cursor: [
    { value: "(default)", label: "Configured default" },
    { value: "claude-4.5-sonnet", label: "Claude Sonnet 4.5" },
    { value: "gpt-5", label: "GPT-5" },
  ],
  cli_cline: [{ value: "(default)", label: "Configured default" }],
  cli_kilo: [{ value: "(default)", label: "Configured default" }],
  cli_grok: [
    { value: "(default)", label: "Configured default" },
    { value: "grok-4.6", label: "Grok 4.6 · CLI default" },
    { value: "grok-4.5", label: "Grok 4.5" },
    { value: "grok-build-0.1", label: "Grok Build 0.1 · coding" },
  ],
};

/** CLI providers retired from the pickers — kept out of every provider dropdown (hire, agent-studio,
 *  models-screen, onboarding). Catalog ids vs DB adapters (filters use one or the other). */
export const HIDDEN_CLI_PROVIDERS = new Set(["openclaw", "hermes_cli", "gemini_cli"]); // catalog `id`
export const HIDDEN_CLI_ADAPTERS = new Set(["cli_openclaw", "cli_hermes", "cli_gemini"]); // DB `adapter`

/** CLI adapters whose binary exposes a real model list (`cliModels()` → provider_model cache) AND accepts
 *  those ids directly — the model picker pulls live from the binary for these. claude/codex keep their
 *  fixed aliases (the CLI rejects full ids), so they're NOT here. */
export const LIVE_CLI_ADAPTERS = new Set(["cli_aider", "cli_opencode"]);

export const isCliAdapter = (adapter: string) => adapter.startsWith("cli_");
export const cliModelOptions = (adapter: string): ModelOpt[] | null => CLI_MODEL_OPTIONS[adapter] ?? null;
