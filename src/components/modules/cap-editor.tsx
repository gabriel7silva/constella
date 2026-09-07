"use client";

import { useState, useTransition } from "react";
import { setMonthlyCap } from "@/server/budget";
import { Icon } from "@/components/ui/icon";
import { useT } from "@/lib/i18n-context";

/** Monthly cap input — autosaves on blur/Enter. */
export function CapEditor({ cap }: { cap: number }) {
  const t = useT();
  const [v, setV] = useState(cap);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  function save() {
    if (v === cap) return;
    start(async () => { await setMonthlyCap(v); setSaved(true); setTimeout(() => setSaved(false), 1400); });
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {saved && <span className="oauth-ok" style={{ padding: "3px 8px", fontSize: 11 }}><Icon name="check" size={11} /> {t("common.saved")}</span>}
      <span style={{ fontSize: 12, color: "var(--text-dim)" }}>{t("skills.cap.label")}</span>
      <input className="form-input mono" style={{ width: 120 }} value={"$" + v} disabled={pending}
             onChange={(e) => setV(Math.max(0, parseFloat(e.target.value.replace(/[^0-9.]/g, "")) || 0))}
             onBlur={save} onKeyDown={(e) => { if (e.key === "Enter") save(); }} />
    </div>
  );
}
