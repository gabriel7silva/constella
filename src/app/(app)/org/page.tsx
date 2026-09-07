import { eq } from "drizzle-orm";
import { db } from "@/db";
import { agent } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";
import { Topbar } from "@/components/shell/topbar";
import { OrgCanvas } from "@/components/modules/org-canvas";
import { getT } from "@/lib/i18n-server";

export default async function OrgPage() {
  const t = await getT();
  const { workspace } = await requireWorkspace();
  const agents = await db.select().from(agent).where(eq(agent.workspaceId, workspace.id));

  return (
    <>
      <Topbar title="Org Chart" />
      {agents.length === 0 ? (
        <div className="app-view">
          <div className="view-head">
            <div style={{ flex: 1 }}>
              <div className="view-title">{t("org.title")}</div>
              <div className="view-sub">{t("org.sub")}</div>
            </div>
          </div>
          <div className="view-body">
            <div className="card"><div className="muted">{t("org.empty")}</div></div>
          </div>
        </div>
      ) : (
        <OrgCanvas
          agents={agents.map((a) => ({
            id: a.id,
            handle: a.handle,
            name: a.name,
            role: a.role,
            color: a.color,
            reportsTo: a.reportsTo,
            health: a.health,
            status: a.status,
            origin: a.origin,
            orgX: a.orgX,
            orgY: a.orgY,
          }))}
        />
      )}
    </>
  );
}
