import Link from "next/link";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { report, agent } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";
import { ViewShell } from "@/components/shell/view-shell";
import { Icon } from "@/components/ui/icon";
import { Avatar } from "@/components/ui/avatar";
import { timeAgo } from "@/lib/timeago";
import { GenerateReportButton } from "@/components/modules/report-actions";
import { getT } from "@/lib/i18n-server";

export default async function ReportsPage() {
  const t = await getT();
  const { workspace } = await requireWorkspace();
  const reports = await db
    .select()
    .from(report)
    .where(eq(report.workspaceId, workspace.id))
    .orderBy(desc(report.createdAt));
  const agents = await db.select().from(agent).where(eq(agent.workspaceId, workspace.id));
  const byId = Object.fromEntries(agents.map((a) => [a.id, a]));

  return (
    <ViewShell title={t("mod.reports")} sub={t("reports.sub")} right={<GenerateReportButton />}>
      {reports.length === 0 && (
        <div className="card"><div className="muted">{t("reports.empty")}</div></div>
      )}
      {reports.map((r) => {
        const a = r.authorId ? byId[r.authorId] : null;
        return (
          <Link
            href={`/reports/${r.id}`}
            key={r.id}
            className="lrow"
            style={{ cursor: "pointer", textDecoration: "none", color: "inherit" }}
          >
            <div className="vh-icon" style={{ width: 34, height: 34, flex: "0 0 34px" }}>
              <Icon name="doc" size={16} />
            </div>
            <div className="lr-main">
              <div className="lr-title">{r.title}</div>
              <div className="lr-sub">{r.type} · {timeAgo(r.createdAt)}</div>
            </div>
            {a && <Avatar name={a.name} color={a.color} size={22} />}
            <Icon name="chevronRight" size={14} style={{ color: "var(--text-faint)" }} />
          </Link>
        );
      })}
    </ViewShell>
  );
}
