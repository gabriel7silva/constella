import { EventEmitter } from "node:events";

/**
 * In-process event bus — a best-effort, same-process NUDGE so the SSE stream
 * (`/api/stream`) can flush new rows the instant they're written by THIS Next.js
 * process (operator sends, the browser autoTick loop, chat replies). It is NOT a
 * source of truth: the headless worker writes the same SQLite DB in a SEPARATE
 * process and never fires this bus, so the SSE route ALSO tails the DB on an
 * interval. Correctness lives in the DB tail; this bus only cuts latency.
 *
 * Persisted on globalThis so Next.js dev hot-reloads don't create a second
 * emitter (which would split publishers from subscribers).
 */
const g = globalThis as unknown as { __constellaBus?: EventEmitter };
const emitter = g.__constellaBus ?? (g.__constellaBus = new EventEmitter());
// Finite (not 0): one listener per open SSE connection routinely exceeds Node's
// default 10, but keep a ceiling so a real teardown leak still surfaces as a warning
// instead of being silently unbounded.
emitter.setMaxListeners(64);

/** Signal that a workspace just had new events/messages written. */
export function wake(workspaceId: string): void {
  emitter.emit("wake", workspaceId);
}

/** Subscribe to wakes for one workspace. Returns an unsubscribe fn (call on teardown). */
export function onWake(workspaceId: string, cb: () => void): () => void {
  const handler = (wsId: string) => { if (wsId === workspaceId) cb(); };
  emitter.on("wake", handler);
  return () => { emitter.off("wake", handler); };
}
