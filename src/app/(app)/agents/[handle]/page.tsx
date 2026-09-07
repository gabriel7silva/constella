import Link from "next/link";
import { eq, and, gte, sum } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { agent, skill, agentSkill, costEntry, ragChunk, provider } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";
import { listFiles } from "@/lib/fs-workspace";
import { catalogById } from "@/data/providers-catalog";
import { HIDDEN_CLI_ADAPTERS } from "@/data/model-options";
import { ViewShell } from "@/components/shell/view-shell";
import { Avatar } from "@/components/ui/avatar";
import { AgentStudioDetail } from "@/components/modules/agent-studio";
import { loadLibraryIndex } from "@/server/skills-library";
import { getT } from "@/lib/i18n-server";

const adapterShort = (a: string) => a.replace(/^http_|^local_|^cli_|^sdk_/, "");

function defaultPersona(name: string, role: string) {
  return {
    identity: `${name} is the ${role} of this company — owns outcomes in their domain.`,
    ritual: `Each cycle: read context, pick the highest-leverage task, do the work, report, stop at budget.`,
    tone: "Direct",
    systemPrompt: `You are ${name}, the ${role}. Work autonomously in the workspace, follow your skills, and stop at your budget ceiling.`,
  };
}

export default async function AgentStudioPage({ params }: { params: Promise<{ handle: string }> }) {
  const t = await getT();
  const { handle } = await params;
  const { org, workspace } = await requireWorkspace();
  const agents = await db.select().from(agent).where(eq(agent.workspaceId, workspace.id));
  const current = agents.find((a) => a.handle === handle);
  if (!current) notFound();

  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  const [skills, enabledRows, [spentAgg], ragRows] = await Promise.all([
    db.select().from(skill).where(eq(skill.workspaceId, workspace.id)),
    db.select().from(agentSkill).where(eq(agentSkill.agentId, current.id)),
    db.select({ usd: sum(costEntry.usd) }).from(costEntry).where(and(eq(costEntry.agentId, current.id), gte(costEntry.at, startOfToday))),
    db.select({ path: ragChunk.path }).from(ragChunk).where(eq(ragChunk.workspaceId, workspace.id)),
  ]);
  const providers = await db.select({ id: provider.id, adapter: provider.adapter, catalogId: provider.catalogId }).from(provider).where(eq(provider.workspaceId, workspace.id));
  // Only connected/configured providers (deduped by adapter) — not the whole catalog. The agent's
  // current adapter stays selectable even if its provider was removed.
  const seenAd = new Set<string>();
  const connectedOpts: { value: string; label: string; glyphId: string }[] = [];
  for (const p of providers) {
    if (seenAd.has(p.adapter) || HIDDEN_CLI_ADAPTERS.has(p.adapter)) continue; // retired CLIs never offered
    seenAd.add(p.adapter);
    connectedOpts.push({ value: p.adapter, label: catalogById(p.catalogId)?.displayName ?? adapterShort(p.adapter), glyphId: p.catalogId });
  }
  const providerOpts = connectedOpts.some((o) => o.value === current.adapter)
    ? connectedOpts
    : [{ value: current.adapter, label: adapterShort(current.adapter) + " · " + t("agent.notConnected"), glyphId: adapterShort(current.adapter) }, ...connectedOpts];
  const enabled = enabledRows.map((l) => l.skillId);
  // Category per skill = the native library's top folder (design/front-end/engineering/…); non-library
  // procedural skills (open-pr, run-suite, …) fall back to "core" so the filter can group them.
  const lib = loadLibraryIndex();
  const categoryOf = (name: string) => lib.get(name)?.relPath.split("/")[0] || "core";
  const fileCount = listFiles(org.id).length;
  const persona = current.persona ?? defaultPersona(current.name, current.role);
  const rag = current.rag ?? { repo: true, room: true, reports: true, skills: true, external: false };

  // Real indexed documents from the RAG store, grouped by path → chunk count + source bucket.
  const srcOf = (p: string) => /report|^docs|^po\//i.test(p) ? "reports" : /skill/i.test(p) ? "skills" : "repo";
  const docCounts = new Map<string, number>();
  for (const r of ragRows) docCounts.set(r.path, (docCounts.get(r.path) ?? 0) + 1);
  const ragDocs = [...docCounts.entries()].map(([path, chunks]) => ({ path, chunks, source: srcOf(path) }));

  return (
    <ViewShell title={t("mod.agents")} sub={t("agent.studioSub")}>
      <div className="agent-studio">
        <div className="as-list">
          <div className="as-list-head">{t("agent.listHead", { n: agents.length })}</div>
          {agents.map((a) => (
            <Link key={a.id} href={`/agents/${a.handle}`} className={"as-agent" + (a.id === current.id ? " on" : "")} style={{ textDecoration: "none", color: "inherit" }}>
              <Avatar name={a.name} color={a.color} size={32} health={a.health} image={a.image} />
              <div className="am"><div className="an">{a.name}</div><div className="ar">{a.role}</div></div>
            </Link>
          ))}
        </div>

        <AgentStudioDetail
          agentId={current.id} handle={current.handle} name={current.name} role={current.role} color={current.color} image={current.image}
          reportsTo={current.reportsTo} status={current.status} health={current.health} origin={current.origin}
          adapter={current.adapter} model={current.model} temperature={current.temperature} effort={current.effort}
          dailyCapUsd={current.dailyCapUsd} tierFloor={current.tierFloor}
          persona={persona} spentToday={Number(spentAgg?.usd ?? 0)} providerOpts={providerOpts}
          skills={skills.map((s) => ({ id: s.id, name: s.name, provisional: s.provisional, category: categoryOf(s.name) }))}
          enabledIds={enabled} fileCount={fileCount}
          rag={rag} ragDocs={ragDocs} providers={providers}
        />
      </div>
    </ViewShell>
  );
}
