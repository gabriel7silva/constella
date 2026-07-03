"use server";

import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { cliVersion, pickBinary, CLI_MODELS } from "@/server/adapters/cli";
import { ollamaInfo } from "@/server/local-models";
import { constellaHome } from "@/lib/fs-workspace";
import { PROVIDER_CATALOG } from "@/data/providers-catalog";

export type DetectedProvider = { id: string; name: string; kind: "cli" | "local" | "cloud"; adapter: string; models: string[] };

/** Detect the providers actually available on this machine (CLIs + local runtimes). */
export async function detectProviders(): Promise<{ detected: DetectedProvider[]; cloud: { id: string; name: string; adapter: string }[] }> {
  // OpenClaw + Hermes are retired (see HIDDEN_CLI_PROVIDERS) — not probed, never surfaced as "detected".
  const [claude, codex, aider, opencode, copilot, cursor, cline, kilo, oll] = await Promise.all([
    cliVersion("claude"), cliVersion("codex"),
    cliVersion("aider"), cliVersion("opencode"), cliVersion("copilot"), cliVersion("cursor-agent"), cliVersion("cline"), cliVersion("kilocode"),
    ollamaInfo(),
  ]);
  const detected: DetectedProvider[] = [];
  if (claude) detected.push({ id: "claude_code", name: "Claude Code", kind: "cli", adapter: "cli_claude_code", models: ["opus", "sonnet", "haiku"] });
  if (codex) detected.push({ id: "codex_cli", name: "Codex CLI", kind: "cli", adapter: "cli_codex", models: CLI_MODELS.cli_codex });
  if (aider) detected.push({ id: "aider", name: "Aider", kind: "cli", adapter: "cli_aider", models: CLI_MODELS.cli_aider });
  if (opencode) detected.push({ id: "opencode", name: "OpenCode", kind: "cli", adapter: "cli_opencode", models: CLI_MODELS.cli_opencode });
  if (copilot) detected.push({ id: "copilot_cli", name: "GitHub Copilot CLI", kind: "cli", adapter: "cli_copilot", models: CLI_MODELS.cli_copilot });
  if (cursor) detected.push({ id: "cursor_cli", name: "Cursor CLI", kind: "cli", adapter: "cli_cursor", models: CLI_MODELS.cli_cursor });
  if (cline) detected.push({ id: "cline_cli", name: "Cline CLI", kind: "cli", adapter: "cli_cline", models: CLI_MODELS.cli_cline });
  if (kilo) detected.push({ id: "kilo_code", name: "Kilo Code CLI", kind: "cli", adapter: "cli_kilo", models: CLI_MODELS.cli_kilo });
  if (oll.up) detected.push({ id: "ollama", name: "Ollama", kind: "local", adapter: "local_ollama", models: oll.models.length ? oll.models.map((m) => m.name) : ["(pull a model)"] });
  detected.push({ id: "llamacpp", name: "llama.cpp", kind: "local", adapter: "local_llamacpp", models: ["(download a GGUF)"] });
  const cloud = PROVIDER_CATALOG
    .filter((p) => (p.category === "cloud_api" || p.category === "router" || p.category === "cloud_platform") && p.supportsApiKey)
    .map((p) => ({ id: p.id, name: p.displayName, adapter: p.defaultAdapter }));
  return { detected, cloud };
}

/** Step 1 — real check that the ~/.constella workspace root exists + is writable. */
export async function checkSetupEnv(): Promise<{ ok: boolean; error?: string }> {
  try {
    const dir = constellaHome();
    mkdirSync(dir, { recursive: true });
    const probe = join(dir, ".write-probe");
    writeFileSync(probe, "ok");
    rmSync(probe, { force: true });
    return { ok: true };
  } catch (e) { return { ok: false, error: "workspace dir not writable: " + String(e instanceof Error ? e.message : e) }; }
}

/** Step 2 — real check that the chosen adapter is recognized (CLI binary present / known adapter). */
export async function checkAdapter(adapter: string): Promise<{ ok: boolean; error?: string }> {
  if (adapter.startsWith("cli_")) {
    const bin = pickBinary(adapter);
    const v = await cliVersion(bin);
    return { ok: !!v, error: v ? undefined : `${bin} CLI not found on PATH` };
  }
  const known = adapter.startsWith("local_") || PROVIDER_CATALOG.some((p) => p.defaultAdapter === adapter);
  return { ok: known, error: known ? undefined : `unknown adapter ${adapter}` };
}

/** Step 4 — real check that the chosen model is available for the adapter (where verifiable now). */
export async function probeModel(adapter: string, model: string): Promise<{ ok: boolean; error?: string }> {
  if (!model) return { ok: false, error: "no model selected" };
  if (adapter === "local_ollama") {
    const o = await ollamaInfo();
    if (!o.up) return { ok: false, error: "Ollama not running" };
    const has = o.models.some((m) => m.name === model || m.name.startsWith(model));
    return { ok: has || model.startsWith("("), error: has || model.startsWith("(") ? undefined : `model ${model} not pulled` };
  }
  if (adapter === "local_llamacpp") {
    try {
      const r = await fetch("http://127.0.0.1:8082/v1/models", { signal: AbortSignal.timeout(2000) });
      if (!r.ok) return { ok: false, error: "llama.cpp server not running" };
      return { ok: true };
    } catch { return { ok: false, error: "llama.cpp server not running on 127.0.0.1:8082" }; }
  }
  // CLI resolves model aliases itself; cloud model availability is validated once the key is added.
  return { ok: true };
}

/** Real reachability check for the chosen CEO brain. */
export async function testConnection(adapter: string): Promise<{ ok: boolean; error?: string }> {
  if (adapter.startsWith("cli_")) {
    const bin = pickBinary(adapter);
    const v = await cliVersion(bin);
    return { ok: !!v, error: v ? undefined : `${bin} CLI not found on PATH` };
  }
  if (adapter === "local_ollama") {
    const o = await ollamaInfo();
    return { ok: o.up, error: o.up ? undefined : "Ollama not running" };
  }
  if (adapter === "local_llamacpp") {
    try { const r = await fetch("http://127.0.0.1:8082/v1/models", { signal: AbortSignal.timeout(2000) }); return { ok: r.ok, error: r.ok ? undefined : "llama.cpp server not running" }; }
    catch { return { ok: false, error: "llama.cpp server not running on 127.0.0.1:8082" }; }
  }
  // Cloud: the key is added after onboarding (Models screen); treat as ready here.
  return { ok: true };
}
