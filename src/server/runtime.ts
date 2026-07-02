import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { agent, provider } from "@/db/schema";
import { getSecret } from "@/lib/vault";
import { catalogById } from "@/data/providers-catalog";
import { runAgentStream, pickBinary, type CliBinary, type CliResult, type StreamEvent, type Effort } from "@/server/adapters/cli";
import { runHttpStream, type HttpRuntime } from "@/server/adapters/http";

type Ag = typeof agent.$inferSelect;

export type Runtime =
  | { kind: "cli"; binary: CliBinary }
  | { kind: "http"; http: HttpRuntime };

/**
 * Resolve how an agent should run. Default + agentic (file-editing) path is the CLI
 * (subscription, no API key). If the agent is wired to an `http_*` adapter AND that
 * provider is connected with a key, CHAT replies route to the HTTP API instead. The
 * Context Manager already produces a model-agnostic prompt, so either runtime gets the
 * same context. Falls back to CLI if the HTTP provider isn't fully configured.
 */
export async function resolveRuntime(workspaceId: string, a: Ag): Promise<Runtime> {
  const adapter = a.adapter ?? "";
  // Local model — both llama.cpp and Ollama expose an OpenAI-compatible /v1 endpoint on loopback,
  // so we reuse the HTTP adapter (no API key). Chat/reasoning only; agentic file-editing stays on
  // the CLIs. llama.cpp is the primary runtime (:8082); local_ollama is legacy (:11434).
  if (adapter.startsWith("local_")) {
    const base = adapter === "local_ollama"
      ? (process.env.OLLAMA_URL ?? "http://127.0.0.1:11434") + "/v1"
      : (process.env.LLAMACPP_URL ?? "http://127.0.0.1:8082") + "/v1";
    return { kind: "http", http: { provider: "openai", baseUrl: base, apiKey: "", model: a.model || "local" } };
  }
  if (adapter.startsWith("http_")) {
    const [p] = await db.select().from(provider).where(and(eq(provider.workspaceId, workspaceId), eq(provider.adapter, adapter)));
    if (p) {
      const cp = catalogById(p.catalogId);
      const apiKey = await getSecret(workspaceId, `${p.catalogId}_api_key`);
      if (cp?.baseUrl && apiKey) {
        const providerKind = adapter.includes("google") ? "google" : "openai";
        return { kind: "http", http: { provider: providerKind, baseUrl: cp.baseUrl, apiKey, model: a.model } };
      }
    }
    // not configured → fall back to the CLI so the agent still works
  }
  return { kind: "cli", binary: pickBinary(a.adapter, a.model) };
}

/** Run a chat/reasoning turn on whichever runtime the agent resolves to, streaming events. */
export async function runAgentRuntime(
  prompt: string,
  rt: Runtime,
  opts: { orgId: string; model?: string; timeoutMs?: number; effort?: Effort },
  onEvent: (e: StreamEvent) => void,
): Promise<CliResult> {
  if (rt.kind === "http") return runHttpStream(prompt, rt.http, { timeoutMs: opts.timeoutMs }, onEvent);
  return runAgentStream(prompt, { orgId: opts.orgId, binary: rt.binary, model: opts.model, timeoutMs: opts.timeoutMs, effort: opts.effort }, onEvent);
}
