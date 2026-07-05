import { eq } from "drizzle-orm";
import { db } from "@/db";
import { inboxItem, agent } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";
import { Topbar } from "@/components/shell/topbar";
import { Icon } from "@/components/ui/icon";
import { InboxList, type InboxItem } from "@/components/modules/inbox-row";
import { getT } from "@/lib/i18n-server";

export default async function InboxPage() {
  const t = await getT();
  const { workspace } = await requireWorkspace();
  const [items, agents] = await Promise.all([
    db.select().from(inboxItem).where(eq(inboxItem.workspaceId, workspace.id)),
    db.select().from(agent).where(eq(agent.workspaceId, workspace.id)),
  ]);
  const byId = Object.fromEntries(agents.map((a) => [a.id, a]));

  const rows: InboxItem[] = items
    .slice()
    // unresolved first, then newest first
    .sort((a, b) => Number(a.resolved) - Number(b.resolved) || (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
    .map((i) => {
      const from = i.fromAgentId ? byId[i.fromAgentId] : null;
      return {
        id: i.id,
        kind: i.kind,
        title: i.title,
        detail: i.detail,
        resolved: i.resolved,
        fromName: from?.name ?? null,
        fromColor: from?.color ?? null,
        fromHealth: from?.health ?? null,
        refType: i.refType,
        refId: i.refId,
        channel: i.channel,
        createdAt: i.createdAt,
      };
    });

  const pending = items.filter((i) => !i.resolved).length;

  return (
    <>
      <Topbar title="Inbox" />
      <div className="view" style={{ position: "relative" }}>
        <div className="view-head">
          <div className="vh-icon"><Icon name="inbox" size={20} /></div>
          <div>
            <div className="view-title">{t("inbox.title")}</div>
            <div className="view-sub">{t("inbox.sub", { n: pending })}</div>
          </div>
        </div>
        <InboxList items={rows} />
      </div>
    </>
  );
}
