import { eq } from "drizzle-orm";
import { db } from "@/db";
import { finding, agent } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";
import { orgRoot } from "@/lib/fs-workspace";
import { ViewShell } from "@/components/shell/view-shell";
import { Avatar } from "@/components/ui/avatar";
import { FixButton, RunReviewButton } from "@/components/modules/module-toggles";
import { AgentRunLive } from "@/components/modules/agent-run-live";
import { getT } from "@/lib/i18n-server";

const SEC_COLOR: Record<string, string> = { high: "#e8688f", med: "#f0a35e", low: "#6cc7e0" };

function scoreFor(open: { sev: "high" | "med" | "low" }[]) {
  const penalty = open.reduce((s, f) => s + (f.sev === "high" ? 15 : f.sev === "med" ? 6 : 2), 0);
  const n = Math.max(0, 100 - penalty);
  return n >= 95 ? "A+" : n >= 90 ? "A" : n >= 80 ? "B" : n >= 70 ? "C" : n >= 55 ? "D" : "F";
}

export default async function SecurityPage() {
  const t = await getT();
  const { org, workspace } = await requireWorkspace();
  const [findings, agents] = await Promise.all([
    db.select().from(finding).where(eq(finding.workspaceId, workspace.id)),
    db.select().from(agent).where(eq(agent.workspaceId, workspace.id)),
  ]);
  const cyber = agents.find((a) => a.handle === "whitfield") ?? agents.find((a) => /cyber|sec/i.test(a.role)) ?? agents[0];
  const open = findings.filter((f) => f.status === "open");
  const fixed = findings.filter((f) => f.status === "fixed");
  const score = scoreFor(open as { sev: "high" | "med" | "low" }[]);
  const lastRun = workspace.settings?.lastSecurityRun;
  const lastRunLabel = lastRun ? new Date(lastRun).toLocaleString() : t("security.neverRun");

  return (
    <ViewShell title="Security" sub={t("security.sub", { lastRun: lastRunLabel })} right={<RunReviewButton />}>
      {cyber && (
        <div className="agent-do" style={{ marginTop: 0, marginBottom: 16 }}>
          <Avatar name={cyber.name} color={cyber.color} size={30} health={cyber.health} />
          <div style={{ flex: 1 }}>
            <div className="sr-title">{cyber.name} · {t("security.agentRole")}</div>
            <div className="sr-sub">{t("security.agentDesc")}</div>
          </div>
        </div>
      )}

      <div className="kv" style={{ marginBottom: 16 }}><span className="k">{t("security.agentReadsFrom")}</span><span className="v lr-mono mono" style={{ fontSize: 11 }}>{orgRoot(org.id)}</span></div>

      <div className="dash-grid" style={{ marginBottom: 18 }}>
        <div className="dash-card" style={{ gridColumn: "span 3" }}><h3>{t("security.score")}</h3><div className="kpi" style={{ color: open.length === 0 ? "var(--sx-string)" : "var(--sx-number)" }}>{score}</div></div>
        <div className="dash-card" style={{ gridColumn: "span 3" }}><h3>{t("security.high")}</h3><div className="kpi" style={{ color: "#e8688f" }}>{open.filter((f) => f.sev === "high").length}</div><div className="kpi-sub">{t("security.openLabel")}</div></div>
        <div className="dash-card" style={{ gridColumn: "span 3" }}><h3>{t("security.open")}</h3><div className="kpi" style={{ color: "var(--sx-number)" }}>{open.length}</div></div>
        <div className="dash-card" style={{ gridColumn: "span 3" }}><h3>{t("security.fixed")}</h3><div className="kpi" style={{ color: "var(--sx-string)" }}>{fixed.length}</div></div>
      </div>

      <AgentRunLive channel="security" />

      <div className="view-section-title">{t("security.findings")}</div>
      {findings.length === 0 && <div className="card"><div className="muted">{t("security.empty")}</div></div>}
      {findings.map((f) => (
        <div className="finding" key={f.id}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <span className="pill" style={{ background: SEC_COLOR[f.sev] + "22", color: SEC_COLOR[f.sev] }}>{f.sev}</span>
            <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{f.title}</span>
            {f.status === "fixed"
              ? <span className="pill" style={{ background: "var(--sx-string)22", color: "var(--sx-string)" }}>{t("security.fixedPill")}</span>
              : <FixButton id={f.id} />}
          </div>
          {f.file && <div className="mono" style={{ fontSize: 11.5, color: "var(--sx-property)", marginBottom: 6 }}>{f.file}</div>}
          {f.suggestion && <div style={{ fontSize: 12.5, color: "var(--text-dim)" }}><b style={{ color: "var(--text)" }}>{t("security.suggestion")}</b> {f.suggestion}</div>}
        </div>
      ))}
    </ViewShell>
  );
}
