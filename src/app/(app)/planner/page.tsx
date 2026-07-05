import type { Route } from "next";
import { eq, and, desc, asc } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { plan, spec, issue, agent, report, event } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";
import { listFiles } from "@/lib/fs-workspace";
import { ViewShell } from "@/components/shell/view-shell";
import { Icon } from "@/components/ui/icon";
import { Avatar } from "@/components/ui/avatar";
import { PlanGate, Run247Button, PlanGateLive } from "@/components/modules/plan-gate";
import { AgentRunLive } from "@/components/modules/agent-run-live";
import { NewWorkButton } from "@/components/modules/new-work";
import { SpecsSection } from "@/components/modules/specs-section";
import { IssuesSection } from "@/components/modules/issues-section";
import { getT } from "@/lib/i18n-server";
import { gatherDesignContext, readDesignGate } from "@/server/design/context";

/* Pipeline: context → CEO → specs → issues → approval → execution → report.
   `who` is an agent handle; the mini-avatar is the real seeded agent. Step title/description
   are rendered via i18n keys (planner.step.<id>.t / .d) at the render site, not stored here. */
const PIPELINE = [
  { id: "context", who: null },
  { id: "analyse", who: "ada" },
  { id: "specs", who: "linus" },
  { id: "issues", who: "donald" },
  { id: "approval", who: null },
  { id: "execute", who: "margaret" },
  { id: "report", who: "ada" },
] as const;

const COLS = ["todo", "doing", "review", "done"] as const;

export default async function PlannerPage() {
  const t = await getT();
  const { org, workspace } = await requireWorkspace();
  const [p] = await db.select().from(plan).where(eq(plan.workspaceId, workspace.id));
  const specs = await db.select().from(spec).where(eq(spec.workspaceId, workspace.id));
  const issues = await db.select().from(issue).where(eq(issue.workspaceId, workspace.id));
  const agents = await db.select().from(agent).where(eq(agent.workspaceId, workspace.id));
  const reports = await db.select().from(report).where(eq(report.workspaceId, workspace.id));
  const files = listFiles(org.id);

  const byHandle = Object.fromEntries(agents.map((a) => [a.handle, a]));

  // Design gate: strongly recommend prototyping + approving the UI in the Design module before the first plan
  // (frontend product, no approved design + no screens yet, not bypassed). `pending` = a plan was already
  // requested and is held on the design step. Drives the recommendation banner on the plan gate.
  const stackRec = (workspace.stack ?? {}) as Record<string, string>;
  const hasFrontend = !!stackRec.frontend && stackRec.frontend !== "None";
  const dctx = gatherDesignContext(org.id, workspace);
  const hasDesignScreens = dctx.designMockFiles.some((dp) => /design-mock\/screens\/.+\.html?$/i.test(dp));
  const designGate = readDesignGate(org.id);
  const designRecommended = hasFrontend && !dctx.approved && !hasDesignScreens && !designGate.skip;
  // "Design pending" = a plan is HELD on the design step (gate marker set, not bypassed) — independent of whether
  // Grace has written screens yet, so the banner doesn't vanish mid-flow once the scaffold runs. Cleared on Send-to-execution.
  const designPending = !!designGate.requestedPlanAt && !designGate.skip;

  // Cancelled/archived work is excluded from the live pipeline + execution view (it still shows
  // under the Cancelled/Archived filters in the Specs/Issues sections below).
  const activeSpecs = specs.filter((s) => s.status === "active");
  const activeIssues = issues.filter((i) => i.status === "active");

  // Is Ada CURRENTLY drafting the first plan? `generatePlan` runs in the BACKGROUND (persistent server)
  // and streams events to the "planner" channel. We decide "is a run live?" from the STREAM itself —
  // the most recent planner event being non-terminal (not done/error) AND fresh — rather than from
  // Ada's status flag (which can race the fast finish). This lets the page re-attach a live run after a
  // refresh / navigation instead of falsely showing "No plan yet". `event.seq` is an emit-time ms stamp.
  // Always detect a live planner run (not just when there are no specs) so a re-plan / New Work kicked from the
  // Design handoff is VISIBLE even when a plan already exists.
  let planSince = 0;
  let planning = false;
  {
    const [latest] = await db.select({ seq: event.seq, kind: event.kind, runId: event.runId }).from(event)
      .where(and(eq(event.workspaceId, workspace.id), eq(event.channel, "planner")))
      .orderBy(desc(event.seq)).limit(1);
    const live = !!latest && latest.kind !== "done" && latest.kind !== "error" && Date.now() - latest.seq < 6 * 60_000;
    if (live) {
      // cursor = the CURRENT run's FIRST event (MIN seq scoped to its runId), so AgentRunLive replays
      // this run from the top AND anchors its elapsed clock to the real start (not the latest event).
      const [first] = await db.select({ seq: event.seq }).from(event)
        .where(and(eq(event.workspaceId, workspace.id), eq(event.channel, "planner"), eq(event.runId, latest.runId)))
        .orderBy(asc(event.seq)).limit(1);
      planSince = first?.seq ?? latest.seq - 1;
      planning = true;
    }
  }

  const approved = !!p?.approved;
  const auto = !!p?.auto247;
  const total = activeIssues.length;
  const done = activeIssues.filter((i) => i.col === "done").length;
  const counts = COLS.map((c) => ({ c, n: activeIssues.filter((i) => i.col === c).length }));

  // ── Derived pipeline: each step's "done" comes from REAL workspace state, not a stored int.
  const colN = (c: string) => activeIssues.filter((i) => i.col === c).length;
  const inFlight = colN("doing") + colN("review");
  const approvedSpecs = activeSpecs.filter((s) => s.approved).length;
  const approvedIssues = activeIssues.filter((i) => i.approved).length;
  const allDone = total > 0 && done === total;
  const hasReports = reports.length > 0;
  // step order: 0 context · 1 analyse · 2 specs · 3 issues · 4 approval · 5 execute · 6 report
  // analyse-done is keyed on a real artifact Ada writes (ritual.md), distinct from spec rows existing.
  const analysed = files.includes("ritual.md") || activeSpecs.length > 0;
  // report step closes when work is fully done — a CEO report is auto-filed on goal completion,
  // but allDone alone also satisfies it so the pipeline always closes when the board is clear.
  const doneFlags = [files.length > 0, analysed, activeSpecs.length > 0, total > 0, approved, allDone, allDone];
  const frontier = doneFlags.findIndex((d) => !d); // -1 → whole pipeline complete
  const stepState = (i: number): "done" | "active" | "wait" | "todo" => {
    if (frontier === -1 || i < frontier) return "done";
    if (i > frontier) return "todo";
    if (i === 4) return "wait";                 // needs the operator's approval
    if (i === 5) return auto ? "active" : "wait"; // approved → running only while Run 24/7 is on
    return "active";
  };
  const META = [
    t("planner.meta.files", { n: files.length }),
    activeSpecs.length ? t("planner.meta.framed", { n: activeSpecs.length }) : t("planner.meta.awaitingPlan"),
    activeSpecs.length ? t("planner.meta.specs", { n: approvedSpecs, total: activeSpecs.length }) : "—",
    total ? t("planner.meta.issues", { n: total, approved: approvedIssues }) : "—",
    approved ? t("planner.meta.approvedByOperator") : activeSpecs.length ? t("planner.meta.awaitingApproval") : "—",
    !approved ? t("planner.meta.afterApproval") : t("planner.meta.board", { todo: colN("todo"), doing: colN("doing"), review: colN("review"), done }),
    hasReports ? t("planner.meta.reports", { n: reports.length }) : t("planner.meta.noReports"),
  ];

  // Run 24/7 real state: waiting-approval · off · running · blocked · all-done.
  const runnable = activeIssues.some((i) => i.col !== "done" && i.assigneeId);
  const runState = !approved ? "waiting-approval" : allDone ? "all-done" : !runnable ? "blocked" : auto ? "running" : "off";

  return (
    <ViewShell
      title={t("mod.planner")}
      sub={t("planner.sub")}
      right={<div style={{ display: "flex", gap: 8, alignItems: "center" }}><Link href={"/design" as Route} className="btn-ghost"><Icon name="grid" size={14} /> {t("planner.design.button")}</Link><NewWorkButton /><Run247Button auto={auto} approved={approved} state={runState} /></div>}
    >
      {/* Design step — prototype the UI before the plan (shown until there's a plan to approve). */}
      {activeSpecs.length === 0 && !approved && (
        <div className="run-cta" style={{ marginBottom: 14 }}>
          <div className="run-cta-ic"><Icon name="grid" size={15} /></div>
          <div className="run-cta-tx" style={{ flex: 1 }}>
            <b>{t("planner.design.button")}</b> — {t("planner.design.explainer")}
          </div>
          <Link href={"/design" as Route} className="btn-accent"><Icon name="grid" size={14} /> {t("planner.design.open")}</Link>
        </div>
      )}

      {/* pipeline — derived from real workspace state */}
      <div className="view-section-title">{t("planner.pipeline")}</div>
      <div className="ceo-pipe">
        {PIPELINE.map((stp, i) => {
          const st = stepState(i);
          const who = stp.who ? byHandle[stp.who] : null;
          return (
            <div className={"ceo-stage " + st} key={stp.id}>
              <div className="cs-dot">{st === "done" ? <Icon name="check" size={13} /> : i + 1}</div>
              <div className="cs-main">
                <div className="cs-t">
                  {t(`planner.step.${stp.id}.t`)} {who && <Avatar name={who.name} color={who.color} size={16} />}
                  {st === "active" && <span className="dotpulse" />}
                </div>
                <div className="cs-d">{t(`planner.step.${stp.id}.d`)}</div>
                <div className="cs-meta">{META[i]}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* A plan already exists but Ada is running again (e.g. New Work from the Design handoff) — show it live. */}
      {activeSpecs.length > 0 && planning && (
        <AgentRunLive channel="planner" resume sinceSeq={planSince - 1} />
      )}

      {/* approval gate */}
      {activeSpecs.length === 0 ? (
        <PlanGateLive planning={planning} planSince={planSince} designRecommended={designRecommended} designPending={designPending} />
      ) : !approved ? (
        <PlanGate specs={activeSpecs.length} total={total} />
      ) : (
        <div className={"plan-progress" + (runState === "off" ? " ready" : "")}>
          {runState === "off" && (
            <div className="run-cta">
              <div className="run-cta-ic"><Icon name="play" size={15} /></div>
              <div className="run-cta-tx">
                <b>{t("planner.cta.title")}</b> {t("planner.cta.clickPrefix")} <b>{t("planner.run247.run")}</b> {t("planner.cta.body", { n: total })}
              </div>
            </div>
          )}
          <div className="pp-head">
            <span className="pp-t">{t("planner.exec.progress")} {
              runState === "running" ? <span className="pp-live"><span className="dotpulse" /> {t("planner.exec.live", { n: inFlight })}</span>
              : runState === "blocked" ? <span className="pp-live" style={{ color: "#d98a2b" }}>{t("planner.exec.armed")}</span>
              : runState === "all-done" ? <span className="pp-live"><Icon name="check" size={12} /> {t("planner.exec.complete")}</span>
              : <span className="pp-live" style={{ color: "var(--text-faint)" }}>{t("planner.exec.paused")}</span>
            }</span>
            <span className="pp-n">{t("planner.exec.issuesDone", { done, total })}</span>
          </div>
          <div className="pp-bar"><span style={{ width: (total ? (done / total) * 100 : 0) + "%" }} /></div>
          <div className="pp-cols">{counts.map((c) => <span key={c.c} className="pp-col">{t(`planner.col.${c.c}`)}: <b>{c.n}</b></span>)}</div>
        </div>
      )}

      {/* specs — with status filter (cancelled/archived hidden by default) */}
      <SpecsSection specs={specs} issues={issues} agents={agents} />

      {/* issues — with status filter */}
      <IssuesSection issues={issues} specs={specs} agents={agents} />
    </ViewShell>
  );
}
