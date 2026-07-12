import "server-only";
import { cliVersion, CLI_MODELS, pickBinary } from "./cli";
import type { CatalogProvider } from "@/data/providers-catalog";

/**
 * Real provider connectivity. Fetches actual model lists / checks real auth.
 * Returns honest results — count from the live endpoint, or an error. No fakes.
 */
export type SyncResult = { ok: boolean; count: number; error?: string };

async function getJson(url: string, headers: Record<string, string>, timeoutMs = 12_000): Promise<{ ok: boolean; status: number; json?: unknown; error?: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal });
    const text = await res.text();
    let json: unknown;
    try { json = JSON.parse(text); } catch { json = undefined; }
    return { ok: res.ok, status: res.status, json, error: res.ok ? undefined : (text.slice(0, 200) || res.statusText) };
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : String(e) };
  } finally { clearTimeout(t); }
}

function countFromList(json: unknown): number {
  if (!json || typeof json !== "object") return 0;
  const o = json as Record<string, unknown>;
  if (Array.isArray(o.data)) return o.data.length;       // OpenAI-compatible / Anthropic
  if (Array.isArray(o.models)) return o.models.length;   // Ollama /api/tags, Google
  return 0;
}

/** Hit the real endpoint (or CLI) for a provider and return the live model count. */
export async function syncProvider(cp: CatalogProvider, apiKey: string | null): Promise<SyncResult> {
  const adapter = cp.defaultAdapter;

  // CLI providers — verify the binary is really installed.
  if (adapter.startsWith("cli_")) {
    const bin = pickBinary(adapter);
    const v = await cliVersion(bin);
    if (!v) return { ok: false, count: 0, error: `${bin} CLI not found on PATH` };
    return { ok: true, count: (CLI_MODELS[adapter] ?? CLI_MODELS["cli_claude_code"]).length };
  }

  // Local runtimes — Ollama lists installed models locally (no key).
  if (adapter === "local_ollama" || cp.id === "ollama" || cp.id === "ollama_openai") {
    const base = cp.baseUrl || "http://127.0.0.1:11434";
    const r = await getJson(base.replace(/\/$/, "") + "/api/tags", {});
    if (!r.ok) return { ok: false, count: 0, error: r.error || "Ollama not reachable at " + base };
    return { ok: true, count: countFromList(r.json) };
  }
  if (cp.category === "local_runtime") {
    const base = cp.baseUrl || "http://127.0.0.1:8080";
    const r = await getJson(base.replace(/\/$/, "") + "/v1/models", apiKey ? { Authorization: "Bearer " + apiKey } : {});
    if (!r.ok) return { ok: false, count: 0, error: r.error || "local runtime not reachable" };
    return { ok: true, count: countFromList(r.json) };
  }

  // Cloud / router / OpenAI-compatible — need a real key.
  if (!apiKey) return { ok: false, count: 0, error: "no API key in vault — connect with a key first" };

  if (adapter === "http_anthropic" || cp.id === "anthropic") {
    const r = await getJson("https://api.anthropic.com/v1/models", { "x-api-key": apiKey, "anthropic-version": "2023-06-01" });
    if (!r.ok) return { ok: false, count: 0, error: r.error || "auth failed (" + r.status + ")" };
    return { ok: true, count: countFromList(r.json) };
  }

  // Default: OpenAI-compatible /models with Bearer auth (openai, openrouter, groq, mistral, deepseek, together, …).
  const base = (cp.baseUrl || "https://api.openai.com/v1").replace(/\/$/, "");
  const url = base.endsWith("/models") ? base : base + (base.includes("/v1") ? "/models" : "/v1/models");
  const r = await getJson(url, { Authorization: "Bearer " + apiKey });
  if (!r.ok) return { ok: false, count: 0, error: r.error || "auth failed (" + r.status + ")" };
  return { ok: true, count: countFromList(r.json) };
}
