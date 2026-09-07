import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { issue, backlogItem, agent } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";
import { ViewShell } from "@/components/shell/view-shell";
import { Avatar } from "@/components/ui/avatar";
import { NewBacklogButton, IssueCardActions, BacklogRowActions, IssueMoscow, GroomBacklogButton } from "@/components/modules/pm-actions";
import { IssueApprove } from "@/components/modules/plan-gate";
import { getT } from "@/lib/i18n-server";

const MOSCOW_COLOR: Record<string, string> = { Must: "#e8688f", Should: "#e0a44e", Could: "#6cc7e0", "Won't": "#6b7390" };

// Real `issue.col` enum is ["todo","doing","blocked","review","done"]; labels are translated at render via pm.col.*.
const SPRINT_COLUMNS = ["todo", "doing", "blocked", "review", "done"] as const;

function moscowPill(m: string | null | undefined) {
  if (!m) return null;
  const c = MOSCOW_COLOR[m] ?? "#6b7390";
  return <span className="pill" style={{ background: c + "22", color: c }}>{m}</span>;
}

export default async function ProductManagerPage() {
  const t = await getT();
  const { workspace } = await requireWorkspace();
  // Only ACTIVE issues belong on the board — a cancelled/archived goal sets its issues to that status
  // (setGoalChildrenStatus), so they must drop off the PO board, not linger.
  const issues = await db.select().from(issue).where(and(eq(issue.workspaceId, workspace.id), eq(issue.status, "active")));
  const backlog = await db.select().from(backlogItem).where(eq(backlogItem.workspaceId, workspace.id));
  const agents = await db.select().from(agent).where(eq(agent.workspaceId, workspace.id));
  const byId = Object.fromEntries(agents.map((a) => [a.id, a]));

  // The PO/PM who drives this board — real agent, resolved by role or handle. Honest fallback if absent.
  const po = agents.find((a) => /product|\bpo\b|\bpm\b|owner/i.test(a.role)) ?? agents.find((a) => a.handle === "donald") ?? null;

  // Done issues drop off the sprint board 24h after they were finalised (updatedAt is bumped on the
  // move to "done"), so the Done column stays a short "recently shipped" list rather than an endless one.
  const DAY_MS = 86_400_000;

  return (
    <ViewShell title={t("mod.pm")}
      sub={t("pm.sub")}
      right={po
        ? <span className="chip-sm" style={{ display: "flex", alignItems: "center", gap: 6 }}><Avatar name={po.name} color={po.color} size={18} /> @{po.handle}</span>
        : undefined}>
      <div className="view-section-title" style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span>{t("pm.sprintBoard")}</span>
        <span style={{ marginLeft: "auto" }}><GroomBacklogButton /></span>
      </div>
      <div className="kanban kanban-fit">
        {SPRINT_COLUMNS.map((col) => {
          const cards = issues.filter((s) => s.col === col && (col !== "done" || !s.updatedAt || Date.now() - s.updatedAt.getTime() <= DAY_MS));
          return (
            <div className="kan-col" key={col}>
              <div className="kan-col-head">{t(`pm.col.${col}`)}<span className="kc-count">{cards.length}</span></div>
              <div className="kan-cards scroll">
                {cards.map((s) => {
                  const a = s.assigneeId ? byId[s.assigneeId] : null;
                  return (
                    <div className="kan-card" key={s.id}>
                      <div className="kk-title" style={{ marginTop: 0 }}>{s.title}</div>
                      <div className="kk-foot">
                        <IssueMoscow id={s.id} moscow={s.moscow} />
                        {a && <Avatar name={a.name} color={a.color} size={20} />}
                        <span className="chip-sm" style={{ marginLeft: "auto" }}>{t("pm.pts", { n: s.points })}</span>
                        <IssueCardActions id={s.id} col={s.col} />
                      </div>
                      <div className="kk-foot" style={{ marginTop: 6 }}>
                        <IssueApprove issueId={s.id} issueKey={s.key} approved={s.approved} />
                      </div>
                    </div>
                  );
                })}
                {cards.length === 0 && <div className="muted" style={{ fontSize: 11.5, padding: "2px 1px" }}>{t("pm.noCards")}</div>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="view-section-title" style={{ marginTop: 26, display: "flex", alignItems: "center", gap: 12 }}>
        <span>{t("pm.backlog")}</span>
        <span style={{ marginLeft: "auto" }}><NewBacklogButton /></span>
      </div>
      {backlog.length === 0 && <div className="muted" style={{ fontSize: 12.5, padding: "2px 1px" }}>{t("pm.noBacklog")}</div>}
      <div className="scroll" style={{ maxHeight: 440, overflowY: "auto" }}>
        {backlog.map((b) => (
          <div className="lrow" key={b.id} style={{ marginBottom: 8 }}>
            <span className="chip-sm">{b.id.slice(0, 6)}</span>
            <div className="lr-main"><div className="lr-title">{b.title}</div></div>
            {moscowPill(b.moscow)}
            <span className="chip-sm">{t("pm.pts", { n: b.points })}</span>
            <BacklogRowActions id={b.id} />
          </div>
        ))}
      </div>
    </ViewShell>
  );
}
