"use client";

import { useState, useTransition } from "react";
import { createGoal } from "@/server/goals";
import { useT } from "@/lib/i18n-context";

type Agent = { id: string; name: string; role: string };

export function NewGoalButton({ agents }: { agents: Agent[] }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [ownerId, setOwnerId] = useState(agents[0]?.id ?? "");
  const [pending, start] = useTransition();

  function submit() {
    start(async () => {
      await createGoal({ title, description: desc, ownerId });
      setOpen(false); setTitle(""); setDesc("");
    });
  }

  return (
    <>
      <button className="btn-accent" onClick={() => setOpen(true)}>+ {t("goals.new")}</button>
      {open && (
        <div className="modal-overlay" onMouseDown={() => setOpen(false)}>
          <div className="modal" style={{ padding: "20px 22px", width: 440, maxWidth: "94vw" }} onMouseDown={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>{t("goals.new")}</div>
            <label className="form-label">{t("goals.objective")}</label>
            <input className="form-input" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("goals.objectivePlaceholder")} />
            <label className="form-label">{t("common.description")}</label>
            <textarea className="form-input" rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={t("goals.descPlaceholder")} />
            <label className="form-label">{t("goals.owner")}</label>
            <select className="form-input" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.name} · {a.role}</option>)}
            </select>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button className="btn-ghost" onClick={() => setOpen(false)}>{t("common.cancel")}</button>
              <button className="btn-accent" disabled={!title.trim() || pending} onClick={submit}>{pending ? t("goals.creating") : t("goals.create")}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
