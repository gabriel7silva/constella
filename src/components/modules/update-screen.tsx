"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Icon } from "@/components/ui/icon";
import { runUpdate, pollUpdateResult, getUpdateState } from "@/server/actions/update-actions";
import { useT } from "@/lib/i18n-context";

type Props = {
  current: string; latest: string | null; updateAvailable: boolean;
  type: string | null; changelog: string | null; command: string; context: string;
};
type Result = { ok: boolean; started?: boolean; blocked?: boolean; message: string; command: string; backupDir?: string; needsRestart?: boolean };

export function UpdateScreen(p: Props) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [poll, setPoll] = useState("");
  // Live-checkable view of the version state (seeded from the server, refreshed by "Check now"/poll).
  const [info, setInfo] = useState({ latest: p.latest, updateAvailable: p.updateAvailable, type: p.type, changelog: p.changelog });
  const [working, setWorking] = useState(false); // an agent is actively running → update paused
  const [checking, setChecking] = useState(false);

  // Poll the agent-busy gate so "Update now" enables/disables live without a reload.
  useEffect(() => {
    let stop = false;
    const refresh = async () => { try { const s = await getUpdateState(false); if (!stop) setWorking(s.busy); } catch { /* offline */ } };
    refresh();
    const iv = setInterval(refresh, 12_000);
    return () => { stop = true; clearInterval(iv); };
  }, []);

  // Wait out the restart blip, then hard-reload onto the new version. The server is briefly down while it
  // relaunches (global) or systemd cycles the unit (VPS); poll the page itself until it answers, so the
  // reload always lands on a live server instead of a connection error.
  async function reloadWhenBack() {
    await new Promise((r) => setTimeout(r, 1800)); // let the restart actually take the server down first
    for (let i = 0; i < 40; i++) {
      try { const r = await fetch(window.location.href, { method: "HEAD", cache: "no-store" }); if (r.ok) break; } catch { /* still cycling */ }
      await new Promise((r) => setTimeout(r, 1500));
    }
    window.location.reload();
  }

  async function checkNow() {
    if (checking) return;
    setChecking(true);
    try {
      const s = await getUpdateState(true);
      setInfo({ latest: s.info.latest, updateAvailable: s.info.updateAvailable, type: s.info.type, changelog: s.info.changelog });
      setWorking(s.busy);
    } catch { /* offline */ } finally { setChecking(false); }
  }

  async function update() {
    if (working) return;
    setBusy(true); setPoll("");
    const r = (await runUpdate()) as Result;
    setResult(r);
    if (r.blocked) { setBusy(false); setWorking(true); return; }
    if (r.started) {
      // The server stops itself to install then relaunches (a global relaunch, or a VPS systemd restart), so
      // polls FAIL while it's down (caught — keep waiting). A "done" poll means the install landed; the server
      // may still be cycling, so wait until it answers again, THEN reload — the page refreshes itself with no
      // manual action, and never lands on a dead-connection error mid-restart.
      const iv = setInterval(async () => {
        const res = await pollUpdateResult().catch(() => null);
        if (!res) return;
        setPoll(res.status);
        if (res.status === "done") { clearInterval(iv); await reloadWhenBack(); }
        else if (res.status === "error") { clearInterval(iv); setBusy(false); }
      }, 3000);
    } else { setBusy(false); }
  }

  return (
    <div className="pd-grid">
      <div className="hw-card">
        <div className="upd-versions">
          <div><div className="upd-k">{t("update.installed")}</div><div className="upd-v">v{p.current}</div></div>
          <Icon name="goto" size={16} style={{ color: "var(--text-faint)" }} />
          <div><div className="upd-k">{t("update.latest")}</div><div className="upd-v" style={{ color: "var(--accent)" }}>{info.latest ? "v" + info.latest : "—"}</div></div>
          {info.type && <span className="pill" style={{ marginLeft: "auto", background: "var(--bg-active)", color: "var(--text-dim)" }}>{info.type}</span>}
        </div>
        <div className="set-desc" style={{ marginTop: 10 }}><Icon name="cpu" size={12} /> {t(`update.ctx.${p.context}`)}</div>

        <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          {info.updateAvailable && (
            <button className="btn-accent" disabled={busy || working} onClick={update} title={working ? t("update.busy") : undefined}>
              {busy ? <><span className="sync-spin"><Icon name="refresh" size={13} /></span> {t("update.updating")}</> : <><Icon name="goto" size={13} /> {t("update.updateNow")}</>}
            </button>
          )}
          <button className="btn-ghost" disabled={checking} onClick={checkNow}>
            <span className={checking ? "sync-spin" : ""} style={{ display: "inline-flex" }}><Icon name="sync" size={13} /></span> {t("update.checkNow")}
          </button>
          {info.updateAvailable && <button className="btn-ghost" onClick={() => history.back()}>{t("update.defer")}</button>}
          <a className="btn-ghost" href="https://github.com/gabriel7silva/constella/blob/main/docs/UPDATE.md" target="_blank" rel="noreferrer"><Icon name="doc" size={13} /> {t("update.docs")}</a>
        </div>

        {!info.updateAvailable && <div className="muted" style={{ marginTop: 12, fontSize: 13 }}><Icon name="check" size={14} /> {t("update.onLatest")}</div>}
        {working && <div className="form-hint" style={{ marginTop: 10 }}><Icon name="pulse" size={13} /> {t("update.busy")}</div>}

        {result && (
          <div className="pd-result" style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12.5, color: result.ok ? "var(--sx-string)" : "var(--text-dim)" }}>{result.message}</div>
            {result.started && (
              <div className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>
                {t("update.updaterLabel")}: {poll || t("update.poll.running")}…
                {poll === "done" && <b style={{ color: "var(--sx-string)" }}> ✓ {t("update.poll.done")}</b>}
                {poll === "error" && <b style={{ color: "#e8688f" }}> ✖ {t("update.poll.error")}</b>}
              </div>
            )}
            {result.command && <pre className="pd-log" style={{ marginTop: 8 }}>{result.command}</pre>}
            {result.backupDir && <div className="muted" style={{ fontSize: 11 }}>{t("update.backupSaved")}: {result.backupDir}</div>}
            {poll === "error" && <div className="form-hint" style={{ marginTop: 6 }}>{t("update.rollback")}: <span className="mono">npm i -g constellai@{p.current}</span>, {t("update.rollbackThen")}</div>}
          </div>
        )}
      </div>

      {info.changelog && (
        <div className="hw-card">
          <h4 style={{ marginTop: 0 }}>{t("update.whatsNew", { version: info.latest ?? "" })}</h4>
          <div className="upd-changelog"><ReactMarkdown remarkPlugins={[remarkGfm]}>{info.changelog}</ReactMarkdown></div>
        </div>
      )}
    </div>
  );
}
