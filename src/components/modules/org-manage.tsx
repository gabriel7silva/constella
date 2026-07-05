"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { setActiveOrg, renameOrg, archiveOrg, deleteOrg, editWorkspaceMeta } from "@/server/actions/org-actions";
import { useT } from "@/lib/i18n-context";

export function OrgActions({ orgId, name, archived, active }: { orgId: string; name: string; archived: boolean; active: boolean }) {
  const t = useT();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [nm, setNm] = useState(name);
  const [confirm, setConfirm] = useState(false);
  const router = useRouter();

  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
      {editing ? (
        <>
          <input className="form-input mono" value={nm} onChange={(e) => setNm(e.target.value)} style={{ width: 180, height: 28 }} autoFocus />
          <button className="sc2-btn" disabled={pending} onClick={() => start(async () => { await renameOrg(orgId, nm); setEditing(false); })}><Icon name="check" size={11} /> {t("common.save")}</button>
          <button className="sc2-btn" onClick={() => { setNm(name); setEditing(false); }}>{t("common.cancel")}</button>
        </>
      ) : (
        <>
          {!active && <button className="btn-accent" disabled={pending} onClick={() => start(async () => { await setActiveOrg(orgId); router.push("/"); })}><Icon name="goto" size={12} /> {t("org.open")}</button>}
          {active && <span className="pill" style={{ background: "var(--sx-string)22", color: "var(--sx-string)" }}>{t("org.active")}</span>}
          <button className="sc2-btn" onClick={() => setEditing(true)}><Icon name="command" size={11} /> {t("org.rename")}</button>
          <button className="sc2-btn" disabled={pending} onClick={() => start(() => archiveOrg(orgId, !archived))}><Icon name={archived ? "refresh" : "inbox"} size={11} /> {archived ? t("org.restore") : t("org.archive")}</button>
          {confirm ? (
            <button className="sc2-btn danger" disabled={pending} onClick={() => start(async () => { await deleteOrg(orgId); router.refresh(); })}><Icon name="trash" size={11} /> {t("org.confirmDelete")}</button>
          ) : (
            <button className="sc2-btn danger" onClick={() => setConfirm(true)}><Icon name="trash" size={11} /> {t("common.delete")}</button>
          )}
        </>
      )}
    </div>
  );
}

export function WorkspaceMetaForm({ mission, objective }: { mission: string; objective: string }) {
  const t = useT();
  const [m, setM] = useState(mission);
  const [o, setO] = useState(objective);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div>
      <label className="form-label">{t("org.mission")}</label>
      <textarea className="persona-ta" value={m} onChange={(e) => { setM(e.target.value); setSaved(false); }} />
      <label className="form-label" style={{ marginTop: 10 }}>{t("org.objective")}</label>
      <textarea className="persona-ta" value={o} onChange={(e) => { setO(e.target.value); setSaved(false); }} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
        <button className="btn-accent" disabled={pending} onClick={() => start(async () => { await editWorkspaceMeta(m, o); setSaved(true); })}><Icon name="check" size={13} /> {pending ? t("common.saving") : t("common.save")}</button>
        {saved && <span className="muted" style={{ fontSize: 12 }}>{t("org.savedNote")}</span>}
      </div>
    </div>
  );
}
