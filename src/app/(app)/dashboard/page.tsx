import Link from "next/link";
import { requireWorkspace } from "@/lib/workspace";
import { getT } from "@/lib/i18n-server";
import { getDashboardSnapshot } from "@/server/dashboard";
import { ViewShell } from "@/components/shell/view-shell";
import { Icon } from "@/components/ui/icon";
import { Dashboard } from "@/components/modules/dashboard";

export default async function DashboardPage() {
  const t = await getT();
  const { workspace } = await requireWorkspace();
  const initial = await getDashboardSnapshot({ range: "7d" });

  return (
    <ViewShell title={t("mod.dashboard")} sub={t("dash.sub")}
               right={<Link href="/inbox" className="btn-ghost"><Icon name="inbox" size={14} /> {t("mod.inbox")}</Link>}>
      <Dashboard initial={initial} runMode={workspace.runMode} />
    </ViewShell>
  );
}
