import "server-only";
import type { CliResult, StreamEvent } from "@/server/adapters/cli";

/**
 * HTTP (API-key) model adapters for CHAT/reasoning — Gemini (Google REST) and any
 * OpenAI-compatible endpoint. Streams text deltas + books REAL token usage. These power
 * conversational replies only; agentic FILE-EDITING task execution stays on the CLIs
 * (claude/codex/gemini-cli), which is why the runner never routes here.
 *
 * No fabrication: usd is computed from real returned usage × an approximate price table;
 * unknown models book real tokens with usd 0 (never a made-up cost).
 */

export type HttpRuntime = { provider: "openai" | "google"; baseUrl: string; apiKey: string; model: string };

// Pinned to globalThis for the same reason as cli.ts's registry: `registerHttpRun` runs in the
// server-action bundle, `abortHttpRun` in the /api/runs route-handler bundle — Next duplicates the
// module per bundle, so a plain `new Map()` would leave the route's view empty. One shared instance.
type HttpRegistry = { active: Map<string, AbortController>; aborted: Set<string>; timers: Map<string, NodeJS.Timeout> };
const hg = globalThis as unknown as { __constellaHttpRuns?: HttpRegistry };
const HREG: HttpRegistry = hg.__constellaHttpRuns ??= { active: new Map(), aborted: new Set(), timers: new Map() };
const ACTIVE = HREG.active;
const ABORTED = HREG.aborted;
const ABORTED_TTL_MS = 5 * 60_000;
const ABORT_TIMERS = HREG.timers;

function rememberAborted(token: string): void {
  ABORTED.add(token);
  const prev = ABORT_TIMERS.get(token);
  if (prev) clearTimeout(prev);
  const timer = setTimeout(() => { ABORTED.delete(token); ABORT_TIMERS.delete(token); }, ABORTED_TTL_MS);
  timer.unref?.();
  ABORT_TIMERS.set(token, timer);
}

function forgetAborted(token: string): void {
  ABORTED.delete(token);
  const timer = ABORT_TIMERS.get(token);
  if (timer) clearTimeout(timer);
  ABORT_TIMERS.delete(token);
}

/** Abort an in-flight HTTP model stream, or mark a not-yet-started token so it stops on registration. */
export function abortHttpRun(token: string): boolean {
  rememberAborted(token);
  const ctrl = ACTIVE.get(token);
  if (!ctrl) return false;
  ACTIVE.delete(token);
  ctrl.abort();
  return true;
}

function registerHttpRun(token: string | undefined, ctrl: AbortController): boolean {
  if (!token) return false;
  if (ABORTED.has(token)) return true;
  ACTIVE.set(token, ctrl);
  return false;
}

function unregisterHttpRun(token?: string): void {
  if (!token) return;
  ACTIVE.delete(token);
  forgetAborted(token);
}

export function listActiveHttpTokens(): string[] {
  return Array.from(ACTIVE.keys());
}

/**
 * LAST-RESORT USD per 1M tokens (input/output), matched by model-id PREFIX. The real numbers come from the
 * models.dev catalog (`CatalogModel.inputCost`/`outputCost`); this table only catches a run whose model isn't
 * in the catalog. A miss books `usd: 0` — honest-but-blank, never a wrong number.
 *
 * It rots fast, and it had: through 0.9.1 it still listed only gpt-4o / gemini-1.5, so EVERY current model
 * missed and every HTTP run recorded zero cost. Matching is longest-prefix-wins (see `cost` below).
 * Refreshed 2026-09-07.
 */
const PRICE: Record<string, [number, number]> = {
  "gpt-6": [10, 50], "gpt-5.6-sol": [4, 20], "gpt-5.6-terra": [2, 12], "gpt-5.6-luna": [0.2, 1.2], "gpt-5.6": [4, 20],
  "gemini-3.8": [0.75, 3.75], "gemini-3.7": [0.75, 3.75], "gemini-3.5-flash-lite": [0.3, 2.5], "gemini-3.5": [1.5, 9], "gemini-3.1-pro": [2, 12],
  "grok-4.6": [2, 6], "grok-4.5": [2, 6], "grok-4.3": [1.25, 2.5], "grok-build": [1, 2],
  "claude-fable": [10, 50], "claude-opus": [5, 25], "claude-sonnet": [2, 10], "claude-haiku": [1, 5],
};
function cost(model: string, inTok: number, outTok: number): number {
  const id = model.toLowerCase();
  // LONGEST prefix wins, so "gpt-5.6-luna" can't be priced by the shorter "gpt-5.6" entry that happens to
  // sit earlier in the object. (Previously this took the first match, making key order silently load-bearing.)
  const key = Object.keys(PRICE).filter((k) => id.startsWith(k)).sort((a, b) => b.length - a.length)[0];
  if (!key) return 0;
  const [pin, pout] = PRICE[key];
  return (inTok / 1e6) * pin + (outTok / 1e6) * pout;
}

function fail(provider: string, model: string, ms: number, error: string, cancelled = false): CliResult {
  return { ok: false, text: "", usd: 0, inputTokens: 0, outputTokens: 0, durationMs: ms, binary: provider, model, error, cancelled };
}

/** Stream a chat completion from an HTTP model, emitting `text` deltas + a final `done`. */
export async function runHttpStream(prompt: string, rt: HttpRuntime, opts: { timeoutMs?: number; token?: string }, onEvent: (e: StreamEvent) => void): Promise<CliResult> {
  const start = Date.now();
  const base = rt.baseUrl.replace(/\/$/, "");
  const isG = rt.provider === "google";
  const url = isG
    ? `${base}/models/${encodeURIComponent(rt.model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(rt.apiKey)}`
    : `${base}/chat/completions`;
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (!isG && rt.apiKey) headers.authorization = `Bearer ${rt.apiKey}`; // local llama.cpp needs no key
  const body = isG
    ? { contents: [{ role: "user", parts: [{ text: prompt }] }] }
    : { model: rt.model, messages: [{ role: "user", content: prompt }], stream: true, stream_options: { include_usage: true } };
  const ctrl = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; ctrl.abort(); }, opts.timeoutMs ?? 180_000);
  const wasCancelled = () => (opts.token ? ABORTED.has(opts.token) : false);
  const finish = () => { clearTimeout(timeout); unregisterHttpRun(opts.token); };

  if (registerHttpRun(opts.token, ctrl)) {
    finish();
    return fail(rt.provider, rt.model, Date.now() - start, "stopped by operator", true);
  }

  let res: Response;
  try {
    res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal: ctrl.signal });
  } catch (e) {
    const cancelled = wasCancelled();
    finish();
    return fail(rt.provider, rt.model, Date.now() - start, cancelled ? "stopped by operator" : timedOut ? "timed out" : String(e instanceof Error ? e.message : e), cancelled);
  }
  if (!res.ok || !res.body) {
    const txt = await res.text().catch(() => "");
    finish();
    return fail(rt.provider, rt.model, Date.now() - start, `http ${res.status} ${txt.slice(0, 200)}`);
  }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", text = "", lastEmit = 0, inTok = 0, outTok = 0;
  const flush = () => { if (text.length > lastEmit) { onEvent({ kind: "text", detail: text.slice(lastEmit, lastEmit + 8000) }); lastEmit = text.length; } };

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (payload === "[DONE]") continue;
        try {
          const j = JSON.parse(payload);
          if (isG) {
            const t = j.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
            if (t) { text += t; if (text.length - lastEmit >= 120) flush(); }
            const u = j.usageMetadata;
            if (u) { inTok = u.promptTokenCount ?? inTok; outTok = u.candidatesTokenCount ?? outTok; }
          } else {
            const t = j.choices?.[0]?.delta?.content ?? "";
            if (t) { text += t; if (text.length - lastEmit >= 120) flush(); }
            if (j.usage) { inTok = j.usage.prompt_tokens ?? inTok; outTok = j.usage.completion_tokens ?? outTok; }
          }
        } catch { /* skip partial/non-JSON SSE line */ }
      }
    }
  } catch (e) {
    const cancelled = wasCancelled();
    finish();
    flush(); onEvent({ kind: "done" });
    return { ok: !cancelled && !!text, text, usd: cost(rt.model, inTok, outTok), inputTokens: inTok, outputTokens: outTok, durationMs: Date.now() - start, binary: rt.provider, model: rt.model, error: cancelled ? "stopped by operator" : text ? undefined : String(e instanceof Error ? e.message : e), cancelled };
  }
  finish();
  flush(); onEvent({ kind: "done" });
  return { ok: !!text.trim(), text, usd: cost(rt.model, inTok, outTok), inputTokens: inTok, outputTokens: outTok, durationMs: Date.now() - start, binary: rt.provider, model: rt.model, error: text.trim() ? undefined : "empty response" };
}
