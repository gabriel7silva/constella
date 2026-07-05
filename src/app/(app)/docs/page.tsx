import Link from "next/link";
import type { Route } from "next";
import { eq, asc } from "drizzle-orm";
import { db } from "@/db";
import { docIndex } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";
import { indexWorkspace } from "@/server/sync";
import { ViewShell } from "@/components/shell/view-shell";
import { Icon } from "@/components/ui/icon";
import { GenerateDocsButton } from "@/components/modules/docs-actions";
import { getT } from "@/lib/i18n-server";

export default async function DocsPage() {
  const t = await getT();
  const { workspace } = await requireWorkspace();
  let rows = await db.select().from(docIndex).where(eq(docIndex.workspaceId, workspace.id)).orderBy(asc(docIndex.path));
  // Self-heal: if nothing is indexed yet, reconcile the disk tree into the DB once
  // (revalidate=false — revalidatePath is illegal during a render).
  if (rows.length === 0) {
    await indexWorkspace(false);
    rows = await db.select().from(docIndex).where(eq(docIndex.workspaceId, workspace.id)).orderBy(asc(docIndex.path));
  }
  const groups: [string, typeof rows][] = [
    [t("docs.groupDocumentation"), rows.filter((r) => r.kind === "docs")],
    [t("docs.groupProduct"), rows.filter((r) => r.kind === "po")],
  ];

  return (
    <ViewShell title={t("mod.docs")} sub={t("docs.sub")} right={<GenerateDocsButton />}>
      {groups.map(([label, list]) => (
        <div key={label}>
          <div className="view-section-title" style={{ marginTop: 18 }}>{label}</div>
          {list.length === 0 && <div className="card"><div className="muted">{t("docs.empty")}</div></div>}
          {list.map((d) => (
            <Link key={d.id} href={`/docs/${d.id}` as Route} className="lrow" style={{ textDecoration: "none", color: "inherit" }}>
              <div className="vh-icon" style={{ width: 34, height: 34, flex: "0 0 34px" }}><Icon name="doc" size={16} /></div>
              <div className="lr-main">
                <div className="lr-title">{d.title}</div>
                <div className="lr-sub"><span className="lr-mono mono">{d.path}</span>{d.summary ? ` · ${d.summary}` : ""}</div>
              </div>
              <Icon name="chevronRight" size={14} style={{ color: "var(--text-faint)" }} />
            </Link>
          ))}
        </div>
      ))}
    </ViewShell>
  );
}
