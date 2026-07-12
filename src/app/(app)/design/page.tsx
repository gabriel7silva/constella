import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { agent, designSession } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";
import { ViewShell } from "@/components/shell/view-shell";
import { getT } from "@/lib/i18n-server";
import { gatherDesignContext, readDesignGate, readDesignPromoted } from "@/server/design/context";
import { ensureDesignTables } from "@/server/design/tables";
import { DesignClient } from "./design-client";

export default async function DesignPage() {
  const t = await getT();
  const { org, workspace } = await requireWorkspace();
  ensureDesignTables();

  const ctx = gatherDesignContext(org.id, workspace);
  const designGate = readDesignGate(org.id);
  const designPromoted = readDesignPromoted(org.id);
  const agents = await db.select().from(agent).where(eq(agent.workspaceId, workspace.id));
  const grace = agents.find((a) => a.handle === "grace") ?? agents.find((a) => /front\s?end|\bui\b|\bux\b/i.test(a.role)) ?? null;
  const [session] = await db.select().from(designSession).where(eq(designSession.workspaceId, workspace.id)).orderBy(desc(designSession.createdAt)).limit(1);

  return (
    <ViewShell title={t("mod.design")} sub="Prototype the UI with the frontend agent before the plan" flush>
      <DesignClient
        context={{
          mission: ctx.mission, objective: ctx.objective, stackList: ctx.stackList, brief: !!ctx.brief,
          mockCount: ctx.mockFiles.length, designMockFiles: ctx.designMockFiles, designSkillCount: ctx.designSkills.length,
          hasImported: ctx.hasImported, approved: !!ctx.approved,
          gatePending: !!designGate.requestedPlanAt && !designGate.skip,
          gateScaffolded: !!designGate.scaffoldedAt,
          handoffPending: !!designGate.handoffAt,
          handoffDone: !!designPromoted.at,
        }}
        grace={grace ? { id: grace.id, name: grace.name, handle: grace.handle, color: grace.color, image: grace.image ?? null } : null}
        status={session?.status ?? "building"}
        tokens={session?.tokens ?? null}
      />
    </ViewShell>
  );
}
