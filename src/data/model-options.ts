/** Client-safe model option lists — the CURATED FALLBACK shown when the live per-binary model list
 *  (provider_model cache, fed by `cliModels()`) is unavailable. CLI adapters accept the runtime's real
 *  aliases / provider-routed ids; HTTP providers list live /v1/models. */
export type ModelOpt = { value: string; label: string };

export const CLI_MODEL_OPTIONS: Record<string, ModelOpt[]> = {
  cli_claude_code: [
    { value: "opus", label: "Claude Opus · most capable" },
    { value: "sonnet", label: "Claude Sonnet · balanced" },
    { value: "haiku", label: "Claude Haiku · fast" },
    { value: "fable", label: "Claude Fable" },
  ],
  cli_codex: [
    { value: "gpt-5-codex", label: "GPT-5 Codex" },
    { value: "gpt-5", label: "GPT-5" },
    { value: "o3", label: "o3" },
    { value: "o4-mini", label: "o4-mini" },
  ],
  cli_aider: [
    { value: "(default)", label: "Configured default" },
    { value: "anthropic/claude-sonnet-4-6", label: "Anthropic · Claude Sonnet 4.6" },
    { value: "openai/gpt-5.2", label: "OpenAI · GPT-5.2" },
    { value: "deepseek/deepseek-chat", label: "DeepSeek · Chat" },
  ],
  cli_opencode: [
    { value: "(default)", label: "Configured default" },
    { value: "anthropic/claude-sonnet-4-6", label: "Anthropic · Claude Sonnet 4.6" },
    { value: "openai/gpt-5.2", label: "OpenAI · GPT-5.2" },
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
