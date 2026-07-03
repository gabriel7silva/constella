"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { Dropdown } from "@/components/ui/dropdown";
import { useT } from "@/lib/i18n-context";
import { createRoutine, deleteRoutine } from "@/server/modules";

// Stable enum values stored by the server action; the visible label is translated at render.
const FREQS = ["Hourly", "Daily", "Weekly", "Monthly"];

/** Operator-created routine (agents also generate these). */
export function NewRoutineButton({ agents }: { agents: { id: string; name: string }[] }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [cmd, setCmd] = useState("");
  const [freq, setFreq] = useState("Daily");
  const [agentId, setAgentId] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  function submit() {
    setErr("");
    start(async () => {
      const r = await createRoutine({ name, cmd, freq, agentId: agentId || undefined });
      if (!r.ok) { setErr(r.error ?? t("routines.new.failed")); return; }
      setOpen(false); setName(""); setCmd(""); setFreq("Daily"); setAgentId(""); router.refresh();
    });
  }

  return (
    <>
      <button className="btn-accent" onClick={() => setOpen(true)}><Icon name="add" size={14} /> {t("routines.new.button")}</button>
      {open && (
        <div className="modal-overlay" onMouseDown={() => !pending && setOpen(false)}>
          <div className="modal" style={{ padding: "20px 22px", width: 460, maxWidth: "94vw" }} onMouseDown={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>{t("routines.new.title")}</div>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 12 }}>{t("routines.new.desc")}</div>
            <label className="form-label">{t("common.name")} <span className="req">*</span></label>
            <input className="form-input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={t("routines.new.namePh")} />
            <label className="form-label">{t("routines.new.command")}</label>
            <input className="form-input mono" value={cmd} onChange={(e) => setCmd(e.target.value)} placeholder={t("routines.new.commandPh")} />
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}><label className="form-label">{t("routines.new.frequency")}</label><Dropdown value={freq} options={FREQS.map((f) => ({ value: f, label: t(`routines.freq.${f}`) }))} onChange={setFreq} /></div>
              <div style={{ flex: 1 }}><label className="form-label">{t("routines.new.ownerAgent")}</label><Dropdown value={agentId} placeholder={t("routines.new.unassigned")} options={[{ value: "", label: t("routines.new.unassigned") }, ...agents.map((a) => ({ value: a.id, label: a.name }))]} onChange={setAgentId} /></div>
            </div>
            {err && <div style={{ color: "#e8688f", fontSize: 12, marginTop: 8 }}>{err}</div>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button className="btn-ghost" disabled={pending} onClick={() => setOpen(false)}>{t("common.cancel")}</button>
              <button className="btn-accent" disabled={pending || !name.trim()} onClick={submit}>{pending ? t("routines.new.creating") : t("routines.new.create")}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function DeleteRoutineButton({ id }: { id: string }) {
  const t = useT();
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button className="iact danger" title={t("routines.delete.title")} disabled={pending}
      onClick={() => { if (confirm(t("routines.delete.confirm"))) start(async () => { await deleteRoutine(id); router.refresh(); }); }}>
      <Icon name="trash" size={14} />
    </button>
  );
}
