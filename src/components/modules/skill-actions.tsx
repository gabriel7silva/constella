"use client";

import { useState, useTransition } from "react";
import { ViewChrome } from "@/components/shell/view-chrome";
import { Icon } from "@/components/ui/icon";
import { Avatar } from "@/components/ui/avatar";
import { Dropdown } from "@/components/ui/dropdown";
import { useT } from "@/lib/i18n-context";
import { createSkill, deleteSkill, generateSkill, saveSkillInstructions, approveProvisional, suggestSkillsFromLearnings } from "@/server/skills";

export type AgentRow = { id: string; handle: string; name: string; role: string; color: string; health: "alive" | "stale" | "down" };
export type SkillUser = { id: string; name: string; color: string; health: "alive" | "stale" | "down" };
export type SkillRow = {
  id: string;
  name: string;
  summary: string;
  instructions: string;
  trigger: string;
  native: boolean;
  provisional: boolean;
  indexed: "pending" | "indexed";
  file: string;
  category: string;        // stacks | design | engineering | process | languages | references | core | custom
  usedCount: number;       // agent run-events that read this skill file
  lastBy: string | null;   // most-recent agent that consulted it
  users: SkillUser[];
};

/** The procedure steps shown in the read view — derived from the real instructions text. */
function stepsOf(s: SkillRow): string[] {
  return (s.instructions || "")
    .split("\n")
    .map((x) => x.replace(/^\d+[.)]\s*/, "").trim())
    .filter(Boolean);
}

export function SkillsClient({ skills, agents }: { skills: SkillRow[]; agents: AgentRow[] }) {
  const t = useT();
  const [open, setOpen] = useState<SkillRow | null>(null);
  const [editing, setEditing] = useState(false);
  const [mdDraft, setMdDraft] = useState("");
  const [addModal, setAddModal] = useState<null | "manual" | "ai">(null);
  const [pending, start] = useTransition();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const categories = ["all", ...Array.from(new Set(skills.map((s) => s.category))).sort()];
  const ql = q.trim().toLowerCase();
  const shown = skills.filter((s) =>
    (cat === "all" || s.category === cat) &&
    (!ql || s.name.toLowerCase().includes(ql) || s.summary.toLowerCase().includes(ql)));

  function openSkill(s: SkillRow, edit: boolean) {
    setOpen(s);
    setEditing(edit);
    setMdDraft(s.instructions);
  }
  function saveMd() {
    if (!open) return;
    start(async () => { await saveSkillInstructions(open.id, mdDraft); setEditing(false); });
  }

  if (open) {
    const rawSteps = stepsOf(open);
    const steps = rawSteps.length ? rawSteps : [t("skills.detail.followInstructions", { file: open.file })];
    return (
      <ViewChrome title={open.name} sub={`${open.file} · ${t("skills.detail.triggered")}: ${open.trigger}`}
                 right={editing
                   ? <><button className="btn-ghost" onClick={() => setEditing(false)}><Icon name="close" size={13} /> {t("common.cancel")}</button><button className="btn-accent" disabled={pending} onClick={saveMd}><Icon name="check" size={13} /> {pending ? t("common.saving") : t("skills.detail.saveMd")}</button></>
                   : <><button className="btn-ghost" onClick={() => openSkill(open, true)}><Icon name="command" size={13} /> {t("skills.detail.editMd")}</button><button className="btn-ghost" onClick={() => { setOpen(null); setEditing(false); }}><Icon name="chevronLeft" size={14} /> {t("common.back")}</button></>}>
        {open.provisional && (
          <div className="card" style={{ marginBottom: 14, borderColor: "var(--sx-number)", background: "var(--sx-number)14", display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ color: "var(--sx-number)", fontSize: 12.5, flex: 1 }}>⚠ {t("skills.detail.provisionalWarn")}</span>
            <button className="btn-accent" disabled={pending} onClick={() => start(async () => { await approveProvisional(open.id); setOpen({ ...open, provisional: false }); })}><Icon name="check" size={13} /> {t("skills.detail.approve")}</button>
          </div>
        )}
        {editing
          ? <textarea className="persona-ta mono" style={{ minHeight: 360, maxWidth: 820 }} value={mdDraft} onChange={(e) => setMdDraft(e.target.value)} />
          : <div className="card" style={{ maxWidth: 820 }}>
              <div className="detail-label">{t("skills.detail.procedure")}</div>
              {steps.map((s, i) => (
                <div className="live-step" key={i}><span className="ls-ico" style={{ color: "var(--accent)", fontFamily: "var(--mono-font)" }}>{i + 1}</span>{s}</div>
              ))}
              {open.users.length > 0 && <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 12 }}>{t("skills.detail.usedBy")}: {open.users.map((u) => u.name).join(", ")}</div>}
            </div>}
      </ViewChrome>
    );
  }

  return (
    <ViewChrome title="Skills" sub={t("skills.list.sub")}
               right={<><SuggestButton /><button className="btn-ghost" onClick={() => setAddModal("ai")}><Icon name="bot" size={14} /> {t("skills.list.generateAi")}</button><button className="btn-accent" onClick={() => setAddModal("manual")}><Icon name="add" size={14} /> {t("skills.list.addSkill")}</button></>}>
      {skills.length === 0 && <div className="card"><div className="muted">{t("skills.list.empty")}</div></div>}
      {skills.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          <div className="stack-search" style={{ flex: "0 0 240px", maxWidth: 240 }}>
            <Icon name="search" size={14} />
            <input placeholder="Filter skills…" value={q} onChange={(e) => setQ(e.target.value)} />
            {q && <button className="ss-clear" onClick={() => setQ("")}><Icon name="close" size={12} /></button>}
          </div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {categories.map((c) => (
              <button key={c} className="chip-sm" style={cat === c ? { background: "var(--accent)", color: "var(--accent-fg)" } : undefined} onClick={() => setCat(c)}>
                {c === "all" ? "All" : c[0].toUpperCase() + c.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}
      {skills.length > 0 && shown.length === 0 && <div className="card"><div className="muted">No skills match this filter.</div></div>}
      <div className="skill-grid">
        {shown.map((s) => {
          const users = s.users;
          return (
            <div className="skill-card2" key={s.id}>
              <div className="sc2-top">
                <span className="sc2-ico"><Icon name="skill" size={15} /></span>
                <span className="sc2-name">{s.name}<span className="sc2-ext">.md</span></span>
                <span className={"sc2-index " + (s.indexed === "indexed" ? "ok" : "pending")}>
                  <Icon name={s.indexed === "indexed" ? "check" : "refresh"} size={10} /> {s.indexed === "indexed" ? t("skills.card.indexed") : t("skills.card.indexing")}
                </span>
              </div>
              <div className="sc2-summary">{s.summary}</div>
              <div className="sc2-meta">
                <span className="sc2-kind">{t("skills.card.kind")}</span>
                {s.native && <span className="pill" style={{ background: "var(--bg-active)", color: "var(--text-dim)" }}>{t("skills.card.native")}</span>}
                {s.provisional && <span className="pill" style={{ background: "var(--sx-number)22", color: "var(--sx-number)" }}>{t("skills.card.provisional")}</span>}
                {s.usedCount > 0 && (
                  <span className="pill" style={{ background: "var(--accent)1f", color: "var(--accent)", display: "inline-flex", alignItems: "center", gap: 4 }}
                    title={s.lastBy ? `An agent read this skill during a task — last: ${s.lastBy}` : "Consulted by an agent during a task"}>
                    <Icon name="pulse" size={10} /> Consulted {s.usedCount}×
                  </span>
                )}
                <span className="sc2-trigger">· {s.trigger}</span>
              </div>
              <div className="sc2-actions">
                <button className="sc2-btn" onClick={() => openSkill(s, false)}><Icon name="goto" size={12} /> {t("skills.card.open")}</button>
                <button className="sc2-btn" onClick={() => openSkill(s, true)}><Icon name="command" size={12} /> {t("common.edit")}</button>
                {!s.native && <DeleteSkillButton id={s.id} />}
                <div className="sc2-users" title={users.length ? t("skills.card.usedByTip", { names: users.map((u) => u.name).join(", ") }) : t("skills.card.unusedTip")}>
                  {users.slice(0, 4).map((u) => <span key={u.id} className="sc2-user"><Avatar name={u.name} color={u.color} size={20} /></span>)}
                  {users.length > 4 && <span className="sc2-user-more">+{users.length - 4}</span>}
                  {users.length === 0 && <span className="sc2-nouser">{t("skills.card.unused")}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {addModal === "manual" && <ManualModal agents={agents} onClose={() => setAddModal(null)} />}
      {addModal === "ai" && <AiModal onClose={() => setAddModal(null)} />}
    </ViewChrome>
  );
}

/** Trigger Vannevar's learning→skills proposal pass; provisional drafts land in the grid to review. */
function SuggestButton() {
  const t = useT();
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  function run() {
    setNote(null);
    start(async () => {
      const r = await suggestSkillsFromLearnings();
      setNote(r.ok && r.proposed > 0 ? t("skills.list.suggested", { n: r.proposed }) : t("skills.list.suggestNone"));
    });
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      {note && <span style={{ fontSize: 11.5, color: "var(--text-dim)" }}>{note}</span>}
      <button className="btn-ghost" disabled={pending} onClick={run} title={t("skills.list.suggestDesc")}>
        {pending ? <span className="sync-spin"><Icon name="refresh" size={13} /></span> : <Icon name="branch" size={14} />} {pending ? t("skills.list.suggesting") : t("skills.list.suggest")}
      </button>
    </span>
  );
}

function DeleteSkillButton({ id }: { id: string }) {
  const t = useT();
  const [pending, start] = useTransition();
  return <button className="sc2-btn danger" disabled={pending} onClick={() => start(() => deleteSkill(id))}><Icon name="trash" size={12} /> {t("common.delete")}</button>;
}

function ManualModal({ agents, onClose }: { agents: AgentRow[]; onClose: () => void }) {
  const t = useT();
  const [name, setName] = useState("");
  const [summary, setSummary] = useState("");
  const [instructions, setInstructions] = useState("");
  const [agentId, setAgentId] = useState(agents[0]?.id ?? "");
  const [pending, start] = useTransition();

  function submit() {
    if (!name.trim()) return;
    start(async () => { await createSkill({ name, summary, instructions, agentId }); onClose(); });
  }
  const fileName = (name || "name").toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><div className="modal-title"><Icon name="add" size={15} /> {t("skills.manual.title")}</div></div>
        <div className="modal-body">
          <label className="form-label">{t("skills.manual.nameLabel")}</label>
          <input className="form-input mono" autoFocus placeholder={t("skills.manual.namePlaceholder")} value={name} onChange={(e) => setName(e.target.value)} />
          <label className="form-label" style={{ marginTop: 10 }}>{t("common.description")}</label>
          <textarea className="persona-ta" placeholder={t("skills.manual.descPlaceholder")} value={summary} onChange={(e) => setSummary(e.target.value)} />
          <label className="form-label" style={{ marginTop: 10 }}>{t("skills.manual.instructionsLabel")}</label>
          <textarea className="persona-ta mono" style={{ minHeight: 120 }} placeholder={t("skills.manual.instructionsPlaceholder")} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
          <label className="form-label" style={{ marginTop: 10 }}>{t("skills.manual.usedByAgent")}</label>
          <Dropdown value={agentId} options={agents.map((a) => ({ value: a.id, label: a.name + " · " + a.role }))} onChange={setAgentId} />
          <div className="modal-hint">{t("skills.manual.hintPrefix")} <b>skills/{fileName}.md</b>{t("skills.manual.hintSuffix")}</div>
        </div>
        <div className="modal-foot">
          <button className="btn-ghost" onClick={onClose}>{t("common.cancel")}</button>
          <button className="btn-accent" disabled={!name.trim() || pending} onClick={submit}>{pending ? t("skills.manual.creating") : t("skills.manual.create")}</button>
        </div>
      </div>
    </div>
  );
}

function AiModal({ onClose }: { onClose: () => void }) {
  const t = useT();
  const [aiPrompt, setAiPrompt] = useState("");
  const [pending, start] = useTransition();

  function submit() {
    if (!aiPrompt.trim()) return;
    start(async () => { await generateSkill(aiPrompt); onClose(); });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><div className="modal-title"><Icon name="bot" size={15} /> {t("skills.ai.title")}</div></div>
        <div className="modal-body">
          <label className="form-label">{t("skills.ai.describeLabel")}</label>
          <textarea className="persona-ta" autoFocus placeholder={t("skills.ai.describePlaceholder")} value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} />
          <div className="modal-hint"><Icon name="bot" size={12} /> {t("skills.ai.hintPrefix")} <b>{t("skills.ai.hintProvisional")}</b> {t("skills.ai.hintSuffix")}</div>
        </div>
        <div className="modal-foot">
          <button className="btn-ghost" onClick={onClose}>{t("common.cancel")}</button>
          <button className="btn-accent" disabled={!aiPrompt.trim() || pending} onClick={submit}>{pending ? t("skills.ai.drafting") : t("common.generate")}</button>
        </div>
      </div>
    </div>
  );
}
