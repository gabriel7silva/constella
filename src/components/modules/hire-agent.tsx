"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { hireAgent, checkAdapterReady } from "@/server/agents";
import { PROVIDER_CATALOG } from "@/data/providers-catalog";
import { cliModelOptions, HIDDEN_CLI_PROVIDERS } from "@/data/model-options";
import { Dropdown } from "@/components/ui/dropdown";
import { Icon } from "@/components/ui/icon";
import { EffortChips, type EffortLevel } from "@/components/ui/effort-chips";
import { useT } from "@/lib/i18n-context";

// CLI providers that have a model allowlist (the server validates against CLI_MODELS; offering only the
// adapters with model options keeps the dropdown honest). OpenClaw / Hermes / Gemini are retired (shared
// HIDDEN_CLI_PROVIDERS — OpenClaw's Gateway device-auth, Hermes' login flow, Gemini CLI discontinued).
const CLI_PROVIDERS = PROVIDER_CATALOG.filter((p) => p.category === "cli" && cliModelOptions(p.defaultAdapter) && !HIDDEN_CLI_PROVIDERS.has(p.id));

const TIERS = ["light", "heavy", "critical"] as const;
const cleanHandle = (s: string) => s.toLowerCase().replace(/[^a-z0-9_-]/g, "");

/** "Hire Agent" — adds a runtime agent (Claude Code / Codex / Gemini / …) reporting to the CEO, with a
 *  blocking pre-flight that the chosen CLI is installed + logged in. Button + modal in one (like NewGoalButton). */
export function HireAgentButton({ agents }: { agents: { handle: string; name: string }[] }) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [role, setRole] = useState("");
  const [adapter, setAdapter] = useState(CLI_PROVIDERS[0]?.defaultAdapter ?? "cli_claude_code");
  const [model, setModel] = useState("(default)");
  const [reportsTo, setReportsTo] = useState(agents.find((a) => a.handle === "ada") ? "ada" : (agents[0]?.handle ?? ""));
  const [tier, setTier] = useState<(typeof TIERS)[number]>("heavy");
  const [effort, setEffort] = useState<EffortLevel>("medium");
  const [cap, setCap] = useState(15);
  const [identity, setIdentity] = useState("");
  const [ritual, setRitual] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");

  const [ready, setReady] = useState<{ bin: string; installed: boolean; auth: string; hint: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  const modelOpts = cliModelOptions(adapter) ?? [{ value: "(default)", label: t("hire.model.default") }];

  // Reset the model when the provider changes (first option of the new adapter).
  useEffect(() => { setModel((cliModelOptions(adapter) ?? [])[0]?.value ?? "(default)"); }, [adapter]);

  // Live pre-flight: is this CLI installed + logged in on the host? (Re-runs when the modal opens.)
  useEffect(() => {
    if (!open) return;
    let alive = true; setChecking(true); setReady(null); setErr("");
    checkAdapterReady(adapter).then((r) => { if (alive) { setReady(r); setChecking(false); } }).catch(() => { if (alive) setChecking(false); });
    return () => { alive = false; };
  }, [adapter, open]);

  const isReady = !!ready?.installed && ready?.auth === "ready";
  const canSubmit = !!handle.trim() && !!name.trim() && !!role.trim() && isReady && !pending;

  function submit() {
    setErr("");
    start(async () => {
      const r = await hireAgent({ handle, name, role, adapter, model, reportsTo: reportsTo || null, tierFloor: tier, effort, dailyCapUsd: cap, identity, ritual, systemPrompt });
      if (!r.ok) { setErr(r.error || t("hire.error.generic")); return; }
      setOpen(false); router.refresh();
    });
  }

  return (
    <>
      <button className="btn-accent" onClick={() => setOpen(true)}><Icon name="add" size={13} /> {t("hire.button")}</button>
      {open && (
        <div className="modal-overlay" onMouseDown={() => !pending && setOpen(false)}>
          <div className="modal" style={{ width: 560, maxWidth: "94vw", maxHeight: "90vh", overflow: "auto" }} onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head"><div className="modal-title"><Icon name="bot" size={16} /> {t("hire.title")}</div></div>
            <div className="modal-body" style={{ display: "grid", gap: 12 }}>
              <div className="set-desc" style={{ marginTop: -2 }}>{t("hire.sub")}</div>

              <div className="set-grid">
                <div className="form-field"><label className="form-label">{t("hire.name")}</label>
                  <input className="form-input" autoFocus value={name} onChange={(e) => { setName(e.target.value); if (!handle) setHandle(cleanHandle(e.target.value)); }} placeholder="Otto" /></div>
                <div className="form-field"><label className="form-label">{t("hire.handle")}</label>
                  <input className="form-input mono" value={handle} onChange={(e) => setHandle(cleanHandle(e.target.value))} placeholder="otto" /></div>
              </div>
              <div className="form-field"><label className="form-label">{t("hire.role")}</label>
                <input className="form-input" value={role} onChange={(e) => setRole(e.target.value)} placeholder={t("hire.rolePh")} /></div>

              <div className="set-grid">
                <div className="form-field"><label className="form-label">{t("hire.provider")}</label>
                  <Dropdown glyph value={adapter} options={CLI_PROVIDERS.map((p) => ({ value: p.defaultAdapter, label: p.displayName, glyphId: p.id }))} onChange={setAdapter} /></div>
                <div className="form-field"><label className="form-label">{t("hire.model")}</label>
                  <Dropdown mono value={model} options={modelOpts} onChange={setModel} /></div>
              </div>

              {/* Blocking pre-flight: the CLI must be installed + logged in, or the agent dies on its first tick. */}
              <div className="modal-hint" style={{ color: isReady ? "var(--sx-string)" : "var(--sx-keyword)", marginTop: 0 }}>
                {checking ? <><span className="spin"><Icon name="refresh" size={12} /></span> {t("hire.preflight.checking")}</>
                  : isReady ? <><Icon name="check" size={12} /> {t("hire.preflight.ready", { bin: ready!.bin })}</>
                  : !ready?.installed ? <><Icon name="warn" size={12} /> {t("hire.preflight.notInstalled", { bin: ready?.bin ?? adapter })}</>
                  : <><Icon name="warn" size={12} /> {t("hire.preflight.notLogged", { hint: ready?.hint ?? "" })}</>}
              </div>

              <div className="set-grid">
                <div className="form-field"><label className="form-label">{t("hire.reportsTo")}</label>
                  <Dropdown value={reportsTo} options={[{ value: "", label: t("hire.reportsToNone") }, ...agents.map((a) => ({ value: a.handle, label: "@" + a.handle + " · " + a.name }))]} onChange={setReportsTo} /></div>
                <div className="form-field"><label className="form-label">{t("hire.tier")}</label>
                  <Dropdown value={tier} options={TIERS.map((x) => ({ value: x, label: t("hire.tier." + x) }))} onChange={(v) => setTier(v as (typeof TIERS)[number])} /></div>
              </div>
              <div className="set-grid">
                <div className="form-field"><label className="form-label">{t("hire.dailyCap")}</label>
                  <input className="form-input" type="number" min={1} step={5} value={cap} onChange={(e) => setCap(Number(e.target.value) || 0)} style={{ width: 150 }} /></div>
                <div className="form-field"><label className="form-label">{t("agent.effort.label")}</label>
                  <EffortChips value={effort} onChange={setEffort} />
                </div>
              </div>

              <div className="form-field"><label className="form-label">{t("hire.identity")}</label>
                <input className="form-input" value={identity} onChange={(e) => setIdentity(e.target.value)} placeholder={t("hire.identityPh")} /></div>
              <div className="form-field"><label className="form-label">{t("hire.ritual")}</label>
                <input className="form-input" value={ritual} onChange={(e) => setRitual(e.target.value)} placeholder={t("hire.ritualPh")} /></div>
              <div className="form-field"><label className="form-label">{t("hire.systemPrompt")}</label>
                <textarea className="form-input mono" rows={3} value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} placeholder={t("hire.systemPromptPh")} /></div>

              {err && <div className="form-hint" style={{ color: "var(--sx-keyword)" }}><Icon name="close" size={12} /> {err}</div>}
            </div>
            <div className="modal-foot">
              <button className="btn-ghost" onClick={() => setOpen(false)} disabled={pending}>{t("common.cancel")}</button>
              <button className="btn-accent" disabled={!canSubmit} onClick={submit}><Icon name="bot" size={14} /> {pending ? t("hire.creating") : t("hire.create")}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
