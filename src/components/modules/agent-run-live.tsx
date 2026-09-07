"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { getEvents } from "@/server/events";
import { useT } from "@/lib/i18n-context";

/** Verb keys that render a localized label (agent.verb.*); `text` is rendered label-less. */
const VERB_KINDS = ["read", "create", "edit", "run", "search", "thinking", "done", "error"] as const;
type Step = { id: string; kind: string; target: string; detail: string };
type Line = { id: string; kind: string; content: string };

/** A path → just the file name, so a long absolute path doesn't blow the one-line budget. */
function short(s: string): string {
  if (!s) return "";
  const p = s.split(/[\\/]/);
  return p.length > 1 ? p.slice(-2).join("/") : s;
}

/**
 * Collapse the raw event stream into at most a handful of human lines:
 *  - consecutive `text` deltas merge into ONE rolling narration line (what Ada is "saying"),
 *  - each tool use (read/edit/run/…) is its own line (verb + the file/cmd it touched),
 *  - thinking/done/error each render their message.
 * The caller shows only the last few — this is the live "what's happening", not a full log.
 */
function toLines(steps: Step[]): Line[] {
  const lines: Line[] = [];
  for (const s of steps) {
    if (s.kind === "text") {
      const chunk = (s.detail || "").replace(/\s+/g, " ").trim();
      if (!chunk) continue;
      const last = lines[lines.length - 1];
      if (last && last.kind === "text") last.content = (last.content + " " + chunk).slice(-600);
      else lines.push({ id: s.id, kind: "text", content: chunk });
    } else if (s.kind === "thinking") {
      const c = (s.detail || s.target || "").replace(/\s+/g, " ").trim();
      if (c) lines.push({ id: s.id, kind: "thinking", content: c });
    } else {
      lines.push({ id: s.id, kind: s.kind, content: short(s.target) || s.detail || "" });
    }
  }
  return lines;
}

/**
 * Live agent-run surface for any module. A button elsewhere dispatches
 * `constella:agent-run {channel}`; this polls `getEvents(channel)` and renders the streaming
 * read/edit/run steps AND Ada's live narration (the `text` deltas) — capped to the last 5 lines so
 * it never grows into a wall. An elapsed clock + pulse keep it visibly alive between events.
 *
 * `resume` (with `sinceSeq` = the live run's start seq) re-attaches to a run that is ALREADY in
 * progress after a page refresh — the server tells the page a run is live, so the stream resumes
 * without the in-page CustomEvent. On a `done`/`error` event it refreshes the route (so freshly
 * written results render) and calls `onFinish` (so a parent gate can drop its local "running" flag).
 */
export function AgentRunLive({ channel, resume = false, sinceSeq = 0, onFinish }: { channel: string; resume?: boolean; sinceSeq?: number; onFinish?: () => void }) {
  const t = useT();
  const router = useRouter();
  const [active, setActive] = useState(resume);
  const [steps, setSteps] = useState<Step[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const seq = useRef(resume ? sinceSeq : 0);
  const refreshed = useRef(false);
  const startedAt = useRef(0);

  // Re-attach to an already-running job after a refresh (server says a run is in progress). The clock
  // ORIGIN is the run's real first-event timestamp (`sinceSeq`, an emit-time ms stamp) — NOT `Date.now()`
  // — so leaving and returning shows TRUE elapsed instead of resetting to 00:00.
  useEffect(() => {
    if (resume) {
      seq.current = sinceSeq; refreshed.current = false;
      startedAt.current = sinceSeq > 0 ? sinceSeq : Date.now();
      setSteps([]); setElapsed(Math.max(0, Math.floor((Date.now() - startedAt.current) / 1000))); setActive(true);
    }
  }, [resume, sinceSeq]);

  useEffect(() => {
    function onStart(e: Event) {
      const d = (e as CustomEvent).detail as { channel?: string } | undefined;
      if (d?.channel !== channel) return;
      seq.current = Date.now() - 1; refreshed.current = false; startedAt.current = Date.now(); setSteps([]); setElapsed(0); setActive(true);
    }
    window.addEventListener("constella:agent-run", onStart as EventListener);
    return () => window.removeEventListener("constella:agent-run", onStart as EventListener);
  }, [channel]);

  // Elapsed clock — ticks every second while active so the surface reads as alive even when the
  // agent is mid-call (between streamed events).
  useEffect(() => {
    if (!active) return;
    if (!startedAt.current) startedAt.current = Date.now();
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, [active]);

  useEffect(() => {
    if (!active) return;
    let alive = true;
    const started = Date.now();
    async function poll() {
      const rows = (await getEvents(channel, seq.current)) as { id: string; seq: number; kind: string; target: string; detail: string }[];
      if (!alive) return;
      if (rows.length) {
        seq.current = Math.max(seq.current, ...rows.map((r) => r.seq));
        setSteps((c) => { const seen = new Set(c.map((s) => s.id)); return [...c, ...rows.filter((r) => !seen.has(r.id))]; });
        if (rows.some((r) => r.kind === "done" || r.kind === "error")) {
          // Pull the freshly-written specs/results into the page (once), tell the parent the run ended,
          // then wind down the live view shortly after so the last lines stay visible briefly.
          if (!refreshed.current) { refreshed.current = true; router.refresh(); onFinish?.(); }
          setTimeout(() => { if (alive) setActive(false); }, 2500);
        }
      }
      if (Date.now() - started > 960_000) setActive(false); // safety cap 16min — clears the backend worst case (analyze 10min + draft 5min), so a long run no longer freezes the surface at 05:00
    }
    poll();
    const t = setInterval(poll, 700);
    return () => { alive = false; clearInterval(t); };
  }, [active, channel, router, onFinish]);

  if (!active && steps.length === 0) return null;

  const lines = toLines(steps);
  const shown = lines.slice(-5);
  const hidden = lines.length - shown.length;
  const ended = steps.some((s) => s.kind === "done" || s.kind === "error");
  const errored = steps.some((s) => s.kind === "error");
  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <div className="card live-stream" style={{ marginBottom: 16, borderColor: errored ? "var(--sx-keyword)" : "var(--accent)" }}>
      <div className="set-desc" style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 7 }}>
        {active && !ended ? <span className="dotpulse" /> : <Icon name={errored ? "close" : "check"} size={13} style={{ color: errored ? "var(--sx-keyword)" : "var(--sx-string)" }} />}
        {active && !ended ? t("agent.run.working") : errored ? t("agent.run.failed") : t("agent.run.finished")}
        {lines.length > 0 && <span style={{ color: "var(--text-faint)" }}>· {t(lines.length === 1 ? "agent.run.steps.one" : "agent.run.steps.other", { n: lines.length })}</span>}
        <span className="live-elapsed" style={{ marginLeft: "auto" }}>{mm}:{ss}</span>
      </div>
      {shown.length === 0 ? (
        <div className="muted" style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 7 }}>
          <span className="sync-spin"><Icon name="refresh" size={12} /></span> {t("agent.run.reading")}
        </div>
      ) : (
        <>
          {hidden > 0 && <div className="live-more">{t(hidden === 1 ? "agent.run.earlier.one" : "agent.run.earlier.other", { n: hidden })}</div>}
          <div className="live-stream-lines">
            {shown.map((l) => (
              <div className={"live-line " + l.kind} key={l.id}>
                {l.kind !== "text" && <span className="ll-k">{(VERB_KINDS as readonly string[]).includes(l.kind) ? t(`agent.verb.${l.kind}`) : l.kind}</span>}
                <span className="ll-c">{l.content}{!ended && l === shown[shown.length - 1] && l.kind === "text" && <span className="ll-caret" />}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
