"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { Avatar } from "@/components/ui/avatar";
import { StatusDot } from "@/components/ui/status-dot";
import { cancelGoal, reopenGoal, archiveGoal, restoreGoal } from "@/server/actions/work-actions";
import { formatWhen } from "@/lib/when";
import { useT } from "@/lib/i18n-context";
import type { GoalRollup } from "@/server/progress";

function GoalActions({ id, status, progress }: { id: string; status: string; progress: number }) {
  const t = useT();
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (fn: (id: string) => Promise<unknown>) => start(async () => { await fn(id); router.refresh(); });
  // Cancel only makes sense while work is genuinely in flight: active AND not yet complete.
  // A 100% / done goal can only be Archived.
  const canCancel = status === "active" && progress < 100;
  return (
    <div className="goal-actions">
      {canCancel && <button className="goal-act danger" disabled={pending} onClick={() => { if (confirm(t("goals.cancelConfirm"))) run(cancelGoal); }}><Icon name="close" size={12} /> {t("common.cancel")}</button>}
      {(status === "active" || status === "cancelled" || status === "done") && <button className="goal-act" disabled={pending} onClick={() => run(archiveGoal)}><Icon name="collapse" size={12} /> {t("goals.archive")}</button>}
      {status === "cancelled" && <button className="goal-act accent" disabled={pending} onClick={() => run(reopenGoal)}><Icon name="refresh" size={12} /> {t("goals.reopen")}</button>}
      {status === "archived" && <button className="goal-act accent" disabled={pending} onClick={() => run(restoreGoal)}><Icon name="refresh" size={12} /> {t("goals.restore")}</button>}
    </div>
  );
}

const STATUS_CLASS: Record<string, string> = { active: "active", done: "done", cancelled: "cancelled", archived: "archived" };

/** Goal = a unit of work. Shows the objective, its child issues with per-issue % (from
 *  their TODO checklist) and per-agent/status, and the rolled-up goal %. Filters + collapse. */
export function GoalTree({ goals }: { goals: GoalRollup[] }) {
  const t = useT();
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const agentOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of goals) for (const i of g.issues) if (i.assignee) m.set(i.assignee.handle, i.assignee.name);
    return [...m.entries()];
  }, [goals]);

  const shown = goals.filter((g) => statusFilter === "all" || g.status === statusFilter);

  if (goals.length === 0) return <div className="muted" style={{ padding: 30, textAlign: "center" }}>{t("goals.empty")}</div>;

  return (
    <div className="goal-tree">
      <div className="goal-filters">
        <div className="seg">
          {["active", "done", "cancelled", "archived", "all"].map((s) => (
            <button key={s} className={"seg-opt" + (statusFilter === s ? " on" : "")} onClick={() => setStatusFilter(s)}>{t(`goals.status.${s}`)}</button>
          ))}
        </div>
        {agentOptions.length > 0 && (
          <select className="goal-agent-sel" value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)}>
            <option value="all">{t("goals.allAgents")}</option>
            {agentOptions.map(([h, n]) => <option key={h} value={h}>{n}</option>)}
          </select>
        )}
      </div>

      {shown.length === 0 && <div className="muted" style={{ padding: 24, textAlign: "center" }}>{t("goals.emptyFiltered", { status: t(`goals.status.${statusFilter}`).toLowerCase() })}</div>}

      {shown.map((g) => {
        const isCollapsed = collapsed.has(g.id);
        const issues = g.issues.filter((i) => agentFilter === "all" || i.assignee?.handle === agentFilter);
        const doneN = g.issues.filter((i) => i.progress >= 100).length;
        return (
          <div className="goal-node" key={g.id}>
            <div className={"goal-card status-" + (STATUS_CLASS[g.status] ?? "active")}>
              <div className="goal-head">
                <button className="side-act" title={isCollapsed ? t("goals.expand") : t("goals.collapse")} style={{ flex: "0 0 auto" }}
                  onClick={() => setCollapsed((s) => { const n = new Set(s); n.has(g.id) ? n.delete(g.id) : n.add(g.id); return n; })}>
                  <Icon name={isCollapsed ? "chevronRight" : "chevronDown"} size={13} />
                </button>
                <Icon name="target" size={15} style={{ color: "var(--accent)", flex: "0 0 auto" }} />
                <span className="goal-title">{g.title}</span>
                <span className={"goal-status-badge " + (STATUS_CLASS[g.status] ?? "active")}>{t(`goals.status.${g.status}`)}</span>
                <span className="chip-sm">{g.progress}%</span>
              </div>
              {g.description && <div className="goal-desc">{g.description}</div>}
              <div className="pbar"><span style={{ width: g.progress + "%" }} /></div>
              <div className="goal-bottom">
                <div className="goal-meta">
                  {t("goals.meta.complete", { done: doneN, total: g.issues.length })} · {t(g.issues.length !== 1 ? "goals.meta.childIssues.other" : "goals.meta.childIssues.one", { n: g.issues.length })}
                  {(() => {
                    const stamp = g.status === "done" ? [t("goals.stamp.done"), g.doneAt] : g.status === "cancelled" ? [t("goals.stamp.cancelled"), g.cancelledAt] : g.status === "archived" ? [t("goals.stamp.archived"), g.archivedAt] : [t("goals.stamp.created"), g.createdAt];
                    return stamp[1] ? <span style={{ color: "var(--text-faint)" }}> · {stamp[0] as string} {formatWhen(stamp[1] as Date)}</span> : null;
                  })()}
                </div>
                <GoalActions id={g.id} status={g.status} progress={g.progress} />
              </div>

              {!isCollapsed && (
                <div className="goal-issues">
                  {issues.length === 0 && <div className="goal-issue-empty">{agentFilter !== "all" ? t("goals.noIssuesForAgent") : t("goals.noIssuesYet")}</div>}
                  {issues.map((i) => (
                    <div className="goal-issue" key={i.id}>
                      <span className="gi-key">{i.key}</span>
                      <div className="gi-main">
                        <div className="gi-title-row">
                          <span className="gi-title">{i.title}</span>
                          {i.assignee && <Avatar name={i.assignee.name} color={i.assignee.color} size={18} />}
                          <span className={"gi-col col-" + i.col}><StatusDot status={i.col === "doing" ? "working" : i.col === "blocked" ? "blocked" : i.col === "review" ? "review" : "idle"} /> {t(`goals.col.${i.col}`)}</span>
                        </div>
                        <div className="gi-prog">
                          <span className="gi-bar"><span style={{ width: i.progress + "%" }} /></span>
                          <span className="gi-pct">{i.progress}%{i.steps.total > 0 ? ` · ${t("goals.todos", { done: i.steps.done, total: i.steps.total })}` : ""}</span>
                          {i.updatedAt && <span style={{ fontSize: 10, color: "var(--text-faint)", marginLeft: "auto" }}>{formatWhen(i.updatedAt)}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
