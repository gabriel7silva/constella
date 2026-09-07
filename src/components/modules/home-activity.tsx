"use client";

import { useT } from "@/lib/i18n-context";
import { Avatar } from "@/components/ui/avatar";
import { timeAgo } from "@/lib/timeago";
import type { ActivityRow } from "@/server/home";

// Recent activity as a tidy timeline grouped by calendar day (Today / Yesterday / date), instead of
// a flat raw log. Long targets are clamped (full text on hover).
export function HomeActivity({ rows }: { rows: ActivityRow[] }) {
  const t = useT();
  if (rows.length === 0) return <div className="home-empty">{t("home.recentEmpty")}</div>;

  function label(at: Date): string {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const that = new Date(at); that.setHours(0, 0, 0, 0);
    const diff = Math.round((today.getTime() - that.getTime()) / 86400000);
    if (diff <= 0) return t("home.activity.today");
    if (diff === 1) return t("home.activity.yesterday");
    return that.toLocaleDateString();
  }

  const groups: { label: string; rows: ActivityRow[] }[] = [];
  let curKey = "";
  for (const r of rows) {
    const at = r.at ? new Date(r.at) : null;
    const key = at ? at.toDateString() : "—";
    if (key !== curKey) { groups.push({ label: at ? label(at) : "—", rows: [] }); curKey = key; }
    groups[groups.length - 1].rows.push(r);
  }

  return (
    <div className="timeline">
      {groups.map((g, gi) => (
        <div className="tl-day" key={gi}>
          <div className="tl-day-label">{g.label}</div>
          {g.rows.map((r) => (
            <div className="tl-row" key={r.id} title={r.target}>
              {r.agentName ? <Avatar name={r.agentName} color={r.agentColor ?? "var(--accent)"} size={20} health={r.agentHealth} /> : <span className="tl-sys" />}
              <span className="tl-text"><b>{r.agentName ?? t("home.activity.system")}</b> {r.action} <span className="tl-target">{r.target}</span></span>
              <span className="tl-time">{r.at ? timeAgo(new Date(r.at)) : ""}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
