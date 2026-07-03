import { eq } from "drizzle-orm";
import { db } from "@/db";
import { agent } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";
import { goalRollups } from "@/server/progress";
import { ViewShell } from "@/components/shell/view-shell";
import { NewGoalButton } from "@/components/modules/new-goal";
import { GoalTree } from "@/components/modules/goal-tree";
import { getT } from "@/lib/i18n-server";

export default async function GoalsPage() {
  const t = await getT();
  const { workspace } = await requireWorkspace();
  const [rollups, agents] = await Promise.all([
    goalRollups(workspace.id),
    db.select().from(agent).where(eq(agent.workspaceId, workspace.id)),
  ]);

  return (
    <ViewShell title={t("mod.goals")} sub={t("goals.sub")}
               right={<NewGoalButton agents={agents.map((a) => ({ id: a.id, name: a.name, role: a.role }))} />}>
      <GoalTree goals={rollups} />
    </ViewShell>
  );
}
