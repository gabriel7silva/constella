import { eq } from "drizzle-orm";
import { db } from "@/db";
import { plugin } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";
import { getT } from "@/lib/i18n-server";
import { ViewShell } from "@/components/shell/view-shell";
import { PluginGrid, InstallPlugin } from "@/components/modules/plugin-grid";

export default async function PluginsPage() {
  const t = await getT();
  const { workspace } = await requireWorkspace();
  const plugins = await db.select().from(plugin).where(eq(plugin.workspaceId, workspace.id));

  return (
    <ViewShell title={t("mod.plugins")} sub={t("plugins.sub")} right={<InstallPlugin />}>
      {plugins.length === 0
        ? <div className="card"><div className="muted">{t("plugins.empty")}</div></div>
        : <PluginGrid plugins={plugins} />}
    </ViewShell>
  );
}
