import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { notification, agent } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";
import { Topbar } from "@/components/shell/topbar";
import { NotifFeed, type NotifItem } from "@/components/modules/notif-actions";

export default async function NotificationsPage() {
  const { workspace } = await requireWorkspace();
  const rows = await db
    .select()
    .from(notification)
    .where(eq(notification.workspaceId, workspace.id))
    .orderBy(desc(notification.createdAt));
  const agents = await db.select().from(agent).where(eq(agent.workspaceId, workspace.id));
  const byId = Object.fromEntries(agents.map((a) => [a.id, a]));

  const items: NotifItem[] = rows.map((n) => {
    const a = n.agentId ? byId[n.agentId] : null;
    return {
      id: n.id,
      kind: n.kind,
      text: n.text,
      detail: n.detail,
      read: n.read,
      createdAt: n.createdAt,
      agentName: a ? a.name : null,
      agentColor: a ? a.color : null,
      agentHealth: a ? a.health : null,
    };
  });

  return <><Topbar title="Notifications" /><NotifFeed items={items} /></>;
}
