"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { useT } from "@/lib/i18n-context";
import { getUpdateState, runUpdate, pollUpdateResult } from "@/server/actions/update-actions";
import { isDeploymentSkew, reloadOnceForSkew } from "@/lib/deployment-skew";

type Phase = "available" | "updating" | "done" | "error";

/**
 * Header update control. ALWAYS shows a small "check for updates" button; when a newer version is published it
 * also shows the accent "Update vX" pill — surfaced LIVE while the server runs (a light poll every 12s + a
 * forced npm lookup every 3 min), no restart needed. The pill is DISABLED while an agent is actively working
 * (a server restart would kill its run); it re-enables when the agent finishes or its pulse goes stale.
 * Clicking installs in-app for a global install; dev/npx/Docker open the full /update page.
 */
export function UpdateHeaderBadge() {
  const t = useT();
  const router = useRouter();
  const [latest, setLatest] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);          // an agent is actively working → update paused
  const [phase, setPhase] = useState<Phase>("available");
  const [checking, setChecking] = useState(false);  // a manual check is in flight
  const [note, setNote] = useState("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let stopped = false;
    const check = async (force: boolean) => {
      try {
        const s = await getUpdateState(force);
        if (stopped) return;
        setLatest(s.info.updateAvailable && s.info.latest ? s.info.latest : null);
        setBusy(s.busy);
      } catch { /* offline → keep last state */ }
    };
    check(false);
    const light = setInterval(() => check(false), 12_000);     // cheap: cached npm + live agent-busy
    const fresh = setInterval(() => check(true), 3 * 60_000);  // forced fresh npm lookup
    return () => { stopped = true; clearInterval(light); clearInterval(fresh); if (timer.current) clearInterval(timer.current); };
  }, []);

  async function manualCheck() {
    if (checking) return;
    setChecking(true); setNote("");
    try {
      const s = await getUpdateState(true);
      setLatest(s.info.updateAvailable && s.info.latest ? s.info.latest : null);
      setBusy(s.busy);
      if (!s.info.updateAvailable) setNote(t("chrome.update.upToDate"));
    } catch { /* offline */ } finally { setChecking(false); }
  }

  async function onUpdate() {
    if (phase === "updating" || busy) return;
    if (phase === "done") { router.refresh(); return; }
    setPhase("updating"); setNote("");
    try {
      const res = await runUpdate();
      if (res.blocked) { setPhase("available"); setBusy(true); setNote(t("chrome.update.busy")); return; }
      if (res.started) {
        // Server stops itself to install, then relaunches → polls fail while it's down (caught, keep waiting);
        // a stale-action skew error means it's already back on the new build → reload.
        timer.current = setInterval(async () => {
          const r = await pollUpdateResult().catch((e) => { if (isDeploymentSkew(e)) { if (timer.current) clearInterval(timer.current); reloadOnceForSkew(); } return null; });
          if (!r) return;
          if (r.status === "done") { if (timer.current) clearInterval(timer.current); window.location.reload(); }
          else if (r.status === "error") { if (timer.current) clearInterval(timer.current); setPhase("error"); setNote(t("chrome.update.failed")); }
        }, 3000);
      } else { setPhase("available"); setNote(res.message || ""); router.push("/update"); }
    } catch { setPhase("error"); setNote(t("chrome.update.failed")); }
  }

  // Always-visible manual check control.
  const checkBtn = (
    <button type="button" className="top-btn" onClick={manualCheck} disabled={checking}
            title={note || t("chrome.update.check")}>
      <span className={checking ? "sync-spin" : ""} style={{ display: "inline-flex" }}><Icon name="sync" size={17} /></span>
    </button>
  );

  if (!latest) return checkBtn; // up to date → just the check button

  const label =
    phase === "updating" ? t("chrome.update.updating")
    : phase === "done" ? t("chrome.update.restart")
    : phase === "error" ? t("chrome.update.failed")
    : busy ? `v${latest}`
    : `${t("chrome.update.update")} v${latest}`;
  const icon = phase === "updating" ? "sync" : phase === "done" ? "refresh" : phase === "error" ? "bell" : "arrowUp";
  const disabled = phase === "updating" || busy;

  return (
    <>
      {checkBtn}
      <button
        type="button"
        onClick={onUpdate}
        disabled={disabled}
        title={busy ? t("chrome.update.busy") : (note || `${t("chrome.update.available")} — v${latest}`)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6, width: "auto", padding: "0 11px", height: 30,
          background: phase === "error" ? "var(--sx-keyword)" : busy ? "var(--bg-active)" : "var(--accent)",
          color: busy ? "var(--text-dim)" : "var(--accent-fg)", borderRadius: 999, fontSize: 12, fontWeight: 600,
          border: "none", opacity: phase === "updating" ? 0.75 : 1, cursor: disabled ? "default" : "pointer",
        }}
      >
        {phase === "updating"
          ? <span className="sync-spin" style={{ display: "inline-flex" }}><Icon name="sync" size={14} /></span>
          : <Icon name={icon} size={14} />}
        <span>{label}</span>
      </button>
    </>
  );
}
