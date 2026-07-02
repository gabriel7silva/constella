import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { agent, activity, notification } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";
import { readWorkspaceFile } from "@/lib/fs-workspace";
import { ViewShell } from "@/components/shell/view-shell";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { StatusDot } from "@/components/ui/status-dot";
import { ValidatePanel } from "@/components/modules/validate-panel";
import { timeAgo } from "@/lib/timeago";
import { getT } from "@/lib/i18n-server";

const HCOLOR: Record<"alive" | "stale" | "down", string> = { alive: "var(--sx-string)", stale: "var(--sx-number)", down: "var(--sx-keyword)" };

export default async function PulsePage() {
  const t = await getT();
  const { org, workspace } = await requireWorkspace();
  const [agents, acts, notifs] = await Promise.all([
    db.select().from(agent).where(eq(agent.workspaceId, workspace.id)),
    db.select().from(activity).where(eq(activity.workspaceId, workspace.id)).orderBy(desc(activity.at)).limit(20),
    db.select().from(notification).where(eq(notification.workspaceId, workspace.id)).orderBy(desc(notification.createdAt)).limit(12),
  ]);
  const byId = Object.fromEntries(agents.map((a) => [a.id, a]));
  const sysHealth = readWorkspaceFile(org.id, "Reports/system-health.md") ?? "";
  const count = (h: string) => agents.filter((a) => a.health === h).length;
  const working = agents.filter((a) => a.status !== "idle").length;

  return (
    <ViewShell title="Pulse" sub={t("pulse.sub")} right={<ValidatePanel />}>
      <div className="dash-grid" style={{ marginBottom: 18 }}>
        <div className="dash-card" style={{ gridColumn: "span 3" }}><h3>{t("pulse.agents")}</h3><div className="kpi">{agents.length}</div></div>
        <div className="dash-card" style={{ gridColumn: "span 3" }}><h3>{t("pulse.alive")}</h3><div className="kpi" style={{ color: HCOLOR.alive }}>{count("alive")}</div></div>
        <div className="dash-card" style={{ gridColumn: "span 3" }}><h3>{t("pulse.stale")}</h3><div className="kpi" style={{ color: HCOLOR.stale }}>{count("stale")}</div></div>
        <div className="dash-card" style={{ gridColumn: "span 3" }}><h3>{t("pulse.down")}</h3><div className="kpi" style={{ color: HCOLOR.down }}>{count("down")}</div></div>
      </div>

      <div className="view-section-title">{t("pulse.agentHealth")} <span className="muted" style={{ fontWeight: 400 }}>· {t("pulse.workingNow", { n: working })}</span></div>
      {agents.map((a) => (
        <div className="lrow" key={a.id}>
          <Avatar name={a.name} color={a.color} size={28} health={a.health} />
          <div className="lr-main">
            <div className="lr-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>{a.name} <span className="muted">· {a.role}</span> <StatusDot status={a.status} label /></div>
            <div className="lr-sub">{t("pulse.lastPulse")} {a.lastPulse ? timeAgo(a.lastPulse) : t("pulse.never")}</div>
          </div>
          <span className="pill" style={{ background: HCOLOR[a.health] + "22", color: HCOLOR[a.health] }}>{a.health}</span>
        </div>
      ))}

      <div className="view-section-title" style={{ marginTop: 24 }}>{t("pulse.liveActivity")} <span className="muted" style={{ fontWeight: 400 }}>· {t("pulse.liveActivitySub")}</span></div>
      {acts.length === 0 && <div className="muted" style={{ fontSize: 12.5, padding: "2px 1px" }}>{t("pulse.noActivity")}</div>}
      {acts.map((ev) => {
        const a = ev.agentId ? byId[ev.agentId] : null;
        return (
          <div className="lrow" key={ev.id}>
            {a ? <Avatar name={a.name} color={a.color} size={24} /> : <div className="vh-icon" style={{ width: 24, height: 24, flex: "0 0 24px" }} />}
            <div className="lr-main">
              <div className="lr-title" style={{ fontSize: 12.5 }}>{a ? a.name : t("pulse.system")} <span className="muted" style={{ fontWeight: 400 }}>{ev.action}</span></div>
              <div className="lr-sub">{ev.target}</div>
            </div>
            <span className="muted" style={{ fontSize: 11 }}>{timeAgo(ev.at)}</span>
          </div>
        );
      })}

      <div className="view-section-title" style={{ marginTop: 24 }}>{t("pulse.notifications")}</div>
      {notifs.length === 0 && <div className="muted" style={{ fontSize: 12.5, padding: "2px 1px" }}>{t("pulse.noNotifications")}</div>}
      {notifs.map((n) => (
        <div className="lrow" key={n.id} style={{ opacity: n.read ? 0.6 : 1 }}>
          <div className="vh-icon" style={{ width: 24, height: 24, flex: "0 0 24px" }}><Icon name={n.kind === "done" ? "check" : n.kind === "security" ? "shield" : n.kind === "review" ? "git" : "bell"} size={12} /></div>
          <div className="lr-main"><div className="lr-title" style={{ fontSize: 12.5 }}>{n.text}</div>{n.detail && <div className="lr-sub">{n.detail}</div>}</div>
          <span className="muted" style={{ fontSize: 11 }}>{timeAgo(n.createdAt)}</span>
        </div>
      ))}

      <div className="view-section-title" style={{ marginTop: 24 }}>{t("pulse.systemHealth")} <span className="muted" style={{ fontWeight: 400 }}>· Reports/system-health.md</span></div>
      <div className="card"><pre className="mono" style={{ whiteSpace: "pre-wrap", fontSize: 12, margin: 0 }}>{sysHealth || t("pulse.noSweep")}</pre></div>
    </ViewShell>
  );
}
