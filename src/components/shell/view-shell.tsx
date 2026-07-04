import { Topbar } from "@/components/shell/topbar";
import { ViewChrome } from "./view-chrome";
import type { IconName } from "@/components/ui/icon";

export function ViewShell({ title, sub, right, icon, flush, children }: { title: string; sub?: string; right?: React.ReactNode; icon?: IconName; flush?: boolean; children: React.ReactNode }) {
  return (
    <>
      <Topbar title={title} />
      <ViewChrome title={title} sub={sub} right={right} icon={icon} flush={flush}>{children}</ViewChrome>
    </>
  );
}
