"use client";

import { useState, useTransition } from "react";
import { saveAgentModel } from "@/server/agents";
import { toggleAgentSkill } from "@/server/skills";
import { useT } from "@/lib/i18n-context";

type Skill = { id: string; name: string; provisional: boolean };

export function AgentModelForm({ agentId, adapter, model, temperature, dailyCapUsd, tierFloor, providers, skills, enabledIds }: {
  agentId: string; adapter: string; model: string; temperature: number; dailyCapUsd: number; tierFloor: string;
  providers: string[]; skills: Skill[]; enabledIds: string[];
}) {
  const t = useT();
  const [tab, setTab] = useState<"model" | "skills">("model");
  const [a, setA] = useState(adapter);
  const [m, setM] = useState(model);
  const [temp, setTemp] = useState(temperature);
  const [cap, setCap] = useState(dailyCapUsd);
  const [tier, setTier] = useState(tierFloor);
  const [enabled, setEnabled] = useState(new Set(enabledIds));
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  function save() { start(async () => { await saveAgentModel(agentId, { adapter: a, model: m, temperature: temp, dailyCapUsd: cap, tierFloor: tier as never }); setSaved(true); setTimeout(() => setSaved(false), 1500); }); }
  function toggle(id: string) {
    const on = !enabled.has(id);
    setEnabled((s) => { const n = new Set(s); on ? n.add(id) : n.delete(id); return n; });
    start(() => toggleAgentSkill(agentId, id, on));
  }
  const tempLabel = temp <= 0.3 ? t("models.temp.precise") : temp <= 0.6 ? t("models.temp.balanced") : temp <= 0.85 ? t("models.temp.creative") : t("models.temp.exploratory");

  return (
    <div>
      <div className="as-tabs">
        <button className={"as-tab" + (tab === "model" ? " on" : "")} onClick={() => setTab("model")}>{t("models.tab.model")}</button>
        <button className={"as-tab" + (tab === "skills" ? " on" : "")} onClick={() => setTab("skills")}>{t("models.tab.skills")}</button>
        {saved && <span style={{ marginLeft: "auto", color: "var(--sx-string)", fontSize: 12 }}>✓ {t("common.saved")}</span>}
      </div>

      {tab === "model" ? (
        <div style={{ maxWidth: 640 }}>
          <div className="set-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div><label className="form-label">{t("models.field.provider")}</label>
              <select className="form-input" value={a} onChange={(e) => setA(e.target.value)}>{providers.map((p) => <option key={p}>{p}</option>)}</select></div>
            <div><label className="form-label">{t("models.field.model")}</label>
              <input className="form-input mono" value={m} onChange={(e) => setM(e.target.value)} /></div>
          </div>
          <label className="form-label">{t("models.field.temperature")} · {temp.toFixed(2)} · {tempLabel}</label>
          <input type="range" min={0} max={1} step={0.05} value={temp} onChange={(e) => setTemp(+e.target.value)} style={{ width: "100%" }} />
          <div className="set-grid" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 6 }}>
            <div><label className="form-label">{t("models.field.dailyCap")}</label>
              <input className="form-input mono" value={"$" + cap} onChange={(e) => setCap(Math.max(0, parseFloat(e.target.value.replace(/[^0-9.]/g, "")) || 0))} /></div>
            <div><label className="form-label">{t("models.field.tierFloor")}</label>
              <select className="form-input" value={tier} onChange={(e) => setTier(e.target.value)}><option value="light">{t("models.tier.light")}</option><option value="heavy">{t("models.tier.heavy")}</option><option value="critical">{t("models.tier.critical")}</option></select></div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
            <button className="btn-accent" disabled={pending} onClick={save}>✓ {t("models.btn.saveModel")}</button>
          </div>
        </div>
      ) : (
        <div className="card" style={{ maxWidth: 640 }}>
          {skills.map((s) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 0", borderBottom: "1px solid var(--border-subtle)" }}>
              <span className="mono" style={{ flex: 1, fontSize: 12.5 }}>{s.name}{s.provisional && <span style={{ marginLeft: 8, fontSize: 10, color: "var(--sx-number)" }}>{t("models.skill.provisional")}</span>}</span>
              <button className={"as-toggle" + (enabled.has(s.id) ? " on" : "")} onClick={() => toggle(s.id)} aria-label={t("models.skill.toggleAria")} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
