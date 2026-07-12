"use client";

import { useT } from "@/lib/i18n-context";

/** Reasoning-effort levels (low → max). Shared by Agent Studio + the Hire modal. */
export const EFFORTS = ["low", "medium", "high", "max"] as const;
export type EffortLevel = (typeof EFFORTS)[number];

/** The 4-step segmented effort selector (just the chip row — callers supply their own label/wrapper). */
export function EffortChips({ value, onChange }: { value: string; onChange: (v: EffortLevel) => void }) {
  const t = useT();
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {EFFORTS.map((e) => (
        <button
          key={e}
          type="button"
          className="chip-sm"
          style={{ flex: 1, justifyContent: "center", ...(value === e ? { background: "var(--accent)", color: "var(--accent-fg)" } : {}) }}
          onClick={() => onChange(e)}
        >
          {t("agent.effort." + e)}
        </button>
      ))}
    </div>
  );
}
