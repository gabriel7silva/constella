import { eq } from "drizzle-orm";
import { db } from "@/db";
import { file } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";
import { listFiles, readWorkspaceFile, orgRoot } from "@/lib/fs-workspace";
import { langOf } from "@/lib/lang";
import { refreshGitStatus } from "@/server/github";
import { ViewShell } from "@/components/shell/view-shell";
import { CodeEditor, type FileRow } from "@/components/modules/code-editor";
import { getT } from "@/lib/i18n-server";

export default async function CodePage() {
  const t = await getT();
  const { org, workspace } = await requireWorkspace();

  // Sync the real working-tree status (git status) so "Source control" shows actual changes.
  await refreshGitStatus().catch(() => ({}));
  // Disk is the source of truth for which files exist and their content.
  const paths = listFiles(org.id);
  // The DB mirrors files and carries the real git status for each path.
  const rows = await db.select().from(file).where(eq(file.workspaceId, workspace.id));
  const statusByPath = new Map(rows.map((r) => [r.path, r.gitStatus]));

  const files: FileRow[] = paths.map((p, i) => ({
    id: String(i),
    path: p,
    lang: langOf(p),
    content: readWorkspaceFile(org.id, p) ?? "",
    gitStatus: statusByPath.get(p) ?? "",
  }));

  return (
    <ViewShell title={t("codeedit.title")} sub={t("codeedit.sub")}>
      <div className="kv" style={{ marginBottom: 12 }}><span className="k">{t("codeedit.agentReadsFrom")}</span><span className="v lr-mono mono" style={{ fontSize: 11 }}>{orgRoot(org.id)}</span></div>
      <CodeEditor files={files} repo={`${workspace.slug}`} />
    </ViewShell>
  );
}
