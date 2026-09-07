"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { useT } from "@/lib/i18n-context";

type Item = { id: string; time: string; agentId: string | null; agentName: string | null; agentColor: string | null; action: string; target: string | null };
type Ag = { id: string; name: string; color: string };

export function ActivityTimeline({ items, agents }: { items: Item[]; agents: Ag[] }) {
  const t = useT();
  const [filter, setFilter] = useState<string>("all");
  const shown = filter === "all" ? items : items.filter((i) => i.agentId === filter);
  return (
    <>
      <div className="seg" style={{ width: "fit-content", maxWidth: "100%", marginBottom: 16, flexWrap: "wrap", overflowX: "auto" }}>
        <button className={"seg-opt" + (filter === "all" ? " on" : "")} style={{ flex: "0 0 auto", padding: "6px 12px" }} onClick={() => setFilter("all")}>{t("common.all")}</button>
        {agents.map((a) => (
          <button key={a.id} className={"seg-opt" + (filter === a.id ? " on" : "")} style={{ flex: "0 0 auto", padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: 6 }} onClick={() => setFilter(a.id)}>
            <Avatar name={a.name} color={a.color} size={16} /> {a.name}
          </button>
        ))}
      </div>
      <div className="timeline">
        {shown.map((a) => (
          <div className="tl-item" key={a.id}>
            <span className="tl-time">{a.time}</span>
            {a.agentName ? <Avatar name={a.agentName} color={a.agentColor ?? "#888"} size={28} /> : <span style={{ width: 28, height: 28, borderRadius: 8, background: "var(--bg-active)", flex: "0 0 28px" }} />}
            <span className="tl-text"><b>{a.agentName ?? t("activity.system")}</b> {a.action}{a.target && <span className="muted"> · {a.target}</span>}</span>
          </div>
        ))}
        {shown.length === 0 && <div className="muted" style={{ padding: 30, textAlign: "center" }}>{filter !== "all" ? t("activity.empty.agent") : t("activity.empty.all")}</div>}
      </div>
    </>
  );
}
