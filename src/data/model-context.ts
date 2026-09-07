/**
 * Per-model context budgets used to drive conversation compaction. A smaller
 * model keeps fewer messages verbatim and gets a more aggressive summary.
 *
 * `window` is the COMPACTION TRIGGER, not the model's real context window, and it is deliberately far
 * below it: the frontier models are now 500K–1M, but raising the trigger to match would mean carrying
 * ~5× more history into every single call. That is a spend decision, not a data refresh, so the budgets
 * stay conservative — only the model FAMILIES are kept current (2026-09-07).
 */
export type ModelWindow = { window: number; keepRecent: number; aggressive: boolean };

export function modelWindow(alias?: string | null): ModelWindow {
  const m = (alias || "").toLowerCase();
  if (m.includes("opus") || m.includes("sonnet") || m.includes("fable")) return { window: 200_000, keepRecent: 16, aggressive: false };
  if (m.includes("haiku")) return { window: 200_000, keepRecent: 12, aggressive: false };
  if (m.startsWith("gpt") || m.includes("codex") || m.startsWith("o3") || m.startsWith("o4")) return { window: 128_000, keepRecent: 12, aggressive: true };
  // Grok Build / Grok 4.x — previously fell into the unknown bucket below and got compacted at 100K.
  if (m.startsWith("grok")) return { window: 128_000, keepRecent: 12, aggressive: true };
  return { window: 100_000, keepRecent: 8, aggressive: true };
}

/** Rough token estimate (~4 chars/token) — enough to decide when to compact. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
