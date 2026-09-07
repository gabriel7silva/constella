"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { useT } from "@/lib/i18n-context";
import { startNewWork } from "@/server/planner";

/**
 * "New work" — describe what to implement/fix/change and Ada turns it into a fresh Goal +
 * specs + issues + TODOs, appended to the workspace (existing work untouched). Lets the
 * operator continue development without recreating the organization.
 */
export function NewWorkButton() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  function submit() {
    setErr("");
    start(async () => {
      const r = await startNewWork({ title: title.trim() || undefined, brief });
      if (!r.ok) { setErr(r.error ?? t("planner.newWork.failed")); return; }
      setOpen(false); setTitle(""); setBrief(""); router.refresh();
    });
  }

  return (
    <>
      <button className="btn-ghost" onClick={() => setOpen(true)}><Icon name="add" size={14} /> {t("planner.newWork.button")}</button>
      {open && (
        <div className="modal-overlay" onMouseDown={() => !pending && setOpen(false)}>
          <div className="modal" style={{ padding: "20px 22px", width: 480, maxWidth: "94vw" }} onMouseDown={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>{t("planner.newWork.title")}</div>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 12 }}>{t("planner.newWork.desc")}</div>
            <label className="form-label">{t("planner.newWork.titleLabel")}</label>
            <input className="form-input" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("planner.newWork.titlePh")} />
            <label className="form-label">{t("planner.newWork.briefLabel")}</label>
            <textarea className="form-input" rows={5} value={brief} onChange={(e) => setBrief(e.target.value)} placeholder={t("planner.newWork.briefPh")} />
            {err && <div style={{ color: "#e8688f", fontSize: 12, marginTop: 8 }}>{err}</div>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button className="btn-ghost" disabled={pending} onClick={() => setOpen(false)}>{t("common.cancel")}</button>
              <button className="btn-accent" disabled={pending || !brief.trim()} onClick={submit}>{pending ? t("planner.newWork.planning") : t("planner.newWork.create")}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
