import { getUpdateStatus, getUpdateContext } from "@/server/actions/update-actions";
import { ViewShell } from "@/components/shell/view-shell";
import { UpdateScreen } from "@/components/modules/update-screen";
import { getT } from "@/lib/i18n-server";

export default async function UpdatePage() {
  const t = await getT();
  const [info, context] = await Promise.all([getUpdateStatus(), getUpdateContext()]);
  return (
    <ViewShell title={t("mod.update")} sub={t("update.sub")}>
      <UpdateScreen
        current={info.current}
        latest={info.latest}
        updateAvailable={info.updateAvailable}
        type={info.type}
        changelog={info.changelog}
        command={info.command}
        context={context}
      />
    </ViewShell>
  );
}
