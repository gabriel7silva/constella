"use client";

import { useState, useEffect, useTransition, type FormEvent } from "react";
import { Icon } from "@/components/ui/icon";
import { Dropdown } from "@/components/ui/dropdown";
import { formatWhen } from "@/lib/when";
import { useT } from "@/lib/i18n-context";
import { startDevServerAction, stopDevServerAction, devServerStatusAction, runTestDevAction, previewFrameableAction } from "@/server/actions/test-dev-actions";

type LogLine = { c: "out" | "err" | "info"; t: string };
type Status = { running: boolean; status: string; port?: number; url?: string; project?: string; logs: LogLine[] };
type Finding = { severity: "high" | "med" | "low"; kind: string; route: string; message: string };
type Run = { id: string; status: "running" | "pass" | "fail" | "inconclusive"; summary: string; findings: string; issueId: string | null; by: string; startedAt: string | null };

const VERDICT_COLOR: Record<string, string> = { pass: "var(--sx-string)", fail: "#e8688f", inconclusive: "#d98a2b", running: "var(--accent)" };
const SEV_COLOR: Record<string, string> = { high: "#e8688f", med: "#d98a2b", low: "var(--text-dim)" };

/* ----------------------------------------------------------------- embedded browser preview */
type Viewport = "desktop" | "tablet" | "mobile";
const VIEWPORTS: { id: Viewport; w: string }[] = [
  { id: "desktop", w: "100%" },
  { id: "tablet", w: "768px" },
  { id: "mobile", w: "390px" },
];

/** Live preview of the PROJECT's running dev server in an embedded browser frame, so the operator
 *  can actually click through the app they're building. Cross-origin (different localhost port), so
 *  it's view-only — the console + security checks come from the server-side Test Dev run. */
function BrowserPreview({ status, onStart, starting }: { status: Status; onStart: () => void; starting: boolean }) {
  const t = useT();
  const base = status.url ?? "";
  const live = status.status === "running" && !!base;
  const [addr, setAddr] = useState(base);
  const [src, setSrc] = useState(base);
  const [nonce, setNonce] = useState(0);
  const [vp, setVp] = useState<Viewport>("desktop");
  const [frameable, setFrameable] = useState(true);
  const width = VIEWPORTS.find((v) => v.id === vp)?.w ?? "100%";

  // When the server boots (url appears) adopt its address; reset when it stops.
  useEffect(() => {
    if (base) { setAddr((a) => a || base); setSrc((s) => s || base); }
    else { setAddr(""); setSrc(""); }
  }, [base]);

  // Probe (server-side) whether the app allows being framed — if it sends X-Frame-Options/CSP that
  // blocks the iframe, show a friendly "open in new tab" card instead of the browser's scary error.
  useEffect(() => {
    if (!live || !src) { setFrameable(true); return; }
    let alive = true;
    previewFrameableAction(src).then((r) => { if (alive) setFrameable(r.frameable); }).catch(() => {});
    return () => { alive = false; };
  }, [live, src, nonce]);

  // Resolve the address bar into a URL for the preview iframe/href. Parse structurally against `base` and
  // enforce http/https ONLY, so a pasted `javascript:`/`data:` scheme can never reach the iframe src / href
  // (it falls back to the trusted dev-server URL).
  function resolve(input: string): string {
    const v = input.trim();
    if (!v) return base;
    try {
      const u = base ? new URL(v, base) : new URL(v);
      return (u.protocol === "http:" || u.protocol === "https:") ? u.href : base;
    } catch { return base; }
  }
  function go(e?: FormEvent) { e?.preventDefault(); const u = resolve(addr); setSrc(u); setAddr(u); setNonce((n) => n + 1); }
  function reload() { setNonce((n) => n + 1); }

  return (
    <div className="hw-card tdb-card">
      <div className="hw-head">
        <span className="hw-ic"><Icon name="goto" size={19} /></span>
        <div style={{ flex: 1 }}><div className="hw-t">{t("testdev.preview.title")}</div><div className="hw-s">{t("testdev.preview.sub")}</div></div>
        <div className="tdb-vp">
          {VIEWPORTS.map((v) => (
            <button key={v.id} className={"tdb-vp-btn" + (vp === v.id ? " on" : "")} disabled={!live} onClick={() => setVp(v.id)}>{t(`testdev.viewport.${v.id}`)}</button>
          ))}
        </div>
      </div>

      <div className="tdb-bar">
        <div className="tdb-dots"><span /><span /><span /></div>
        <button className="tdb-ico" title={t("testdev.preview.reload")} disabled={!live} onClick={reload}><Icon name="refresh" size={14} /></button>
        <form className="tdb-addr" onSubmit={go}>
          <Icon name={live ? "shield" : "goto"} size={12} />
          <input value={addr} placeholder={base || t("testdev.preview.addrPlaceholder")} disabled={!live} onChange={(e) => setAddr(e.target.value)} spellCheck={false} />
        </form>
        {live
          ? <a className="tdb-ico" title={t("testdev.preview.openNewTab")} href={src} target="_blank" rel="noreferrer"><Icon name="goto" size={14} /></a>
          : <span className="tdb-ico off"><Icon name="goto" size={14} /></span>}
      </div>

      <div className="tdb-stage">
        {live && !frameable ? (
          <div className="tdb-empty">
            <span className="tdb-empty-ic"><Icon name="shield" size={26} /></span>
            <div className="tdb-empty-t">{t("testdev.preview.blocked.title")}</div>
            <div className="tdb-empty-s">{t("testdev.preview.blocked.sub")}</div>
            <a className="btn-accent" style={{ marginTop: 10 }} href={src} target="_blank" rel="noreferrer"><Icon name="goto" size={13} /> {t("testdev.preview.openNewTabBtn")}</a>
          </div>
        ) : live ? (
          <iframe
            key={nonce}
            className="tdb-frame"
            src={src}
            style={{ width, maxWidth: "100%" }}
            title={t("testdev.preview.frameTitle")}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
          />
        ) : (
          <div className="tdb-empty">
            <span className={"tdb-empty-ic" + (starting || status.status === "starting" ? " spin" : "")}><Icon name={starting || status.status === "starting" ? "refresh" : "goto"} size={26} /></span>
            <div className="tdb-empty-t">{status.status === "error" ? t("testdev.preview.empty.errorTitle") : starting || status.status === "starting" ? t("testdev.preview.empty.startingTitle") : t("testdev.preview.empty.idleTitle")}</div>
            <div className="tdb-empty-s">{status.status === "error" ? t("testdev.preview.empty.errorSub") : t("testdev.preview.empty.idleSub")}</div>
            {status.status !== "running" && status.status !== "starting" && !starting && (
              <button className="btn-accent" style={{ marginTop: 10 }} onClick={onStart}><Icon name="goto" size={13} /> {t("testdev.server.start")}</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function TestDevScreen({ status: initial, runs, goals }: { status: Status; runs: Run[]; goals: { id: string; title: string }[] }) {
  const t = useT();
  const [status, setStatus] = useState<Status>(initial);
  const [goalId, setGoalId] = useState<string>("");
  const [result, setResult] = useState<{ status: string; summary: string; findings: Finding[] } | null>(null);
  const [busy, setBusy] = useState<"" | "server" | "test">("");
  const [, start] = useTransition();

  function toggleServer() {
    setBusy("server");
    start(async () => {
      const s = status.running ? await stopDevServerAction() : await startDevServerAction();
      setStatus(s); setBusy("");
    });
  }
  function refresh() { start(async () => { setStatus(await devServerStatusAction()); }); }
  function runTests() {
    setBusy("test"); setResult(null);
    start(async () => {
      const r = await runTestDevAction(goalId ? { goalId } : undefined);
      setResult({ status: r.status, summary: r.summary, findings: r.findings });
      setStatus(await devServerStatusAction());
      setBusy("");
    });
  }

  const dot = status.status === "running" ? "run" : status.status === "starting" ? "boot" : "stop";
  const label = status.status === "running" ? t("testdev.state.running") : status.status === "starting" ? t("testdev.state.starting") : status.status === "error" ? t("testdev.state.error") : status.status === "none" ? t("testdev.state.notStarted") : t("testdev.state.stopped");

  return (
    <>
      <div className="lr-grid">
        <div className="hw-card">
          <div className="hw-head">
            <span className="hw-ic"><Icon name="terminal" size={19} /></span>
            <div style={{ flex: 1 }}><div className="hw-t">{t("testdev.server.title")}</div><div className="hw-s">{status.project ?? t("testdev.server.defaultProject")}</div></div>
            <button className="iact" title={t("common.refresh")} onClick={refresh}><Icon name="refresh" size={15} /></button>
          </div>
          <div className="srv-status">
            <span className={"srv-dot " + dot} />
            <div className="srv-meta"><div className="sm-t">{label}</div><div className="sm-s">{status.url ?? t("testdev.server.noServer")}</div></div>
            <button className={status.running ? "btn-ghost" : "btn-accent"} onClick={toggleServer} disabled={busy === "server"}>
              {busy === "server" ? <span className="sync-spin"><Icon name="refresh" size={13} /></span> : <Icon name={status.running ? "close" : "goto"} size={13} />}
              {status.running ? t("testdev.server.stop") : busy === "server" ? t("testdev.server.working") : t("testdev.server.start")}
            </button>
          </div>
          <div className="srv-log scroll" style={{ maxHeight: 220 }}>
            {status.logs.length === 0 && <div className="lg-dim">{t("testdev.server.noOutput")}</div>}
            {status.logs.map((l, i) => <div key={i} className={l.c === "err" ? "lg-warn" : l.c === "info" ? "lg-dim" : "lg-ok"}>{l.t}</div>)}
          </div>
        </div>

        <div className="hw-card">
          <div className="hw-head">
            <span className="hw-ic"><Icon name="pulse" size={19} /></span>
            <div style={{ flex: 1 }}><div className="hw-t">{t("testdev.tests.title")}</div><div className="hw-s">{t("testdev.tests.sub")}</div></div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div className="pa-flabel" style={{ marginBottom: 4 }}>{t("testdev.tests.scope")}</div>
            <Dropdown value={goalId} placeholder={t("testdev.tests.wholeApp")} options={[{ value: "", label: t("testdev.tests.wholeApp") }, ...goals.map((g) => ({ value: g.id, label: g.title.slice(0, 40) }))]} onChange={setGoalId} />
          </div>
          <button className="btn-accent" style={{ width: "100%", justifyContent: "center" }} onClick={runTests} disabled={busy === "test"}>
            {busy === "test" ? <><span className="sync-spin"><Icon name="refresh" size={13} /></span> {t("testdev.tests.testing")}</> : <><Icon name="play" size={13} /> {t("testdev.tests.run")}</>}
          </button>
          {result && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span className="pill" style={{ background: VERDICT_COLOR[result.status] + "22", color: VERDICT_COLOR[result.status] }}>{t(`testdev.verdict.${result.status}`)}</span>
                <span style={{ fontSize: 12.5, color: "var(--text-dim)" }}>{result.summary}</span>
              </div>
              {result.findings.length > 0 && (
                <div className="srv-log scroll" style={{ maxHeight: 160 }}>
                  {result.findings.map((f, i) => (
                    <div key={i} style={{ display: "flex", gap: 6, padding: "2px 0" }}>
                      <span style={{ color: SEV_COLOR[f.severity], fontWeight: 700, fontSize: 10 }}>{t(`testdev.severity.${f.severity}`).toUpperCase()}</span>
                      <span style={{ color: "var(--text-faint)", fontSize: 11 }}>{f.kind}@{f.route}</span>
                      <span style={{ fontSize: 11, color: "var(--text-dim)", flex: 1 }}>{f.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <BrowserPreview status={status} onStart={toggleServer} starting={busy === "server"} />

      <div className="view-section-title">{t("testdev.recent.title")}</div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>{t("testdev.col.verdict")}</th><th>{t("testdev.col.summary")}</th><th>{t("testdev.col.findings")}</th><th>{t("testdev.col.by")}</th><th>{t("testdev.col.when")}</th></tr></thead>
          <tbody>
            {runs.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--text-faint)", padding: 18 }}>{t("testdev.recent.empty")}</td></tr>}
            {runs.map((r) => {
              let n = 0; try { n = (JSON.parse(r.findings) as unknown[]).length; } catch { /* ignore */ }
              return (
                <tr key={r.id}>
                  <td><span className="pill" style={{ background: VERDICT_COLOR[r.status] + "22", color: VERDICT_COLOR[r.status] }}>{t(`testdev.verdict.${r.status}`)}</span></td>
                  <td style={{ fontSize: 12.5 }}>{r.summary || "—"}</td>
                  <td style={{ color: "var(--text-dim)" }}>{n}</td>
                  <td style={{ color: "var(--text-dim)" }}>{r.by}</td>
                  <td style={{ color: "var(--text-faint)", fontSize: 11 }}>{r.startedAt ? formatWhen(r.startedAt) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
