import Link from "next/link";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { organization, member, workspace } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";
import { orgRoot } from "@/lib/fs-workspace";
import { ViewShell } from "@/components/shell/view-shell";
import { Icon } from "@/components/ui/icon";
import { OrgActions, WorkspaceMetaForm } from "@/components/modules/org-manage";
import { getT } from "@/lib/i18n-server";

export default async function OrganizationsPage() {
  const t = await getT();
  const { session, org: active } = await requireWorkspace();
  const rows = await db.select({ org: organization }).from(member)
    .innerJoin(organization, eq(member.orgId, organization.id))
    .where(eq(member.userId, session.user.id));
  // The member→org join can yield the same org twice (duplicate membership rows) — dedupe by id.
  const orgs = [...new Map(rows.map((r) => [r.org.id, r.org])).values()];
  // Only the user's own orgs' workspaces — never SELECT the whole workspace table (foreign-tenant rows that
  // scale with total tenant count and are never rendered).
  const orgIds = orgs.map((o) => o.id);
  const wss = orgIds.length ? await db.select().from(workspace).where(inArray(workspace.orgId, orgIds)) : [];
  const wsByOrg = Object.fromEntries(wss.map((w) => [w.orgId, w]));

  return (
    <ViewShell title="Organizations" sub={t("orgs.sub")}>
      {orgs.map((o) => {
        const ws = wsByOrg[o.id];
        const stack = (ws?.stack ?? {}) as Record<string, string>;
        const isActive = o.id === active.id;
        return (
          <div className="card" key={o.id} style={{ marginBottom: 14, opacity: o.archived ? 0.6 : 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div className="vh-icon" style={{ width: 34, height: 34, flex: "0 0 34px" }}><Icon name="grid" size={16} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>{o.name} {o.archived && <span className="chip-sm">{t("orgs.archived")}</span>}</div>
                <div className="mono" style={{ fontSize: 10.5, color: "var(--text-dim)" }}>{o.id}</div>
              </div>
              <OrgActions orgId={o.id} name={o.name} archived={o.archived} active={isActive} />
            </div>
            <div className="kv"><span className="k">{t("orgs.workspacePath")}</span><span className="v lr-mono mono" style={{ fontSize: 11 }}>{orgRoot(o.id)}</span></div>
            {Object.keys(stack).length > 0 && <div className="kv"><span className="k">{t("orgs.stack")}</span><span className="v" style={{ fontSize: 11.5 }}>{Object.values(stack).slice(0, 8).join(" · ")}</span></div>}
            {isActive && ws && (
              <div style={{ marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                <div className="detail-label">{t("orgs.editMissionObjective")}</div>
                <WorkspaceMetaForm mission={ws.mission} objective={ws.objective} />
              </div>
            )}
          </div>
        );
      })}
      <Link href="/onboarding" className="btn-ghost" style={{ display: "inline-flex" }}><Icon name="add" size={13} /> {t("orgs.createOrganization")}</Link>
    </ViewShell>
  );
}
