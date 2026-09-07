import { requireWorkspace } from "@/lib/workspace";
import { getSecret } from "@/lib/vault";
import { listRepos } from "@/server/github";
import { detectProject } from "@/server/devserver";
import { getDeployRun, getDeployEnv, deployChecklist } from "@/server/prepare-deploy";
import { ViewShell } from "@/components/shell/view-shell";
import { Icon } from "@/components/ui/icon";
import Link from "next/link";
import { PrepareDeploy } from "@/components/modules/prepare-deploy";
import { getT } from "@/lib/i18n-server";

export default async function PrepareDeployPage() {
  const t = await getT();
  const { org, workspace } = await requireWorkspace();
  const pat = await getSecret(workspace.id, "github_pat").catch(() => null);
  const reposR = pat ? await listRepos().catch(() => ({ ok: false as const })) : { ok: false as const };
  const proj = detectProject(org.id);
  const [run, env, checklist] = await Promise.all([getDeployRun(), getDeployEnv(), deployChecklist()]);

  return (
    <ViewShell
      title="Prepare Deploy"
      sub={t("deploy.sub")}
      right={<Link href="/" className="btn-ghost"><Icon name="chevronLeft" size={13} /> {t("deploy.back")}</Link>}
    >
      <PrepareDeploy
        hasToken={!!pat}
        repos={"ok" in reposR && reposR.ok && reposR.repos ? reposR.repos.map((r) => ({ full: r.full, private: r.private, branch: r.branch })) : []}
        project={proj ? { name: proj.name, kind: proj.kind, label: proj.label } : null}
        env={env}
        run={run}
        checklist={checklist}
      />
    </ViewShell>
  );
}
