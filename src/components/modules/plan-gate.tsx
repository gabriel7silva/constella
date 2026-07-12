"use client";

import type { Route } from "next";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { useT } from "@/lib/i18n-context";
import { AgentRunLive } from "@/components/modules/agent-run-live";
import { approvePlan, requestPlanChanges, setAuto247, approveSpec, rejectSpec, approveIssue, rejectIssue, generatePlan } from "@/server/planner";
import { skipDesignGate } from "@/server/design/actions";

function openDm(handle: string, text: string) {
  window.dispatchEvent(new CustomEvent("constella:open-dm", { detail: { handle, text } }));
}

/**
 * The "no plan yet → drafting → done" region of the CEO Planner, client-owned so the transition is
 * INSTANT and survives a refresh:
 *  - on click it immediately locks (the button + hint vanish) and flips to the live drafting panel,
 *    without waiting for the server round-trip — then fires the REAL background CEO run;
 *  - `planning` (server-derived from Ada's persisted status + the live event stream) keeps the drafting
 *    state across a page refresh / navigation; `AgentRunLive` re-attaches from `planSince`;
 *  - when the run ends, AgentRunLive calls `onFinish` → the local flag clears and the page (already
 *    refreshed on the `done` event) shows the freshly written specs (or returns to "No plan yet").
 */
export function PlanGateLive({ planning, planSince, designRecommended = false, designPending = false }: { planning: boolean; planSince: number; designRecommended?: boolean; designPending?: boolean }) {
  const t = useT();
  const [pending, start] = useTransition();
  const router = useRouter();
  const [started, setStarted] = useState(false);
  const [err, setErr] = useState("");
  const running = planning || started;

  // "Generate plan anyway" — bypass the design gate, then run the normal generate flow.
  function onGenerateAnyway() {
    start(async () => { try { await skipDesignGate(); } catch { /* best effort */ } });
    onGenerate();
  }

  function onGenerate() {
    setErr("");
    setStarted(true); // instant lock — the gate flips to the live panel before the server replies
    window.dispatchEvent(new CustomEvent("constella:agent-run", { detail: { channel: "planner" } }));
    start(async () => {
      try {
        const r = await generatePlan();
        // The call resolved but didn't start a run (failed, or Ada is already/again working) → don't
        // sit on a fake "drafting" panel forever; drop the optimistic flag and let the page reconcile.
        if (!r?.ok || r.started === false) { setStarted(false); if (r?.error) setErr(r.error); }
        router.refresh();
      } catch {
        // The server action threw (e.g. a STALE browser tab → "Failed to find Server Action"): the
        // click never reached this deployment. Clear the optimistic state + tell the operator to reload.
        setStarted(false);
        setErr(t("planner.gate.staleTab"));
      }
    });
  }

  return (
    <>
      {/* resume ONLY from a real server-side run (planSince); the click path activates via the
          CustomEvent (cursor = now) so it never replays old events. */}
      <AgentRunLive channel="planner" resume={planning} sinceSeq={planning ? planSince - 1 : 0} onFinish={() => setStarted(false)} />
      {running ? (
        <div className="plan-gate">
          <div className="plan-gate-bar" aria-hidden />
          <div className="pg-ic"><Icon name="bot" size={20} /></div>
          <div className="pg-main">
            <div className="pg-t">{t("planner.gate.drafting.t")}</div>
            <div className="pg-d">{t("planner.gate.drafting.d")}</div>
          </div>
        </div>
      ) : (designRecommended || designPending) ? (
        // Design-first recommendation — strong but non-blocking: prototype + approve the UI before planning.
        <div className="plan-gate" style={{ borderColor: "rgba(99,102,241,.45)" }}>
          <div className="plan-gate-bar" aria-hidden style={{ background: "#6366f1" }} />
          <div className="pg-ic" style={{ background: "rgba(99,102,241,.16)", color: "#6366f1" }}><Icon name="skill" size={20} /></div>
          <div className="pg-main">
            <div className="pg-t">{designPending ? "Design step pending" : "Recommended: prototype the design first"}</div>
            <div className="pg-d">
              {designPending
                ? "Ada is holding the plan on the design step. Open the Design module, build & approve the prototype with Grace, then Send to execution — Ada turns the approved design into specs & issues (zero drift)."
                : "This is a frontend product. Prototype & approve the UI in the Design module before generating the plan — Grace turns the brief into a real visual reference, so the specs are precise and you avoid rework."}
            </div>
            {err && <div className="pg-d" style={{ color: "var(--sx-keyword)", marginTop: 6 }}>{err}</div>}
          </div>
          <div className="pg-actions">
            <button className="btn-accent" onClick={() => router.push("/design" as Route)}>
              <Icon name="skill" size={14} /> Open Design
            </button>
            <button className="btn-ghost" disabled={pending} onClick={onGenerateAnyway} style={{ fontSize: 12 }}>
              <Icon name={pending ? "refresh" : "bot"} size={13} className={pending ? "sync-spin" : ""} /> {pending ? t("planner.gate.analyzing") : "Skip design & plan anyway"}
            </button>
          </div>
        </div>
      ) : (
        <div className="plan-gate">
          <div className="plan-gate-bar" aria-hidden />
          <div className="pg-ic"><Icon name="bot" size={20} /></div>
          <div className="pg-main">
            <div className="pg-t">{t("planner.gate.noPlan.t")}</div>
            <div className="pg-d">{t("planner.gate.noPlan.d")}</div>
            {err && <div className="pg-d" style={{ color: "var(--sx-keyword)", marginTop: 6 }}>{err}</div>}
          </div>
          <div className="pg-actions">
            <div className="plan-hint">
              <div className="plan-hint-t">{t("planner.gate.hint.t")}</div>
              <div className="plan-hint-d">{t("planner.gate.hint.d")}</div>
            </div>
            <button className="btn-accent" disabled={pending} onClick={onGenerate}>
              <Icon name={pending ? "refresh" : "bot"} size={14} className={pending ? "sync-spin" : ""} />
              {" "}{pending ? t("planner.gate.analyzing") : t("planner.gate.generate")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Fires the REAL CEO ritual: Ada reads the brief/mission/objective/stack and drafts
 * specs + issues, streaming her analysis to the "planner" channel (AgentRunLive shows
 * it live). Operator-triggered — the autonomy + spend stay under the operator's control.
 */
export function GeneratePlanButton() {
  const t = useT();
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      className="btn-accent"
      disabled={pending}
      onClick={() => {
        window.dispatchEvent(new CustomEvent("constella:agent-run", { detail: { channel: "planner" } }));
        start(async () => { await generatePlan(); router.refresh(); });
      }}
    >
      <Icon name={pending ? "refresh" : "bot"} size={14} className={pending ? "sync-spin" : ""} />
      {" "}{pending ? t("planner.gate.analyzing") : t("planner.gate.generate")}
    </button>
  );
}

/** Approval gate — no agent writes code until the operator approves. */
export function PlanGate({ specs, total }: { specs: number; total: number }) {
  const t = useT();
  const [pending, start] = useTransition();
  return (
    <div className="plan-gate">
      <div className="pg-ic"><Icon name="bot" size={20} /></div>
      <div className="pg-main">
        <div className="pg-t">{t("planner.gate.ready.t")}</div>
        <div className="pg-d">{t("planner.gate.ready.d", { specs, total })}</div>
      </div>
      <div className="pg-actions">
        <button className="btn-ghost" disabled={pending} onClick={() => start(async () => { await requestPlanChanges(); openDm("ada", t("planner.gate.rejectPlanDm")); })}>
          <Icon name="refresh" size={13} /> {t("planner.gate.requestChanges")}
        </button>
        <button className="btn-accent" disabled={pending} onClick={() => start(() => approvePlan())}>
          <Icon name="check" size={14} /> {t("planner.gate.approvePlan")}
        </button>
      </div>
    </div>
  );
}

/** Per-spec approve / reject. Reject opens a prefilled DM with the spec's author to revise it. */
export function SpecApprove({ specId, specKey, approved }: { specId: string; specKey: string; approved: boolean }) {
  const t = useT();
  const [pending, start] = useTransition();
  if (approved) return <span className="pill" style={{ background: "var(--sx-string)22", color: "var(--sx-string)" }}><Icon name="check" size={11} /> {t("planner.approved")}</span>;
  return (
    <span style={{ display: "inline-flex", gap: 6 }}>
      <button className="sc2-btn" disabled={pending} onClick={() => start(() => approveSpec(specId))}><Icon name="check" size={11} /> {t("planner.approve")}</button>
      <button className="sc2-btn danger" disabled={pending} onClick={() => start(async () => { const r = await rejectSpec(specId); openDm(r.handle, t("planner.rejectItemDm", { key: specKey })); })}><Icon name="refresh" size={11} /> {t("planner.reject")}</button>
    </span>
  );
}

/** Per-issue approve / reject. Reject opens a prefilled DM with the issue's assignee to revise it. */
export function IssueApprove({ issueId, issueKey, approved }: { issueId: string; issueKey: string; approved: boolean }) {
  const t = useT();
  const [pending, start] = useTransition();
  if (approved) return <span className="pill" style={{ background: "var(--sx-string)22", color: "var(--sx-string)" }}><Icon name="check" size={11} /> {t("planner.approved")}</span>;
  return (
    <span style={{ display: "inline-flex", gap: 6 }}>
      <button className="sc2-btn" disabled={pending} onClick={() => start(() => approveIssue(issueId))}><Icon name="check" size={11} /> {t("planner.approve")}</button>
      <button className="sc2-btn danger" disabled={pending} onClick={() => start(async () => { const r = await rejectIssue(issueId); openDm(r.handle, t("planner.rejectItemDm", { key: issueKey })); })}><Icon name="refresh" size={11} /> {t("planner.reject")}</button>
    </span>
  );
}

/**
 * Topbar action — start/pause the real 24/7 autonomous loop. State is derived from
 * real workspace data (planner page): the cron runner only executes a workspace whose
 * plan is approved AND Run 24/7 is on (see runner.ts `auto` gate), so this truly
 * starts/pauses execution rather than flipping a cosmetic flag.
 */
export function Run247Button({ auto, approved, state }: {
  auto: boolean; approved: boolean;
  state: "waiting-approval" | "off" | "running" | "blocked" | "all-done";
}) {
  const t = useT();
  const [pending, start] = useTransition();
  const locked = !approved || state === "all-done";
  const label = pending ? (auto ? t("planner.run247.pausing") : t("planner.run247.starting"))
    : state === "waiting-approval" ? t("planner.run247.approveToRun")
    : state === "all-done" ? t("planner.run247.allDone")
    : auto ? t("planner.run247.pause") : t("planner.run247.run");
  const icon = pending ? "refresh"
    : state === "waiting-approval" ? "bot"
    : state === "all-done" ? "check"
    : auto ? "close" : "play";
  const title = state === "blocked" ? t("planner.run247.blockedTip") : undefined;
  // After approval, with runnable issues but not yet started, this button is the operator's next
  // action — pulse it so the eye lands there (the CEO Planner CTA points here).
  const attn = state === "off" && !pending;
  return (
    <button
      className={"btn-" + (auto ? "ghost" : "accent") + (attn ? " run-attn" : "")}
      disabled={locked || pending}
      title={title}
      onClick={() => start(() => setAuto247(!auto))}
    >
      <Icon name={icon} size={14} className={pending ? "sync-spin" : ""} />
      {" "}{label}
      {(state === "running" || attn) && <span className="dotpulse" style={{ marginLeft: 6 }} />}
    </button>
  );
}
