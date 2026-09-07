"use client";

import { useState, useTransition } from "react";
import { togglePlugin, installPlugin, removePlugin } from "@/server/actions/plugin-actions";
import { Icon } from "@/components/ui/icon";
import { useT } from "@/lib/i18n-context";

type Plugin = { id: string; name: string; description: string; enabled: boolean; native: boolean };

/** Topbar action — "Install from URL" (mock right slot). Prompts for a URL/name, then installs. */
export function InstallPlugin() {
  const t = useT();
  const [pending, start] = useTransition();
  function install() {
    const url = window.prompt(t("plugins.installPrompt"));
    if (!url || !url.trim()) return;
    start(async () => { await installPlugin(url.trim()); });
  }
  return (
    <button className="btn-accent" disabled={pending} onClick={install}>
      <Icon name="add" size={14} /> {t("plugins.installFromUrl")}
    </button>
  );
}

/** One plugin list-row with a real toggle (mock `.lrow`). */
export function PluginGrid({ plugins }: { plugins: Plugin[] }) {
  return (
    <>
      {plugins.map((p) => (
        <PluginRow key={p.id} plugin={p} />
      ))}
    </>
  );
}

function PluginRow({ plugin: p }: { plugin: Plugin }) {
  const t = useT();
  const [pending, start] = useTransition();
  return (
    <div className="lrow">
      <div className="vh-icon" style={{ width: 34, height: 34, flex: "0 0 34px" }}><Icon name="ext" size={16} /></div>
      <div className="lr-main">
        <div className="lr-title">
          {p.name} {p.native && <span className="pill" style={{ background: "var(--accent)22", color: "var(--accent)" }}>{t("plugins.native")}</span>}
        </div>
        <div className="lr-sub">{p.description}</div>
      </div>
      {!p.native && (
        <button className="btn-ghost" disabled={pending} onClick={() => start(() => { removePlugin(p.id); })}>
          <Icon name="trash" size={13} /> {t("common.remove")}
        </button>
      )}
      <div
        className={"toggle" + (p.enabled ? " on" : "")}
        role="switch"
        aria-checked={p.enabled}
        aria-disabled={pending}
        onClick={() => !pending && start(() => { togglePlugin(p.id, !p.enabled); })}
      />
    </div>
  );
}
