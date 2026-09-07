import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { testRun, goal } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";
import { serverStatus } from "@/server/devserver";
import { ViewShell } from "@/components/shell/view-shell";
import { TestDevScreen } from "@/components/modules/test-dev-screen";
import { getT } from "@/lib/i18n-server";

export default async function TestDevPage() {
  const t = await getT();
  const { workspace } = await requireWorkspace();
  const [runs, goals] = await Promise.all([
    db.select().from(testRun).where(eq(testRun.workspaceId, workspace.id)).orderBy(desc(testRun.startedAt)).limit(20),
    db.select().from(goal).where(eq(goal.workspaceId, workspace.id)),
  ]);
  const status = serverStatus(workspace.id);

  return (
    <ViewShell title="Test Dev" sub={t("testdev.sub")}>
      <TestDevScreen
        status={status}
        runs={runs.map((r) => ({ id: r.id, status: r.status, summary: r.summary, findings: r.findings, issueId: r.issueId, by: r.by, startedAt: r.startedAt ? new Date(r.startedAt).toISOString() : null }))}
        goals={goals.filter((g) => g.status === "active").map((g) => ({ id: g.id, title: g.title }))}
      />
    </ViewShell>
  );
}
