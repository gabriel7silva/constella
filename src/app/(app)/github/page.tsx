import { eq, and, ne, desc } from "drizzle-orm";
import { db } from "@/db";
import { file, agent, notification } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";
import { SOCIAL_PROVIDERS } from "@/lib/auth";
import { getSecret } from "@/lib/vault";
import { currentRepo, refreshGitStatus } from "@/server/github";
import { ViewShell } from "@/components/shell/view-shell";
import { Icon } from "@/components/ui/icon";
import Link from "next/link";
import { GitHubFlow } from "@/components/modules/github-flow";
import { getT } from "@/lib/i18n-server";

export default async function GitHubPage() {
  const t = await getT();
  const { workspace } = await requireWorkspace();

  // Sync real working-tree status into file.gitStatus so the change set below is REAL.
  await refreshGitStatus().catch(() => ({}));
  const originRepo = await currentRepo().catch(() => null);

  const [pat, changeRows, agents, deploys] = await Promise.all([
    getSecret(workspace.id, "github_pat").catch(() => null),
    db
      .select({ path: file.path, st: file.gitStatus })
      .from(file)
      .where(and(eq(file.workspaceId, workspace.id), ne(file.gitStatus, ""))),
    db.select().from(agent).where(eq(agent.workspaceId, workspace.id)),
    db
      .select()
      .from(notification)
      .where(and(eq(notification.workspaceId, workspace.id), eq(notification.kind, "deploy")))
      .orderBy(desc(notification.createdAt))
      .limit(5),
  ]);

  const linked = !!pat;
  const changes = changeRows.map((c) => ({ path: c.path, st: c.st, name: c.path.split("/").pop() ?? c.path }));

  // The "assistant" that can draft / delegate the push — real agent, no fabrication.
  const assistant =
    agents.find((a) => a.handle === "margaret") ??
    agents.find((a) => /assist|ops|deploy|engineer/i.test(a.role)) ??
    agents[0] ??
    null;

  // Real push target = the configured `origin` repo (picked/created in the UI), else unset.
  const repo = { full: originRepo ?? "", name: originRepo?.split("/")[1] ?? workspace.name, branch: "main" };

  return (
    <ViewShell
      title={t("mod.github")}
      sub={t("github.sub")}
      right={<Link href="/" className="btn-ghost"><Icon name="chevronLeft" size={13} /> {t("github.back")}</Link>}
    >
      <div className="gh-mod">
        <div className="gh-hero">
          <div className="ghh-ico"><Icon name="git" size={26} /></div>
          <div style={{ flex: 1 }}>
            <div className="ghh-title">{linked ? (repo.full || t("github.selectRepo")) : t("github.connectGithub")}</div>
            <div className="ghh-sub">
              {linked ? (
                repo.full ? <>{t("github.connected")} · <b style={{ color: "var(--text)" }}>origin/{repo.branch}</b></> : <>{t("github.connectedPick")}</>
              ) : (
                t("github.signInOrToken")
              )}
            </div>
          </div>
          {linked && (
            <span className="oauth-ok" style={{ padding: "5px 10px" }}>
              <Icon name="check" size={13} /> {t("github.connectedBadge")}
            </span>
          )}
        </div>

        <GitHubFlow
          linked={linked}
          oauthAvailable={SOCIAL_PROVIDERS.includes("github")}
          repo={repo}
          changes={changes}
          deploys={deploys.map((d) => ({ id: d.id, text: d.text, detail: d.detail, at: d.createdAt }))}
          assistant={
            assistant
              ? { name: assistant.name, color: assistant.color, health: assistant.health, role: assistant.role }
              : null
          }
        />
      </div>
    </ViewShell>
  );
}
