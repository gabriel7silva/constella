import { eq, and, gte } from "drizzle-orm";
import { db } from "@/db";
import { budget, agent, costEntry } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";
import { ViewShell } from "@/components/shell/view-shell";
import { Icon } from "@/components/ui/icon";
import { Avatar } from "@/components/ui/avatar";
import { CapEditor } from "@/components/modules/cap-editor";
import { getT } from "@/lib/i18n-server";

function level(spent: number, cap: number) {
  const pct = cap > 0 ? Math.min(100, (spent / cap) * 100) : 0;
  const lvl = pct >= 90 ? "crit" : pct >= 70 ? "warn" : "ok";
  const color = lvl === "crit" ? "var(--sx-keyword)" : lvl === "warn" ? "var(--sx-number)" : "var(--sx-string)";
  return { pct, lvl, color };
}
const usd2 = (n: number) => "$" + n.toFixed(2);

function BarChart({ rows, label, color, empty }: { rows: { name: string; usd: number }[]; label: string; color: string; empty: string }) {
  const max = Math.max(0.0001, ...rows.map((r) => r.usd));
  return (
    <div className="card">
      <div className="detail-label">{label}</div>
      {rows.length === 0 && <div className="muted" style={{ fontSize: 12, padding: "6px 0" }}>{empty}</div>}
      {rows.map((r, i) => (
        <div className="barrow" key={i} style={{ gridTemplateColumns: "120px 1fr 56px" }}>
          <span className="bl">{r.name}</span>
          <span className="bt" style={{ width: (r.usd / max) * 100 + "%", background: color }} />
          <span className="bv">${r.usd.toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}

export default async function CostsPage() {
  const t = await getT();
  const { workspace } = await requireWorkspace();
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);

  const [[b], agents, monthCosts, todayCosts] = await Promise.all([
    db.select().from(budget).where(eq(budget.workspaceId, workspace.id)),
    db.select().from(agent).where(eq(agent.workspaceId, workspace.id)),
    db.select().from(costEntry).where(and(eq(costEntry.workspaceId, workspace.id), gte(costEntry.at, monthStart))),
    db.select().from(costEntry).where(and(eq(costEntry.workspaceId, workspace.id), gte(costEntry.at, dayStart))),
  ]);

  const cap = b?.monthlyCapUsd ?? 0;
  const spent = monthCosts.reduce((s, c) => s + c.usd, 0);
  const tokens = monthCosts.reduce((s, c) => s + c.tokens, 0);
  const lvl = level(spent, cap);
  const balance = Math.max(0, cap - spent);
  const tokLabel = tokens >= 1e6 ? (tokens / 1e6).toFixed(2) + "M" : tokens >= 1e3 ? (tokens / 1e3).toFixed(1) + "K" : String(tokens);

  const todayByAgent = new Map<string, number>();
  for (const c of todayCosts) if (c.agentId) todayByAgent.set(c.agentId, (todayByAgent.get(c.agentId) ?? 0) + c.usd);
  // Month spend per agent — the daily bar resets each day (and is $0 on days agents ran on free/local
  // models), so show the month total too: this is where the headline monthly spend is attributed.
  const monthByAgent = new Map<string, number>();
  for (const c of monthCosts) if (c.agentId) monthByAgent.set(c.agentId, (monthByAgent.get(c.agentId) ?? 0) + c.usd);

  const group = (key: "provider" | "model") => {
    const m = new Map<string, number>();
    for (const c of monthCosts) { const k = (c[key] ?? "unknown") || "unknown"; m.set(k, (m.get(k) ?? 0) + c.usd); }
    return [...m.entries()].map(([name, u]) => ({ name, usd: u })).sort((a, z) => z.usd - a.usd);
  };

  return (
    <ViewShell title="Costs" sub={t("costs.sub", { month: monthStart.toLocaleString("en-US", { month: "short", year: "numeric" }) })}>
      <div className="card" style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
          <div className="detail-label" style={{ margin: 0 }}>{t("costs.monthlyBudget")}</div>
          <div style={{ marginLeft: "auto" }}><CapEditor cap={cap} /></div>
        </div>
        <div className="budget-top">
          <span className="budget-spent" style={{ fontSize: 24 }}>{usd2(spent)}</span>
          <span className="budget-cap">{t("costs.capThisMonth", { cap: usd2(cap) })}</span>
          <span className="budget-pct" style={{ background: lvl.color + "22", color: lvl.color }}>{Math.round(lvl.pct)}%</span>
        </div>
        <div className="budget-track" style={{ height: 10 }}><div className="budget-fill" style={{ width: lvl.pct + "%", background: lvl.color }} /></div>
        <div className={"budget-note " + lvl.lvl} style={{ fontSize: 12 }}>
          {lvl.lvl === "ok" ? <Icon name="check" size={13} /> : <Icon name="warn" size={13} />}
          {lvl.lvl === "crit" ? t("costs.noteCrit") : lvl.lvl === "warn" ? t("costs.noteWarn") : t("costs.noteOk")}
          <span style={{ marginLeft: "auto", color: "var(--text-dim)" }}>{t("costs.balance")} <b style={{ color: "var(--text)" }}>{usd2(balance)}</b></span>
        </div>
      </div>

      <div className="dash-grid" style={{ marginBottom: 18 }}>
        <div className="dash-card" style={{ gridColumn: "span 4" }}><h3><Icon name="coins" size={14} /> {t("costs.kpiSpent")}</h3><div className="kpi">{usd2(spent)}</div><div className="kpi-sub">{t("costs.kpiSpentSub", { cap })}</div></div>
        <div className="dash-card" style={{ gridColumn: "span 4" }}><h3><Icon name="check" size={14} /> {t("costs.kpiBalance")}</h3><div className="kpi" style={{ color: lvl.color }}>${balance.toFixed(0)}</div><div className="kpi-sub">{t("costs.kpiBalanceSub")}</div></div>
        <div className="dash-card" style={{ gridColumn: "span 4" }}><h3><Icon name="cpu" size={14} /> {t("costs.kpiTokens")}</h3><div className="kpi">{tokLabel}</div><div className="kpi-sub">{t("costs.kpiTokensSub")}</div></div>
      </div>

      <div className="view-section-title">{t("costs.perAgentTitle")}</div>
      <div className="card" style={{ marginBottom: 18 }}>
        {agents.map((a) => {
          const s = todayByAgent.get(a.id) ?? 0;
          const mo = monthByAgent.get(a.id) ?? 0;
          const al = level(s, a.dailyCapUsd);
          return (
            <div className="budget-row" key={a.id} style={{ gridTemplateColumns: "150px 1fr 170px" }}>
              <span className="br-name" style={{ display: "flex", alignItems: "center", gap: 8 }}><Avatar name={a.name} color={a.color} size={20} /> {a.name}</span>
              <div className="budget-track"><div className="budget-fill" style={{ width: al.pct + "%", background: al.color }} /></div>
              <span className="br-val mono" style={{ textAlign: "right" }}>
                <span style={{ color: al.lvl === "ok" ? "var(--text-dim)" : al.color }}>${s.toFixed(2)}/${a.dailyCapUsd}</span>
                <span style={{ color: "var(--text-faint)" }}>{t("costs.monthAttribution", { mo: mo.toFixed(2) })}</span>
              </span>
            </div>
          );
        })}
      </div>

      <div className="cards-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <BarChart rows={group("provider")} label={t("costs.byProvider")} color="#9a5cff" empty={t("costs.empty")} />
        <BarChart rows={group("model")} label={t("costs.byModel")} color="#4fc9b0" empty={t("costs.empty")} />
      </div>
    </ViewShell>
  );
}
