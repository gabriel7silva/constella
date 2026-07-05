import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { docIndex } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";
import { readWorkspaceFile } from "@/lib/fs-workspace";
import { ViewShell } from "@/components/shell/view-shell";
import { DocEditor } from "@/components/modules/doc-editor";
import { getT } from "@/lib/i18n-server";

export default async function DocDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getT();
  const { id } = await params;
  const { org, workspace } = await requireWorkspace();
  const [row] = await db.select().from(docIndex).where(and(eq(docIndex.id, id), eq(docIndex.workspaceId, workspace.id)));
  if (!row) notFound();
  const content = readWorkspaceFile(org.id, row.path) ?? "";

  return (
    <ViewShell title={row.title} sub={row.path} right={<Link href="/docs" className="btn-ghost">← {t("mod.docs")}</Link>}>
      <DocEditor docId={row.id} path={row.path} initial={content} />
    </ViewShell>
  );
}
