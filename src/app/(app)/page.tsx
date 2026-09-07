import Link from "next/link";
import type { Route } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { agent, user } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";
import { listBlocks } from "@/server/blocks";
import { homeStatus, homeAreas, homeResumable, homeDecisions, homeActivity, homePoSnapshot, homeDocs } from "@/server/home";
import { getT } from "@/lib/i18n-server";
import { timeAgo } from "@/lib/timeago";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ViewShell } from "@/components/shell/view-shell";
import { Icon, type IconName } from "@/components/ui/icon";
import { Avatar } from "@/components/ui/avatar";
import { MODULES } from "@/lib/modules";
import { WelcomeChat } from "@/components/modules/welcome-chat";
import { HomeHeroActions } from "@/components/modules/home-hero-actions";
import { HomeStatusChip } from "@/components/modules/home-status-chip";
import { HomeSeedBlocks } from "@/components/modules/home-seed-blocks";
import { HomeInbox } from "@/components/modules/home-inbox";
import { HomeActivity } from "@/components/modules/home-activity";

// The Welcome Home is the operational landing page (post-login). It is intentionally DIFFERENT from
// the Dashboard (/dashboard, the metrics cockpit): this is the company's living home — orient, enter
// knowledge/work/team/ops, ask the KB, continue recent work, and clear the decisions that need you.
const AREAS: { key: string; icon: IconName; href: Route; groups: string[]; countKey: keyof Awaited<ReturnType<typeof homeAreas>> }[] = [
  { key: "knowledge", icon: "branch", href: "/knowledge", groups: ["Knowledge"], countKey: "knowledge" },
  { key: "work", icon: "command", href: "/planner", groups: ["Execution", "Product"], countKey: "work" },
  { key: "team", icon: "agents", href: "/org", groups: ["Hierarchy"], countKey: "team" },
  { key: "ops", icon: "pulse", href: "/pulse", groups: ["Operations"], countKey: "ops" },
];
const TYPE_ICON: Record<string, IconName> = { goal: "target", spec: "doc", issue: "files", task: "files", report: "doc", doc: "doc", test: "play", plan: "command" };

function SecTitle({ icon, label, moreHref, moreLabel }: { icon: IconName; label: string; moreHref?: Route; moreLabel?: string }) {
  return (
    <div className="home-sec-title">
      <span className="hst-ico"><Icon name={icon} size={15} /></span> {label}
      {moreHref && <Link href={moreHref} className="hst-more">{moreLabel} →</Link>}
    </div>
  );
}

export default async function HomePage() {
  const t = await getT();
  const { session, workspace } = await requireWorkspace();
  const wsId = workspace.id;

  const [status, areas, blocks, agents, recent, decisions, activity, po, docs, urow] = await Promise.all([
    homeStatus(wsId), homeAreas(wsId), listBlocks(wsId),
    db.select().from(agent).where(eq(agent.workspaceId, wsId)),
    homeResumable(wsId), homeDecisions(wsId), homeActivity(wsId), homePoSnapshot(wsId), homeDocs(wsId),
    // better-auth's session.user doesn't surface our custom `image` column — read it from the row (same as the layout).
    db.select({ image: user.image }).from(user).where(eq(user.id, session.user.id)),
  ]);
  const userImage = urow[0]?.image ?? null;

  const byAgent = Object.fromEntries(agents.map((a) => [a.id, a]));
  const ada = agents.find((a) => a.handle === "ada") ?? agents.find((a) => /ceo|planner|chief exec/i.test(a.role)) ?? agents[0] ?? null;
  const mission = blocks.find((b) => b.slug === "mission")?.body || workspace.mission || "";

  return (
    <ViewShell title={t("mod.home")} sub={t("home.sub")}>
      {/* Hero */}
      <section className="home-hero">
        <Avatar name={workspace.name} color="var(--accent)" size={56} />
        <div className="home-hero-body">
          <div className="home-hero-top">
            <h1 className="home-hero-name">{workspace.name}</h1>
            <HomeStatusChip running={status.activeAgents > 0} activeAgents={status.activeAgents} />
          </div>
          {mission && <p className="home-hero-mission">{mission.split("\n")[0].slice(0, 200)}</p>}
          <HomeHeroActions adaHandle={ada?.handle ?? null} continueHref={recent[0]?.href ?? null} />
          <div className="home-status-row">
            <Link href={"/dashboard" as Route} className="hsr-stat"><b>{status.activeAgents}</b>/{status.totalAgents} <span>{t("home.activeAgents")}</span></Link>
            <Link href="/costs" className="hsr-stat"><b>${status.spent.toFixed(2)}</b> <span>{t("home.spentMonth")}</span></Link>
            <Link href="/goals" className="hsr-stat"><b>{status.avgGoal}%</b> <span>{t("home.goalProgress")}</span></Link>
            <Link href={"/dashboard" as Route} className="hsr-more">{t("home.fullDashboard")} <Icon name="goto" size={12} /></Link>
          </div>
        </div>
      </section>

      {/* Central chat — the home's own fixed chat (the floating dock is hidden on `/`) */}
      <WelcomeChat
        agents={agents.map((a) => ({ id: a.id, handle: a.handle, name: a.name, role: a.role, color: a.color, image: a.image, adapter: a.adapter, status: a.status, health: a.health }))}
        operator={{ name: session.user.name, image: userImage }}
      />

      {/* Big area cards */}
      <div className="home-areas">
        {AREAS.map((area) => {
          const mods = MODULES.filter((m) => area.groups.includes(m.group));
          return (
            <div className="home-area-card" key={area.key}>
              <Link href={area.href} className="hac-head">
                <div className="hac-ico"><Icon name={area.icon} size={20} /></div>
                <div className="hac-titles">
                  <span className="hac-title">{t(`home.area.${area.key}`)}</span>
                  <span className="hac-desc">{t(`home.area.${area.key}.desc`)}</span>
                </div>
                <span className="hac-count">{areas[area.countKey]}</span>
              </Link>
              <div className="hac-links">
                {mods.map((m) => (<Link key={m.id} href={m.href} className="chip-sm">{t(`mod.${m.id}`)}</Link>))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Continue where you left off */}
      <section className="home-section">
        <SecTitle icon="goto" label={t("home.continue")} moreHref="/tasks" moreLabel={t("home.seeAll")} />
        {recent.length === 0
          ? <div className="home-empty">{t("home.continue.empty")}</div>
          : <div className="continue-grid">
              {recent.map((i) => {
                const a = i.agentId ? byAgent[i.agentId] : null;
                return (
                  <Link key={i.type + i.id} href={i.href as Route} className="continue-card">
                    <div className="cc-top">
                      <span className="cc-type"><Icon name={TYPE_ICON[i.type] ?? "doc"} size={12} /> {t(`home.type.${i.type}`)}</span>
                      <span className="cc-status">{i.status}</span>
                    </div>
                    <div className="cc-title">{i.title}</div>
                    <div className="cc-foot">
                      {a && <Avatar name={a.name} color={a.color} size={18} />}
                      <span className="cc-meta">{a ? a.name : ""}{i.updatedAt ? (a ? " · " : "") + timeAgo(i.updatedAt) : ""}</span>
                    </div>
                  </Link>
                );
              })}
            </div>}
      </section>

      {/* Needs your decision */}
      <section className="home-section">
        <SecTitle icon="inbox" label={t("home.decisions")} moreHref="/inbox" moreLabel={t("home.seeAll")} />
        <HomeInbox items={decisions} />
      </section>

      {/* Product & planning */}
      <section className="home-section">
        <SecTitle icon="command" label={t("home.product")} moreHref="/planner" moreLabel={t("home.seeAll")} />
        <div className="po-wrap">
          <div className="po-grid">
            <Link href="/goals" className="po-stat"><b>{po.activeGoals}</b><span>{t("home.po.goals")}</span></Link>
            <Link href="/planner" className="po-stat"><b>{po.specsAwaiting}</b><span>{t("home.po.specsAwaiting")}</span></Link>
            <Link href="/pm" className="po-stat"><b>{po.backlog}</b><span>{t("home.po.backlog")}</span></Link>
            <Link href="/planner" className="po-stat"><b>{po.planApproved ? "✓" : "—"}</b><span>{po.auto247 ? t("home.po.auto") : t("home.po.plan")}</span></Link>
          </div>
          {po.topIssues.length > 0 && (
            <div className="po-issues">
              <div className="po-sub">{t("home.po.topIssues")}</div>
              {po.topIssues.map((i) => (
                <Link key={i.key} href="/pm" className="po-issue">
                  <span className={"prio-dot p-" + i.prio} /> <span className="poi-key">{i.key}</span> <span className="poi-title">{i.title}</span>
                  <span className="poi-col">{i.col}</span>
                </Link>
              ))}
            </div>
          )}
          <div className="po-next">
            <span className="po-sub">{t("home.po.next")}</span>
            {po.nextSteps.map((s) => (<Link key={s.key} href={s.href as Route} className="po-step">{t(s.key)}</Link>))}
          </div>
        </div>
      </section>

      {/* Central knowledge (synced blocks) */}
      <section className="home-section">
        <SecTitle icon="branch" label={t("home.canonical")} moreHref={"/knowledge" as Route} moreLabel={t("home.seeAll")} />
        {blocks.length === 0
          ? <HomeSeedBlocks />
          : <div className="block-grid">
              {blocks.slice(0, 6).map((b) => (
                <Link key={b.slug} href={"/knowledge" as Route} className="block-card">
                  <div className="bc-top">
                    <span className="bc-title">{b.title || b.slug}</span>
                    <span className="bc-kind">{b.kind}</span>
                  </div>
                  <div className="bc-body md"><ReactMarkdown remarkPlugins={[remarkGfm]}>{(b.body || "").slice(0, 280) || "_(empty)_"}</ReactMarkdown></div>
                  <div className="bc-foot">
                    <span>v{b.version}</span>
                    {b.updatedAt && <span>· {timeAgo(new Date(b.updatedAt))}</span>}
                    <span className="bc-open">{t("home.openInKb")} →</span>
                  </div>
                </Link>
              ))}
            </div>}
      </section>

      {/* Documents — recent + suggested */}
      <section className="home-section">
        <SecTitle icon="doc" label={t("home.docs")} moreHref="/docs" moreLabel={t("home.seeAll")} />
        <div className="docs-wrap">
          <div className="docs-col">
            <div className="po-sub">{t("home.docsRecent")}</div>
            {docs.recent.length === 0
              ? <div className="home-empty">{t("home.docsEmpty")}</div>
              : docs.recent.map((d) => (
                  <Link key={d.id} href="/docs" className="doc-row">
                    <Icon name="doc" size={14} />
                    <span className="doc-title">{d.title}</span>
                    <span className="doc-kind">{d.kind}</span>
                    {d.updatedAt && <span className="doc-time">{timeAgo(new Date(d.updatedAt))}</span>}
                  </Link>
                ))}
          </div>
          {docs.suggested.length > 0 && (
            <div className="docs-col">
              <div className="po-sub">{t("home.docsSuggested")}</div>
              {docs.suggested.map((s) => (
                <Link key={s.key} href={s.href as Route} className="doc-sugg"><Icon name="add" size={13} /> {t(s.key)}</Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Recent activity */}
      <section className="home-section">
        <SecTitle icon="pulse" label={t("home.recent")} moreHref="/activity" moreLabel={t("home.seeAll")} />
        <HomeActivity rows={activity} />
      </section>
    </ViewShell>
  );
}
