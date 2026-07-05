"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { saveAgentModel, saveAgentPersona, saveAgentRag, saveAgentImage, deleteAgent } from "@/server/agents";
import { AvatarUpload } from "@/components/ui/avatar-upload";
import { toggleAgentSkill, setAllAgentSkills } from "@/server/skills";
import { pullModel } from "@/server/local-models";
import { getEvents } from "@/server/events";
import { Icon } from "@/components/ui/icon";
import { Dropdown } from "@/components/ui/dropdown";
import { Avatar } from "@/components/ui/avatar";
import { ModelPicker, type ConnectedProvider } from "@/components/ui/model-picker";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EffortChips, type EffortLevel } from "@/components/ui/effort-chips";
import { useT } from "@/lib/i18n-context";

const WF_KINDS = ["read", "create", "edit", "run", "search"] as const;

/** Live view of the selected agent's current run, fed by the runtime event stream. */
function WorkflowLive({ agentId }: { agentId: string }) {
  const t = useT();
  const [steps, setSteps] = useState<{ id: string; runId: string; agentId: string | null; seq: number; kind: string; target: string }[]>([]);
  const seqRef = useRef(0);
  useEffect(() => {
    let alive = true;
    // Reset when switching agents — don't carry the previous agent's steps or advance past the new agent's
    // earlier events (which would render the wrong agent's run and skip the new one).
    setSteps([]);
    seqRef.current = 0;
    async function poll() {
      const rows = (await getEvents("room", seqRef.current)) as typeof steps;
      if (!alive) return;
      if (rows.length) seqRef.current = Math.max(seqRef.current, ...rows.map((r) => r.seq));
      const mine = rows.filter((r) => r.agentId === agentId);
      if (mine.length) setSteps((cur) => { const seen = new Set(cur.map((s) => s.id)); return [...cur, ...mine.filter((r) => !seen.has(r.id))]; });
    }
    poll();
    const t = setInterval(poll, 1500);
    return () => { alive = false; clearInterval(t); };
  }, [agentId]);

  if (steps.length === 0) return null;
  const runs = [...new Set(steps.map((s) => s.runId))];
  const latest = runs[runs.length - 1];
  const cur = steps.filter((s) => s.runId === latest && (WF_KINDS as readonly string[]).includes(s.kind));
  if (cur.length === 0) return null;
  return (
    <div className="card" style={{ marginBottom: 14, borderColor: "var(--accent)" }}>
      <div className="set-desc" style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}><span className="spin"><Icon name="refresh" size={12} /></span> {t("agent.wf.liveRun", { n: cur.length })}</div>
      {cur.map((s) => (
        <div className="live-step" key={s.id}><span className="ls-ico" style={{ color: "var(--accent)", fontFamily: "var(--mono-font)", fontSize: 11 }}>{(WF_KINDS as readonly string[]).includes(s.kind) ? t(`agent.wf.${s.kind}`) : s.kind}</span> {s.target}</div>
      ))}
    </div>
  );
}

type Skill = { id: string; name: string; provisional: boolean; category: string };
type Persona = { identity: string; ritual: string; tone: string; systemPrompt: string };
type ProviderOpt = { value: string; label: string; glyphId: string };

const TABS = ["model", "skills", "persona", "rag", "workflow"] as const;

function budgetLevel(spent: number, cap: number) {
  const pct = cap > 0 ? Math.min(100, (spent / cap) * 100) : 0;
  const level = pct >= 90 ? "crit" : pct >= 70 ? "warn" : "ok";
  const color = level === "crit" ? "var(--sx-keyword)" : level === "warn" ? "var(--sx-number)" : "var(--sx-string)";
  return { pct, level, color };
}
const usd = (n: number) => "$" + n.toFixed(2);

function TemperatureControl({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const t = useT();
  const label = value <= 0.3 ? t("agent.temp.precise") : value <= 0.6 ? t("agent.temp.balanced") : value <= 0.85 ? t("agent.temp.creative") : t("agent.temp.exploratory");
  return (
    <div className="temp-wrap">
      <div className="temp-head"><label className="form-label" style={{ margin: 0 }}>{t("agent.temp.label")}</label><span className="temp-val">{value.toFixed(2)} · {label}</span></div>
      <input type="range" className="temp-range" min={0} max={1} step={0.05} value={value} onChange={(e) => onChange(+e.target.value)} />
      <div className="temp-scale"><span>{t("agent.temp.scaleFocused")}</span><span>0.5</span><span>{t("agent.temp.scaleCreative")}</span></div>
      <div className="temp-desc"><span className="ti"><Icon name="bot" size={12} /></span> {t("agent.temp.desc")}</div>
    </div>
  );
}

/** Reasoning-effort selector — a 4-step segmented control (low → max), mirroring the temperature slider. */
function EffortControl({ value, onChange }: { value: string; onChange: (v: EffortLevel) => void }) {
  const t = useT();
  return (
    <div className="temp-wrap">
      <div className="temp-head"><label className="form-label" style={{ margin: 0 }}>{t("agent.effort.label")}</label><span className="temp-val">{t("agent.effort." + value)}</span></div>
      <div style={{ marginTop: 2 }}><EffortChips value={value} onChange={onChange} /></div>
      <div className="temp-desc"><span className="ti"><Icon name="bot" size={12} /></span> {t("agent.effort.desc")}</div>
    </div>
  );
}

function BudgetBar({ spent, cap }: { spent: number; cap: number }) {
  const t = useT();
  const { pct, level, color } = budgetLevel(spent, cap);
  const note = level === "crit" ? t("agent.budget.noteCrit") : level === "warn" ? t("agent.budget.noteWarn") : t("agent.budget.noteOk");
  return (
    <div className="budget">
      <div className="budget-top">
        <span className="budget-spent">{usd(spent)}</span>
        <span className="budget-cap">{t("agent.budget.dailyCap", { cap: usd(cap) })}</span>
        <span className="budget-pct" style={{ background: color + "22", color }}>{Math.round(pct)}%</span>
      </div>
      <div className="budget-track"><div className="budget-fill" style={{ width: pct + "%", background: color }} /></div>
      <div className={"budget-note " + level}>{level === "ok" ? <Icon name="check" size={12} /> : <Icon name="warn" size={12} />} {note}</div>
    </div>
  );
}

type RagDoc = { path: string; chunks: number; source: string };
type RagState = { repo: boolean; room: boolean; reports: boolean; skills: boolean; external: boolean; sources?: string[] };
const RAG_SRC_META: Record<string, { color: string }> = {
  repo: { color: "var(--accent)" },
  reports: { color: "var(--sx-property)" },
  skills: { color: "var(--sx-string)" },
  room: { color: "#c4a0ff" },
  external: { color: "#6cc7e0" },
};

/** Interactive RAG memory map — radial layout of the real indexed documents (from ragChunk). */
function RagMap({ docs }: { docs: RagDoc[] }) {
  const t = useT();
  const [tip, setTip] = useState<{ x: number; y: number; name: string; chunks: number } | null>(null);
  const totalChunks = docs.reduce((a, d) => a + d.chunks, 0);
  const totalTok = totalChunks * 120;
  const placed = docs.map((d, i) => {
    const ang = (i / Math.max(1, docs.length)) * Math.PI * 2;
    const r = 26 + (i % 3) * 9;
    const meta = RAG_SRC_META[d.source] ?? RAG_SRC_META.repo;
    return { x: 50 + Math.cos(ang) * r, y: 50 + Math.sin(ang) * r, sz: Math.min(18, 6 + d.chunks * 0.7), color: meta.color, name: d.path.split("/").pop() ?? d.path, chunks: d.chunks, source: d.source };
  });
  const srcOrder = [...new Set(docs.map((d) => d.source))].map((k) => ({ key: k, ...(RAG_SRC_META[k] ?? RAG_SRC_META.repo) }));
  return (
    <div className="ragm">
      <div className="ragm-stats">
        <div className="ragm-stat"><div className="rs-n">{docs.length}</div><div className="rs-l">{t("agent.rag.statDocuments")}</div></div>
        <div className="ragm-stat"><div className="rs-n">{totalChunks}</div><div className="rs-l">{t("agent.rag.statChunks")}</div></div>
        <div className="ragm-stat"><div className="rs-n">{totalChunks}</div><div className="rs-l">{t("agent.rag.statVectors")}</div></div>
        <div className="ragm-stat"><div className="rs-n">{(totalTok / 1000).toFixed(1)}k</div><div className="rs-l">{t("agent.rag.statTokens")}</div></div>
      </div>
      <div className="ragm-canvas">
        <svg className="ragm-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
          {placed.map((p, i) => <line key={i} x1="50" y1="50" x2={p.x} y2={p.y} stroke={p.color} strokeOpacity="0.28" strokeWidth="0.4" vectorEffect="non-scaling-stroke" />)}
        </svg>
        <div className="ragm-core"><div><div className="rc-t">RAG</div><div className="rc-s">{t("agent.rag.coreDocs", { n: docs.length })}</div></div></div>
        {placed.map((p, i) => (
          <div key={i} className="ragm-node" style={{ left: p.x + "%", top: p.y + "%", width: p.sz, height: p.sz, background: p.color, boxShadow: "0 0 8px " + p.color + "66" }}
               onMouseEnter={() => setTip({ x: p.x, y: p.y, name: p.name, chunks: p.chunks })} onMouseLeave={() => setTip(null)} />
        ))}
        {tip && <div className="ragm-tip" style={{ left: tip.x + "%", top: tip.y + "%" }}>
          <div className="tt-t">{tip.name}</div><div className="tt-s">{t("agent.rag.tipChunks", { n: tip.chunks, tok: tip.chunks * 120 })}</div>
        </div>}
        {placed.length === 0 && <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "var(--text-faint)", fontSize: 12.5 }}>{t("agent.rag.nothingIndexed")}</div>}
        <div className="ragm-legend">{srcOrder.map((s) => <div className="lg" key={s.key}><span className="dot" style={{ background: s.color }} /> {t(`agent.rag.src.${s.key}`)}</div>)}</div>
      </div>
      <div className="ragm-docs">
        {docs.slice().sort((a, b) => b.chunks - a.chunks).slice(0, 24).map((d, i) => {
          const meta = RAG_SRC_META[d.source] ?? RAG_SRC_META.repo;
          return (
            <div className="ragm-doc" key={i}>
              <span className="src-chip" style={{ background: meta.color + "22", color: meta.color }}>{t(`agent.rag.src.${d.source}`)}</span>
              <span className="rd-t">{d.path}</span>
              <div className="rd-bar"><i style={{ width: Math.min(100, d.chunks * 4) + "%", background: meta.color }} /></div>
              <span className="rd-chunks">{t("agent.rag.chunksAbbr", { n: d.chunks })}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AgentStudioDetail(props: {
  agentId: string; handle: string; name: string; role: string; color: string; image?: string | null;
  reportsTo: string | null; status: string; health: "alive" | "stale" | "down"; origin: string;
  adapter: string; model: string; temperature: number; effort: string; dailyCapUsd: number; tierFloor: string;
  persona: Persona; spentToday: number; providerOpts: ProviderOpt[];
  skills: Skill[]; enabledIds: string[]; fileCount: number;
  rag: RagState; ragDocs: RagDoc[]; providers: ConnectedProvider[];
}) {
  const t = useT();
  const router = useRouter();
  const [tab, setTab] = useState("model");
  const [img, setImg] = useState<string | null>(props.image ?? null);
  const [a, setA] = useState(props.adapter);
  const [m, setM] = useState(props.model);
  const [temp, setTemp] = useState(props.temperature);
  const [eff, setEff] = useState(props.effort ?? "medium");
  const [cap, setCap] = useState(props.dailyCapUsd);
  const [tier, setTier] = useState(props.tierFloor);
  const [identity, setIdentity] = useState(props.persona.identity);
  const [ritual, setRitual] = useState(props.persona.ritual);
  const [tone, setTone] = useState(props.persona.tone);
  const [sys, setSys] = useState(props.persona.systemPrompt);
  const [enabled, setEnabled] = useState(new Set(props.enabledIds));
  const [saved, setSaved] = useState("");
  const [pending, start] = useTransition();
  const [rag, setRag] = useState<RagState>(props.rag);
  const [upload, setUpload] = useState(false);
  const [pullName, setPullName] = useState("");
  const [pullMsg, setPullMsg] = useState("");
  const [pullErr, setPullErr] = useState(false);
  const [addSrc, setAddSrc] = useState(false);
  const [srcUrl, setSrcUrl] = useState("");
  const [skillQ, setSkillQ] = useState("");           // skills tab: name search
  const [skillCat, setSkillCat] = useState("all");    // skills tab: category filter
  const [fireOpen, setFireOpen] = useState(false);
  const [fireErr, setFireErr] = useState("");

  // Re-seed every field when the operator switches agents (Ada→Barbara) so nothing sticks.
  useEffect(() => {
    setTab("model"); setA(props.adapter); setM(props.model); setTemp(props.temperature); setEff(props.effort ?? "medium");
    setCap(props.dailyCapUsd); setTier(props.tierFloor);
    setIdentity(props.persona.identity); setRitual(props.persona.ritual); setTone(props.persona.tone); setSys(props.persona.systemPrompt);
    setEnabled(new Set(props.enabledIds)); setRag(props.rag); setSaved("");
    setUpload(false); setAddSrc(false); setPullName(""); setPullMsg(""); setPullErr(false); setSrcUrl("");
    setSkillQ(""); setSkillCat("all");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.agentId]);

  function flash(s: string) { setSaved(s); setTimeout(() => setSaved(""), 1500); }
  function saveModel() { start(async () => { await saveAgentModel(props.agentId, { adapter: a, model: m, temperature: temp, effort: eff as never, dailyCapUsd: cap, tierFloor: tier as never }); flash(t("agent.flash.modelSaved")); }); }
  function confirmFire() {
    setFireErr("");
    start(async () => { const r = await deleteAgent(props.agentId); if (r.ok) router.push("/org"); else setFireErr(r.error || t("agent.fire.error")); });
  }
  function savePersona() { start(async () => { await saveAgentPersona(props.agentId, { identity, ritual, tone, systemPrompt: sys }); flash(t("agent.flash.personaSaved")); }); }
  function persistRag(next: RagState) { setRag(next); start(async () => { await saveAgentRag(props.agentId, next); flash(t("agent.flash.ragSaved")); }); }
  function toggleRag(k: keyof RagState) { persistRag({ ...rag, [k]: !rag[k] }); }
  function addSource() {
    if (!srcUrl.trim()) return;
    persistRag({ ...rag, external: true, sources: [...(rag.sources ?? []), srcUrl.trim()] });
    setSrcUrl(""); setAddSrc(false);
  }
  function pull() { start(async () => { setPullErr(false); setPullMsg(t("agent.model.pulling")); const r = await pullModel(pullName.trim()); if (r.ok) { setA("local_ollama"); setM(pullName.trim()); setUpload(false); setPullName(""); setPullMsg(""); flash(t("agent.flash.modelPulled")); } else { setPullErr(true); setPullMsg(r.error ?? t("agent.model.pullFailed")); } }); }
  function toggleSkill(id: string) {
    const on = !enabled.has(id);
    setEnabled((s) => { const n = new Set(s); on ? n.add(id) : n.delete(id); return n; });
    start(() => toggleAgentSkill(props.agentId, id, on));
  }
  function setAll(on: boolean) {
    setEnabled(on ? new Set(props.skills.map((s) => s.id)) : new Set());
    start(() => setAllAgentSkills(props.agentId, on));
  }

  return (
    <div className="as-detail">
      <div className="as-head">
        <div className="as-hero">
          <AvatarUpload name={props.name} color={props.color} image={img} size={48} onChange={(p) => { setImg(p); start(() => saveAgentImage(props.agentId, p)); }} />
          <div style={{ flex: 1 }}>
            <div className="ah-name">{props.name} <span className="agent-handle">@{props.handle}</span></div>
            <div className="ah-sub">{props.role} · {t("agent.reportsTo", { who: props.reportsTo ? "@" + props.reportsTo : "—" })}</div>
          </div>
          <span className="pill" style={{ background: "var(--bg-active)", color: "var(--text-dim)" }}>{t(`agent.status.${props.status}`)}</span>
        </div>
      </div>
      <div className="as-tabs">
        {TABS.map((id) => <button key={id} className={"as-tab" + (tab === id ? " on" : "")} onClick={() => setTab(id)}>{t(`agent.tab.${id}`)}</button>)}
        {saved && <span className="oauth-ok" style={{ marginLeft: "auto", padding: "4px 10px", fontSize: 11.5 }}><Icon name="check" size={12} /> {saved}</span>}
      </div>

      <div className="as-body scroll">
        {tab === "model" && <div style={{ maxWidth: 1080 }}>
          <div className="set-grid">
            <div className="form-field"><label className="form-label">{t("agent.model.provider")}</label>
              <Dropdown glyph mono value={a} options={props.providerOpts} onChange={setA} />
            </div>
            <div className="form-field"><label className="form-label">{t("agent.model.model")}</label>
              <ModelPicker adapter={a} value={m} onChange={setM} providers={props.providers} />
              <div className="form-hint" style={{ justifyContent: "space-between" }}><span><Icon name="cpu" size={12} /> {t("agent.model.runnerHint")}</span></div>
            </div>
          </div>
          <div className="persona-field" style={{ marginTop: 14 }}><TemperatureControl value={temp} onChange={setTemp} /></div>
          <div className="persona-field" style={{ marginTop: 12 }}><EffortControl value={eff} onChange={setEff} /></div>
          <div className="set-grid" style={{ marginTop: 4 }}>
            <div className="form-field"><label className="form-label">{t("agent.model.dailyCap")}</label>
              <input className="form-input mono" value={"$" + cap} onChange={(e) => setCap(Math.max(0, parseFloat(e.target.value.replace(/[^0-9.]/g, "")) || 0))} />
            </div>
            <div className="form-field"><label className="form-label">{t("agent.model.tierFloor")}</label>
              <Dropdown value={tier} options={["light", "heavy", "critical"].map((v) => ({ value: v, label: t(`agent.tier.${v}`) }))} onChange={setTier} />
            </div>
          </div>
          <div className="card" style={{ marginTop: 14 }}>
            <div className="detail-label">{t("agent.model.budgetToday")}</div>
            <BudgetBar spent={props.spentToday} cap={cap} />
            <div className="modal-hint">{t("agent.model.budgetHint")}</div>
          </div>
          <div className="onb-foot" style={{ gap: 8 }}>
            {props.origin === "hired" && <button className="btn-ghost" style={{ color: "var(--sx-keyword)", marginRight: "auto" }} disabled={pending} onClick={() => { setFireErr(""); setFireOpen(true); }}><Icon name="trash" size={13} /> {t("agent.fire.button")}</button>}
            <button className="btn-ghost" onClick={() => setUpload(true)}><Icon name="add" size={13} /> {t("agent.model.uploadPull")}</button>
            <button className="btn-accent" disabled={pending} onClick={saveModel}><Icon name="check" size={13} /> {t("agent.model.saveModel")}</button>
          </div>
        </div>}

        {tab === "skills" && (() => {
          const cats = [...new Set(props.skills.map((s) => s.category))].sort();
          const catLabel = (c: string) => c.charAt(0).toUpperCase() + c.slice(1);
          const ql = skillQ.trim().toLowerCase();
          const shown = props.skills.filter((s) => (skillCat === "all" || s.category === skillCat) && (!ql || s.name.toLowerCase().includes(ql)));
          return <div style={{ maxWidth: 1080 }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 10, gap: 10 }}>
            <div className="set-desc" style={{ margin: 0 }}>{t("agent.skills.desc")} <span style={{ color: "var(--text-faint)" }}>· {t("agent.skills.onCount", { on: enabled.size, total: props.skills.length })}</span></div>
            <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
              <button className="btn-ghost" onClick={() => setAll(true)} disabled={props.skills.length === 0 || enabled.size === props.skills.length}><Icon name="check" size={12} /> {t("common.enableAll")}</button>
              <button className="btn-ghost" onClick={() => setAll(false)} disabled={enabled.size === 0}><Icon name="close" size={12} /> {t("common.disableAll")}</button>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <div className="cs-bar" style={{ flex: 1, minWidth: 220, margin: 0 }}>
              <Icon name="search" size={13} />
              <input value={skillQ} onChange={(e) => setSkillQ(e.target.value)} placeholder={t("agent.skills.search")} />
              {skillQ && <button className="ss-clear" onClick={() => setSkillQ("")}><Icon name="close" size={12} /></button>}
            </div>
            <Dropdown value={skillCat} options={[{ value: "all", label: t("agent.skills.allCategories") }, ...cats.map((c) => ({ value: c, label: catLabel(c) }))]} onChange={setSkillCat} />
            <span style={{ fontSize: 11, color: "var(--text-faint)", whiteSpace: "nowrap" }}>{t("agent.skills.shownCount", { shown: shown.length, total: props.skills.length })}</span>
          </div>
          {shown.map((s) => (
            <div className="skill-pick" key={s.id}>
              <Icon name="skill" size={15} style={{ color: "var(--accent)" }} />
              <div className="sp-main">
                <div className="sr-title mono" style={{ fontSize: 12.5 }}>{s.name} {s.provisional && <span className="pill" style={{ background: "var(--sx-number)22", color: "var(--sx-number)" }}>{t("agent.skills.provisional")}</span>}</div>
              </div>
              <span className="pill" style={{ background: "var(--bg-active)", color: "var(--text-faint)", fontSize: 10 }}>{catLabel(s.category)}</span>
              <div className={"toggle" + (enabled.has(s.id) ? " on" : "")} onClick={() => toggleSkill(s.id)} />
            </div>
          ))}
          {props.skills.length === 0 && <div className="muted" style={{ fontSize: 12.5, padding: "8px 0" }}>{t("agent.skills.empty")}</div>}
          {props.skills.length > 0 && shown.length === 0 && <div className="muted" style={{ fontSize: 12.5, padding: "8px 0" }}>{t("agent.skills.noMatch")}</div>}
          </div>;
        })()}

        {tab === "persona" && <div style={{ maxWidth: 1080 }}>
          <div className="persona-field"><label className="form-label">{t("agent.persona.identity")}</label>
            <textarea className="persona-ta" value={identity} onChange={(e) => setIdentity(e.target.value)} /></div>
          <div className="persona-field"><label className="form-label">{t("agent.persona.ritual")}</label>
            <textarea className="persona-ta" value={ritual} onChange={(e) => setRitual(e.target.value)} /></div>
          <div className="set-grid" style={{ marginBottom: 16 }}>
            <div className="form-field"><label className="form-label">{t("agent.persona.tone")}</label>
              <Dropdown value={tone} options={["Executive", "Friendly", "Direct", "Rigorous", "Precise", "Calm", "Clear", "Warm", "Measured"].map((v) => ({ value: v, label: t(`agent.tone.${v}`) }))} onChange={setTone} />
            </div>
          </div>
          <div className="persona-field"><label className="form-label">{t("agent.persona.systemPrompt")} <span style={{ color: "var(--text-faint)", fontWeight: 400 }}>· .md</span></label>
            <textarea className="persona-ta mono" rows={6} value={sys} onChange={(e) => setSys(e.target.value)} />
            <div className="modal-hint">{t("agent.persona.storedAsPrefix")} <b>.claude/agents/{props.handle}/SYSTEM.md</b> {t("agent.persona.storedAsSuffix")}</div>
          </div>
          <div className="onb-foot"><button className="btn-accent" disabled={pending} onClick={savePersona}><Icon name="check" size={13} /> {t("agent.persona.save")}</button></div>
        </div>}

        {tab === "rag" && <div style={{ maxWidth: 1080 }}>
          <RagMap docs={props.ragDocs} />
          <div className="set-desc" style={{ marginTop: 16, display: "flex", alignItems: "center" }}>
            <span>{t("agent.rag.sourcesDesc")}</span>
            <button className="btn-ghost" style={{ marginLeft: "auto", padding: "5px 11px" }} onClick={() => setAddSrc(true)}><Icon name="add" size={12} /> {t("agent.rag.addSource")}</button>
          </div>
          {([
            { k: "repo" as const, name: t("agent.rag.row.repo"), desc: t("agent.rag.row.repoDesc", { n: props.fileCount }) },
            { k: "room" as const, name: t("agent.rag.row.room"), desc: t("agent.rag.row.roomDesc") },
            { k: "reports" as const, name: t("agent.rag.row.reports"), desc: t("agent.rag.row.reportsDesc") },
            { k: "skills" as const, name: t("agent.rag.row.skills"), desc: t("agent.rag.row.skillsDesc", { n: props.skills.length }) },
            { k: "external" as const, name: t("agent.rag.row.external"), desc: rag.sources?.length ? t(rag.sources.length === 1 ? "agent.rag.sourcesConnected.one" : "agent.rag.sourcesConnected.other", { n: rag.sources.length }) : t("agent.rag.row.externalOff") },
          ]).map((r) => (
            <div className="skill-pick" key={r.k}>
              <Icon name="doc" size={15} style={{ color: "var(--accent)" }} />
              <div className="sp-main"><div className="sr-title">{r.name}</div><div className="sr-sub">{r.desc}</div></div>
              <div className={"toggle" + (rag[r.k] ? " on" : "")} onClick={() => toggleRag(r.k)} />
            </div>
          ))}
          {(rag.sources ?? []).map((s, i) => (
            <div className="skill-pick" key={"src-" + i} style={{ paddingLeft: 28 }}>
              <Icon name="goto" size={13} style={{ color: "var(--text-faint)" }} />
              <div className="sp-main"><div className="sr-title mono" style={{ fontSize: 12 }}>{s}</div></div>
              <button className="iact danger" title={t("agent.rag.removeSource")} onClick={() => persistRag({ ...rag, sources: (rag.sources ?? []).filter((_, j) => j !== i) })}><Icon name="trash" size={13} /></button>
            </div>
          ))}
          <div className="modal-hint" style={{ marginTop: 10 }}>{t("agent.rag.toggleHint")}</div>
        </div>}

        {tab === "workflow" && <div style={{ maxWidth: 1080 }}>
          <WorkflowLive agentId={props.agentId} />
          <div className="set-desc">{t("agent.workflow.intro", { name: props.name })}</div>
          {[
            t("agent.workflow.step1", { path: `.claude/agents/${props.handle}/SYSTEM.md` }),
            t("agent.workflow.step2", { cli: a.startsWith("cli_codex") ? "Codex" : "Claude Code" }),
            t("agent.workflow.step3"),
            t("agent.workflow.step4"),
            t("agent.workflow.step5"),
          ].map((step, i) => (
            <div className="skill-pick" key={i}>
              <span style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--bg-active)", color: "var(--accent)", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 800, flex: "0 0 22px" }}>{i + 1}</span>
              <div className="sp-main"><div className="sr-title" style={{ fontWeight: 500, fontSize: 13 }}>{step}</div></div>
            </div>
          ))}
        </div>}
      </div>

      {upload && (
        <div className="modal-overlay" onMouseDown={() => setUpload(false)}>
          <div className="modal" style={{ padding: "20px 22px", width: 460, maxWidth: "94vw" }} onMouseDown={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>{t("agent.pullModal.title")}</div>
            <div className="set-desc" style={{ marginBottom: 12 }}>{t("agent.pullModal.descPrefix")} <span className="mono">qwen2.5-coder:7b</span>{t("agent.pullModal.descSuffix", { name: props.name })}</div>
            <input className="form-input mono" autoFocus placeholder={t("agent.pullModal.placeholder")} value={pullName} onChange={(e) => setPullName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && pullName.trim()) pull(); }} />
            {pullMsg && <div style={{ fontSize: 11.5, color: pullErr ? "var(--sx-keyword)" : "var(--sx-string)", marginTop: 8 }}>{pullMsg}</div>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button className="btn-ghost" onClick={() => setUpload(false)}>{t("common.cancel")}</button>
              <button className="btn-accent" disabled={!pullName.trim() || pending} onClick={pull}><Icon name="add" size={13} /> {t("agent.pullModal.pullAssign")}</button>
            </div>
          </div>
        </div>
      )}

      {addSrc && (
        <div className="modal-overlay" onMouseDown={() => setAddSrc(false)}>
          <div className="modal" style={{ padding: "20px 22px", width: 460, maxWidth: "94vw" }} onMouseDown={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>{t("agent.addSrcModal.title")}</div>
            <div className="set-desc" style={{ marginBottom: 12 }}>{t("agent.addSrcModal.desc")}</div>
            <input className="form-input mono" autoFocus placeholder={t("agent.addSrcModal.placeholder")} value={srcUrl} onChange={(e) => setSrcUrl(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addSource(); }} />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button className="btn-ghost" onClick={() => setAddSrc(false)}>{t("common.cancel")}</button>
              <button className="btn-accent" disabled={!srcUrl.trim()} onClick={addSource}><Icon name="check" size={13} /> {t("agent.rag.addSource")}</button>
            </div>
          </div>
        </div>
      )}

      {fireOpen && (
        <ConfirmDialog
          title={t("agent.fire.button")}
          body={t("agent.fire.confirm", { name: props.name })}
          confirmLabel={t("agent.fire.button")}
          error={fireErr}
          pending={pending}
          onConfirm={confirmFire}
          onCancel={() => { setFireOpen(false); setFireErr(""); }}
        />
      )}
    </div>
  );
}
