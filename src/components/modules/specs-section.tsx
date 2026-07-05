"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { SpecApprove } from "@/components/modules/plan-gate";
import { useT } from "@/lib/i18n-context";
import { formatWhen } from "@/lib/when";

type Spec = { id: string; key: string; title: string; summary: string; authorId: string | null; approved: boolean; status: string; createdAt: Date | string | null; updatedAt: Date | string | null };
type Issue = { specId: string | null };
type Agent = { id: string; name: string; color: string; role: string };

// Stable filter enum keys; visible labels translate at render via planner.specFilter.<key>.
const FILTERS = ["active", "approved", "draft", "cancelled", "archived", "all"] as const;

function match(s: Spec, f: string): boolean {
  switch (f) {
    case "all": return true;
    case "approved": return s.status === "active" && s.approved;
    case "draft": return s.status === "active" && !s.approved;
    case "cancelled": return s.status === "cancelled";
    case "archived": return s.status === "archived";
    default: return s.status === "active"; // "active"
  }
}

/** Specs grid with a status filter (Approved / Draft / Cancelled / Archived). Cancelled &
 *  archived specs (from a cancelled/archived goal) are hidden by default so the Planner only
 *  shows live work — they're reachable via the filter. */
export function SpecsSection({ specs, issues, agents }: { specs: Spec[]; issues: Issue[]; agents: Agent[] }) {
  const t = useT();
  const [filter, setFilter] = useState<string>("active");
  const byId = Object.fromEntries(agents.map((a) => [a.id, a]));
  const shown = specs.filter((s) => match(s, filter));
  return (
    <>
      <div className="view-section-title" style={{ marginTop: 22, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span>{t("planner.specs.title")} <span style={{ fontWeight: 400, color: "var(--text-faint)" }}>· {t("planner.specs.from")}</span></span>
        <div className="seg" style={{ marginLeft: "auto" }}>
          {FILTERS.map((f) => <button key={f} className={"seg-opt" + (filter === f ? " on" : "")} onClick={() => setFilter(f)}>{t(`planner.specFilter.${f}`)}</button>)}
        </div>
      </div>
      {shown.length === 0 ? (
        <div className="card"><div className="muted">{filter === "all" ? t("planner.specs.emptyAll") : t("planner.specs.emptyFiltered", { filter: t(`planner.specFilter.${filter}`) })}</div></div>
      ) : (
        <div className="cards-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          {shown.map((s) => {
            const author = s.authorId ? byId[s.authorId] : null;
            const issueCount = issues.filter((i) => i.specId === s.id).length;
            const role = author?.role ?? "—";
            const cancelled = s.status !== "active";
            return (
              <div className="card" key={s.id} style={cancelled ? { opacity: 0.6 } : undefined}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span className="chip-sm">{s.key}</span>
                  <span style={{ fontWeight: 700, fontSize: 13.5, color: "var(--text)", flex: 1 }}>{s.title}</span>
                  {cancelled && <span className="pill" style={{ fontSize: 10 }}>{t(`planner.specFilter.${s.status}`)}</span>}
                  {author && <Avatar name={author.name} color={author.color} size={20} />}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 8 }}>{s.summary}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ fontSize: 11, color: "var(--text-faint)", flex: 1 }}>
                    {role} · {t("planner.specs.issueCount", { n: issueCount })} · <span style={{ color: "var(--accent)" }}>specs/{s.key}.md</span>
                    {s.createdAt && <> · {formatWhen(s.createdAt)}</>}
                  </div>
                  {!cancelled && <SpecApprove specId={s.id} specKey={s.key} approved={s.approved} />}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
