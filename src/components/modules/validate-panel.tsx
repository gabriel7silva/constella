"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/ui/icon";
import { useT } from "@/lib/i18n-context";
import { validateWorkspace, type ValidationIssue } from "@/server/validate";

type Result = { ok: boolean; issues: ValidationIssue[]; repaired: string[] };

export function ValidatePanel() {
  const t = useT();
  const [pending, start] = useTransition();
  const [res, setRes] = useState<Result | null>(null);
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      {res && (
        <span className="pill" style={{ background: (res.ok ? "var(--sx-string)" : "var(--sx-number)") + "22", color: res.ok ? "var(--sx-string)" : "var(--sx-number)" }}>
          {res.ok ? t("planner.validate.valid") : t("planner.validate.issues", { n: res.issues.length })}{res.repaired.length ? ` · ${t("planner.validate.repaired", { n: res.repaired.length })}` : ""}
        </span>
      )}
      <button className="btn-ghost" disabled={pending} onClick={() => start(async () => setRes(await validateWorkspace()))}>
        <Icon name="shield" size={13} /> {t("planner.validate.validate")}
      </button>
      <button className="btn-accent" disabled={pending} onClick={() => start(async () => setRes(await validateWorkspace({ repair: true })))}>
        <Icon name="refresh" size={13} className={pending ? "sync-spin" : ""} /> {t("planner.validate.repair")}
      </button>
    </div>
  );
}
