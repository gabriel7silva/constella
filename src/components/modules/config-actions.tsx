"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/ui/icon";
import { useT } from "@/lib/i18n-context";
import { updateWorkspace, setMonthlyCap, setEditorSettings, toggleIntegration, setAgentRuntime } from "@/server/actions/config-actions";

type Editor = { tabSize?: number; formatOnSave?: boolean; wordWrap?: boolean; minimap?: boolean };

/** Editor preferences — real, persisted to workspace.settings.editor. */
export function EditorSettings({ editor }: { editor?: Editor }) {
  const t = useT();
  const [s, setS] = useState<Required<Editor>>({ tabSize: editor?.tabSize ?? 2, formatOnSave: editor?.formatOnSave ?? true, wordWrap: editor?.wordWrap ?? true, minimap: editor?.minimap ?? true });
  const [, start] = useTransition();
  function set(patch: Partial<Editor>) { setS((c) => ({ ...c, ...patch })); start(() => setEditorSettings(patch)); }
  const Toggle = (k: keyof Editor, label: string) => (
    <div className="set-row"><div className="sr-main"><div className="sr-title">{label}</div></div><div className={"toggle" + (s[k] ? " on" : "")} onClick={() => set({ [k]: !s[k] } as Partial<Editor>)} /></div>
  );
  return (
    <>
      <div className="set-row" style={{ paddingTop: 0 }}><div className="sr-main"><div className="sr-title">{t("config.editor.tabSize")}</div></div>
        <div style={{ display: "flex", gap: 6 }}>{[2, 4, 8].map((n) => <button key={n} className="chip-sm" style={s.tabSize === n ? { background: "var(--accent)", color: "var(--accent-fg)" } : undefined} onClick={() => set({ tabSize: n })}>{n}</button>)}</div>
      </div>
      {Toggle("formatOnSave", t("config.editor.formatOnSave"))}
      {Toggle("wordWrap", t("config.editor.wordWrap"))}
      {Toggle("minimap", t("config.editor.minimap"))}
    </>
  );
}

/** Parallel-agent runtime — concurrency + per-file lock, persisted to workspace.settings.agents. */
export function AgentRuntimeSettings({ agents }: { agents?: { maxConcurrent?: number; fileLocks?: boolean; webResearch?: boolean } }) {
  const t = useT();
  const [n, setN] = useState(agents?.maxConcurrent ?? 1);
  const [locks, setLocks] = useState(!!agents?.fileLocks);
  const [web, setWeb] = useState(agents?.webResearch ?? true);
  const [, start] = useTransition();
  const setConc = (v: number) => { setN(v); start(() => setAgentRuntime({ maxConcurrent: v })); };
  const toggleLocks = () => { const on = !locks; setLocks(on); start(() => setAgentRuntime({ fileLocks: on })); };
  const toggleWeb = () => { const on = !web; setWeb(on); start(() => setAgentRuntime({ webResearch: on })); };
  return (
    <>
      <div className="set-row" style={{ paddingTop: 0 }}>
        <div className="sr-main"><div className="sr-title">{t("config.agents.parallel")}</div><div className="sr-sub">{t("config.agents.parallelDesc")}</div></div>
        <div style={{ display: "flex", gap: 6 }}>{[1, 2, 3, 4, 5].map((v) => <button key={v} className="chip-sm" style={n === v ? { background: "var(--accent)", color: "var(--accent-fg)" } : undefined} onClick={() => setConc(v)}>{v}</button>)}</div>
      </div>
      <div className="set-row">
        <div className="sr-main"><div className="sr-title">{t("config.agents.fileLock")}</div><div className="sr-sub">{t("config.agents.fileLockDesc")}</div></div>
        <div className={"toggle" + (locks ? " on" : "")} onClick={toggleLocks} />
      </div>
      {n > 1 && !locks && <div className="sr-sub" style={{ color: "#e8a14e", paddingBottom: 6 }}>⚠ {t("config.agents.lockWarn", { n })}</div>}
      <div className="set-row">
        <div className="sr-main"><div className="sr-title">{t("config.agents.webResearch")}</div><div className="sr-sub">{t("config.agents.webResearchDesc")}</div></div>
        <div className={"toggle" + (web ? " on" : "")} onClick={toggleWeb} />
      </div>
    </>
  );
}

const INTEGRATIONS = ["github", "telegram", "ollama", "webhooks"] as const;

/** Integration toggles — real, persisted to workspace.settings.integrations. */
export function IntegrationsGroup({ enabled }: { enabled?: Record<string, boolean> }) {
  const t = useT();
  const [map, setMap] = useState<Record<string, boolean>>(enabled ?? {});
  const [, start] = useTransition();
  function toggle(id: string) { const on = !map[id]; setMap((m) => ({ ...m, [id]: on })); start(() => toggleIntegration(id, on)); }
  return (
    <>
      {INTEGRATIONS.map((id) => (
        <div className="set-row" key={id}><div className="sr-main"><div className="sr-title">{t(`config.integ.${id}.name`)}</div><div className="sr-sub">{t(`config.integ.${id}.desc`)}</div></div><div className={"toggle" + (map[id] ? " on" : "")} onClick={() => toggle(id)} /></div>
      ))}
    </>
  );
}

/** Mission & objective — real, persisted to the workspace row. */
export function MissionForm({ mission, objective }: { mission: string; objective: string }) {
  const t = useT();
  const [m, setM] = useState(mission);
  const [o, setO] = useState(objective);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const dirty = m !== mission || o !== objective;

  function save() {
    start(async () => {
      await updateWorkspace({ mission: m, objective: o });
      setSaved(true);
      setTimeout(() => setSaved(false), 1600);
    });
  }

  return (
    <>
      <div className="set-grid" style={{ gridTemplateColumns: "1fr", gap: 12, marginTop: 4 }}>
        <div className="form-field">
          <label className="form-label">{t("config.mission.label")}</label>
          <input className="form-input" value={m} onChange={(e) => setM(e.target.value)} placeholder={t("config.mission.placeholder")} />
        </div>
        <div className="form-field">
          <label className="form-label">{t("config.objective.label")}</label>
          <input className="form-input" value={o} onChange={(e) => setO(e.target.value)} placeholder={t("config.objective.placeholder")} />
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        {saved
          ? <span className="oauth-ok" style={{ padding: "6px 11px" }}><Icon name="check" size={13} /> {t("common.saved")}</span>
          : <button className="btn-accent" disabled={pending || !dirty} onClick={save}><Icon name="check" size={14} /> {pending ? t("common.saving") : t("config.mission.save")}</button>}
      </div>
    </>
  );
}

/** Monthly budget cap (USD) — real, persisted to the budget row. */
export function BudgetForm({ cap }: { cap: number }) {
  const t = useT();
  const [v, setV] = useState(String(cap));
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const parsed = Number(v);
  const dirty = Number.isFinite(parsed) && Math.round(parsed) !== cap;

  function save() {
    start(async () => {
      const r = await setMonthlyCap(parsed);
      setV(String(r.monthlyCapUsd));
      setSaved(true);
      setTimeout(() => setSaved(false), 1600);
    });
  }

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 10, marginTop: 4, flexWrap: "wrap" }}>
      <div className="form-field" style={{ marginBottom: 0 }}>
        <label className="form-label">{t("config.budget.cap")}</label>
        <input className="form-input" type="number" min={0} step={10} value={v} onChange={(e) => setV(e.target.value)} style={{ width: 160 }} />
      </div>
      {saved
        ? <span className="oauth-ok" style={{ padding: "6px 11px" }}><Icon name="check" size={13} /> {t("common.saved")}</span>
        : <button className="btn-accent" disabled={pending || !dirty} onClick={save}><Icon name="check" size={14} /> {pending ? t("common.saving") : t("config.budget.save")}</button>}
    </div>
  );
}
