import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db";
import { cronRun, routine, agent } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";
import { getT } from "@/lib/i18n-server";
import { ViewShell } from "@/components/shell/view-shell";
import { Icon } from "@/components/ui/icon";
import { Avatar } from "@/components/ui/avatar";
import { timeAgo } from "@/lib/timeago";

// Translate the four standard frequency enum values; pass any custom/agent-written freq through.
const STD_FREQS = new Set(["Hourly", "Daily", "Weekly", "Monthly"]);
function freqLabel(freq: string, t: (key: string, vars?: Record<string, string | number>) => string): string {
  return STD_FREQS.has(freq) ? t(`routines.freq.${freq}`) : freq;
}

export default async function CronPage() {
  const t = await getT();
  const { workspace } = await requireWorkspace();
  // Upcoming schedule = the workspace's ENABLED routines (the recurring automations); completion
  // history = real cron_run rows the runner writes as it executes tasks.
  const jobs = await db.select().from(routine).where(and(eq(routine.workspaceId, workspace.id), eq(routine.enabled, true)));
  const runs = await db.select().from(cronRun).where(eq(cronRun.workspaceId, workspace.id)).orderBy(desc(cronRun.at)).limit(100);
  const agents = await db.select().from(agent).where(eq(agent.workspaceId, workspace.id));
  const byId = Object.fromEntries(agents.map((a) => [a.id, a]));

  return (
    <ViewShell title={t("mod.cron")} sub={t("cron.sub")}>
      <div className="view-section-title">{t("cron.upcoming")}</div>
      <div className="cards-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        {jobs.length === 0 && <div className="card"><div className="muted">{t("cron.empty")}</div></div>}
        {jobs.map((j) => {
          const a = j.agentId ? byId[j.agentId] : null;
          return (
            <div className="lrow" key={j.id} style={{ marginTop: 0 }}>
              <div className="vh-icon" style={{ width: 34, height: 34, flex: "0 0 34px" }}><Icon name="calendar" size={16} /></div>
              <div className="lr-main"><div className="lr-title">{j.name}</div><div className="lr-sub">{freqLabel(j.freq, t)}{j.cmd ? ` · ${j.cmd}` : ""}</div></div>
              {a && <Avatar name={a.name} color={a.color} size={22} />}
            </div>
          );
        })}
      </div>

      <div className="view-section-title" style={{ marginTop: 26 }}>{t("cron.history")}</div>
      <div className="card" style={{ overflowX: "auto", padding: 0 }}>
        <table className="tbl tbl">
          <thead><tr><th>{t("cron.colTask")}</th><th>{t("cron.colCompletedBy")}</th><th>{t("cron.colWhen")}</th><th>{t("cron.colResult")}</th></tr></thead>
          <tbody>
            {runs.map((r) => {
              const a = r.agentId ? byId[r.agentId] : null;
              return (
                <tr key={r.id}>
                  <td>{r.task}</td>
                  <td>{a ? <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><Avatar name={a.name} color={a.color} size={20} /> {a.name}</span> : "—"}</td>
                  <td>{timeAgo(r.at)}</td>
                  <td><span className="pill" style={{ background: (r.ok ? "var(--sx-string)" : "var(--sx-keyword)") + "22", color: r.ok ? "var(--sx-string)" : "var(--sx-keyword)" }}>{r.ok ? t("cron.ok") : t("cron.failed")}</span></td>
                </tr>
              );
            })}
            {runs.length === 0 && <tr><td colSpan={4} className="muted" style={{ textAlign: "center", padding: 20 }}>{t("cron.noRuns")}</td></tr>}
          </tbody>
        </table>
      </div>
    </ViewShell>
  );
}
