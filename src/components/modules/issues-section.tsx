"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { useT } from "@/lib/i18n-context";
import { formatWhen } from "@/lib/when";

type Issue = { id: string; key: string; title: string; specId: string | null; prio: string; col: string; status: string; assigneeId: string | null; updatedAt: Date | string | null };
type Spec = { id: string; key: string };
type Agent = { id: string; name: string; color: string };

const PRIO_COLOR: Record<string, string> = { high: "var(--sx-keyword)", med: "#d98a2b", low: "var(--cyan,#6cc7e0)" };
// Stable filter enum keys; visible labels translate at render via planner.issueFilter.<key>.
const FILTERS = ["active", "awaiting", "doing", "review", "blocked", "done", "cancelled", "archived", "all"] as const;

/** A single display state per issue: lifecycle (cancelled/archived) wins over the work column. */
function stateOf(i: Issue): string {
  if (i.status === "cancelled") return "cancelled";
  if (i.status === "archived") return "archived";
  return i.col; // todo|doing|blocked|review|done
}
function match(i: Issue, f: string): boolean {
  const st = stateOf(i);
  switch (f) {
    case "all": return true;
    case "active": return i.status === "active";
    case "awaiting": return i.status === "active" && i.col === "todo";
    case "cancelled": return st === "cancelled";
    case "archived": return st === "archived";
    default: return i.status === "active" && i.col === f; // doing|review|blocked|done
  }
}

/** Issues table with a status filter. Cancelled/archived issues (from a cancelled/archived goal)
 *  are hidden by default — they no longer read as pending. */
export function IssuesSection({ issues, specs, agents }: { issues: Issue[]; specs: Spec[]; agents: Agent[] }) {
  const t = useT();
  const [filter, setFilter] = useState<string>("active");
  const byId = Object.fromEntries(agents.map((a) => [a.id, a]));
  const shown = issues.filter((i) => match(i, filter));
  return (
    <>
      <div className="view-section-title" style={{ marginTop: 22, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span>{t("planner.issues.title")} <span style={{ fontWeight: 400, color: "var(--text-faint)" }}>· {t("planner.issues.brokenFromSpecs", { n: issues.length })}</span></span>
        <div className="seg" style={{ marginLeft: "auto" }}>
          {FILTERS.map((f) => <button key={f} className={"seg-opt" + (filter === f ? " on" : "")} onClick={() => setFilter(f)}>{t(`planner.issueFilter.${f}`)}</button>)}
        </div>
      </div>
      {shown.length === 0 ? (
        <div className="card"><div className="muted">{filter === "all" ? t("planner.issues.emptyAll") : t("planner.issues.emptyFiltered", { filter: t(`planner.issueFilter.${filter}`).toLowerCase() })}</div></div>
      ) : (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>{t("planner.issues.col.id")}</th><th>{t("planner.issues.col.issue")}</th><th>{t("planner.issues.col.spec")}</th><th>{t("planner.issues.col.priority")}</th><th>{t("planner.issues.col.owner")}</th><th>{t("common.status")}</th><th>{t("planner.issues.col.updated")}</th></tr></thead>
            <tbody>
              {shown.map((i) => {
                const a = i.assigneeId ? byId[i.assigneeId] : null;
                const specKey = i.specId ? specs.find((s) => s.id === i.specId)?.key : null;
                const pc = PRIO_COLOR[i.prio] ?? "var(--text-dim)";
                const st = stateOf(i);
                return (
                  <tr key={i.id} style={i.status !== "active" ? { opacity: 0.55 } : undefined}>
                    <td><span className="chip-sm">{i.key}</span></td>
                    <td>{i.title}</td>
                    <td style={{ color: "var(--text-dim)", fontFamily: "var(--mono-font)", fontSize: 11.5 }}>{specKey ?? "—"}</td>
                    <td><span className="pill" style={{ background: pc + "22", color: pc }}>{t(`planner.prio.${i.prio}`)}</span></td>
                    <td><div className="who">{a ? <><Avatar name={a.name} color={a.color} size={18} /> {a.name}</> : "—"}</div></td>
                    <td><span className={"pill issue-" + st}>{t(`planner.issueState.${st}`)}</span></td>
                    <td style={{ color: "var(--text-faint)", fontSize: 11 }}>{formatWhen(i.updatedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
