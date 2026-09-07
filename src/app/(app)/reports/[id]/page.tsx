import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { db } from "@/db";
import { report, agent } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";
import { resolveBlocks } from "@/server/blocks";
import { ViewShell } from "@/components/shell/view-shell";
import { getT } from "@/lib/i18n-server";

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getT();
  const { id } = await params;
  const { org, workspace } = await requireWorkspace();
  const [r] = await db.select().from(report).where(and(eq(report.id, id), eq(report.workspaceId, workspace.id)));
  if (!r) notFound();

  const author = r.authorId ? (await db.select().from(agent).where(eq(agent.id, r.authorId)))[0] : null;
  const sub = [r.type, author?.name, new Date(r.createdAt).toLocaleDateString()].filter(Boolean).join(" · ");
  // Transclude {{kb:slug}} markers → the current canonical synced-block bodies (read-time resolution).
  const body = r.body.trim() ? await resolveBlocks(org.id, r.body) : "";

  return (
    <ViewShell title={r.title} sub={sub} right={<Link href="/reports" className="btn-ghost">← {t("mod.reports")}</Link>}>
      <div className="card">
        {body
          ? <div className="md"><ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown></div>
          : <div className="muted">{t("reports.noBody")}</div>}
      </div>
    </ViewShell>
  );
}
