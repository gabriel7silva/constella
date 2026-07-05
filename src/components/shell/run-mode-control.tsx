"use client";

import { useState, useTransition } from "react";
import { useT } from "@/lib/i18n-context";
import { setRunMode } from "@/server/actions/runner-actions";

/**
 * Sidebar run-mode control. Shows whether the autonomous loop is live and
 * lets the operator pause/resume it. When active, a pulsing dot signals the
 * agents are working; the RunnerHeartbeat drives the actual ticks.
 */
export function RunModeControl({ runMode }: { runMode: string }) {
  const t = useT();
  const [mode, setMode] = useState(runMode);
  const [pending, start] = useTransition();
  const live = mode !== "off";

  function toggle() {
    const next = live ? "off" : "start";
    setMode(next);
    start(() => { void setRunMode(next as "off" | "start"); });
  }

  return (
    <div className={"runmode" + (live ? " live" : "")}>
      <span className={"runmode-dot" + (live ? " on" : "")} />
      <div className="runmode-meta">
        <div className="runmode-label">{live ? t("chrome.runmode.running") : t("chrome.runmode.paused")}</div>
        <div className="runmode-sub mono">{live ? `--${mode}` : t("chrome.runmode.loopStopped")}</div>
      </div>
      <button className="runmode-btn" onClick={toggle} disabled={pending}>
        {live ? t("chrome.runmode.pause") : t("common.start")}
      </button>
    </div>
  );
}
