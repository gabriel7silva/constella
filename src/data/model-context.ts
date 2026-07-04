/**
 * Per-model context budgets used to drive conversation compaction. A smaller
 * model keeps fewer messages verbatim and gets a more aggressive summary.
 */
export type ModelWindow = { window: number; keepRecent: number; aggressive: boolean };

export function modelWindow(alias?: string | null): ModelWindow {
  const m = (alias || "").toLowerCase();
  if (m.includes("opus") || m.includes("sonnet")) return { window: 200_000, keepRecent: 16, aggressive: false };
  if (m.includes("haiku")) return { window: 200_000, keepRecent: 12, aggressive: false };
  if (m.startsWith("gpt") || m.includes("codex") || m.startsWith("o3") || m.startsWith("o4")) return { window: 128_000, keepRecent: 12, aggressive: true };
  return { window: 100_000, keepRecent: 8, aggressive: true };
}

/** Rough token estimate (~4 chars/token) — enough to decide when to compact. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
