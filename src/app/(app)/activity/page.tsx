import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { activity, agent } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";
import { ViewShell } from "@/components/shell/view-shell";
import { timeAgo } from "@/lib/timeago";
import { ActivityTimeline } from "@/components/modules/activity-timeline";
import { getT } from "@/lib/i18n-server";

export default async function ActivityPage() {
  const t = await getT();
  const { workspace } = await requireWorkspace();
  const acts = await db.select().from(activity).where(eq(activity.workspaceId, workspace.id)).orderBy(desc(activity.at)).limit(100);
  const agents = await db.select().from(agent).where(eq(agent.workspaceId, workspace.id));
  const byId = Object.fromEntries(agents.map((a) => [a.id, a]));
  // Only agents that actually appear in the timeline get a filter chip.
  const present = agents.filter((a) => acts.some((x) => x.agentId === a.id));

  return (
    <ViewShell title={t("mod.activity")} sub={t("activity.sub")}>
      <ActivityTimeline
        items={acts.map((a) => {
          const ag = a.agentId ? byId[a.agentId] : null;
          return { id: a.id, time: timeAgo(a.at), agentId: a.agentId, agentName: ag?.name ?? null, agentColor: ag?.color ?? null, action: a.action, target: a.target };
        })}
        agents={present.map((a) => ({ id: a.id, name: a.name, color: a.color }))}
      />
    </ViewShell>
  );
}
