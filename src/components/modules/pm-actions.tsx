"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/ui/icon";
import { useT } from "@/lib/i18n-context";
import { createBacklogItem, deleteBacklogItem, promoteBacklogItem, moveIssue, setIssueMoscow, blockIssue, unblockIssue } from "@/server/pm";
import { groomBacklog } from "@/server/planner";

/** Optional real PO grooming — Donald estimates story points + MoSCoW for every active issue. */
export function GroomBacklogButton() {
  const t = useT();
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  function run() {
    setNote(null);
    start(async () => {
      const r = await groomBacklog();
      setNote(r.ok ? t("pm.groomed", { n: r.groomed ?? 0 }) : (r.error ?? t("pm.groomFailed")));
    });
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      {note && <span style={{ fontSize: 11.5, color: "var(--text-dim)" }}>{note}</span>}
      <button className="btn-ghost" disabled={pending} onClick={run} title={t("pm.groomDesc")}>
        {pending ? <span className="sync-spin"><Icon name="refresh" size={13} /></span> : <Icon name="branch" size={13} />} {pending ? t("pm.grooming") : t("pm.groom")}
      </button>
    </span>
  );
}

type Moscow = "Must" | "Should" | "Could" | "Won't";
const MOSCOW: Moscow[] = ["Must", "Should", "Could", "Won't"];
const MOSCOW_COLOR: Record<Moscow, string> = { Must: "#e8688f", Should: "#e0a44e", Could: "#6cc7e0", "Won't": "#6b7390" };

/** Click-to-score MoSCoW on a sprint issue — cycles Must→Should→Could→Won't, persisted. */
export function IssueMoscow({ id, moscow }: { id: string; moscow: Moscow | null }) {
  const t = useT();
  const [m, setM] = useState<Moscow>(moscow ?? "Should");
  const [, start] = useTransition();
  function cycle() {
    const next = MOSCOW[(MOSCOW.indexOf(m) + 1) % MOSCOW.length];
    setM(next); start(() => setIssueMoscow(id, next));
  }
  const c = MOSCOW_COLOR[m];
  return <button className="pill" style={{ background: c + "22", color: c, cursor: "pointer", border: "none" }} title={t("pm.moscow.cycle")} onClick={cycle}>{m}</button>;
}
// Real issue columns advance todo → doing → review → done.
const NEXT: Record<string, "todo" | "doing" | "review" | "done"> = { todo: "doing", doing: "review", review: "done" };

export function NewBacklogButton() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [moscow, setMoscow] = useState<Moscow>("Should");
  const [points, setPoints] = useState(3);
  const [pending, start] = useTransition();

  function submit() {
    if (!title.trim()) return;
    start(async () => {
      await createBacklogItem({ title, moscow, points });
      setOpen(false); setTitle(""); setMoscow("Should"); setPoints(3);
    });
  }

  if (!open) return <button className="btn-accent" onClick={() => setOpen(true)}><Icon name="add" size={14} /> {t("pm.backlog.addItem")}</button>;
  return (
    <div className="modal-overlay" onClick={() => setOpen(false)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><div className="modal-title"><Icon name="goto" size={15} /> {t("pm.backlog.newItem")}</div></div>
        <div className="modal-body">
          <label className="form-label">{t("pm.field.title")}</label>
          <input className="form-input" autoFocus placeholder={t("pm.backlog.titlePlaceholder")} value={title}
                 onChange={(e) => setTitle(e.target.value)}
                 onKeyDown={(e) => { if (e.key === "Enter") submit(); }} />
          <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
            <div style={{ flex: 1 }}>
              <label className="form-label">{t("pm.field.priorityMoscow")}</label>
              <select className="form-input" value={moscow} onChange={(e) => setMoscow(e.target.value as Moscow)}>
                {MOSCOW.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div style={{ width: 110 }}>
              <label className="form-label">{t("pm.field.points")}</label>
              <input className="form-input" type="number" min={0} value={points}
                     onChange={(e) => setPoints(Number(e.target.value) || 0)} />
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn-ghost" onClick={() => setOpen(false)}>{t("common.cancel")}</button>
          <button className="btn-accent" disabled={pending || !title.trim()} onClick={submit}>{pending ? t("pm.backlog.adding") : t("common.add")}</button>
        </div>
      </div>
    </div>
  );
}

export function IssueCardActions({ id, col }: { id: string; col: string }) {
  const t = useT();
  const [pending, start] = useTransition();
  const next = NEXT[col];
  const chip = (title: string, onClick: () => void, icon: string, color?: string) => (
    <button className="chip-sm" disabled={pending} title={title}
            style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", color }}
            onClick={() => start(onClick)}>
      <Icon name={icon} size={12} />
    </button>
  );
  if (col === "blocked") return <span style={{ display: "inline-flex", gap: 6 }}>{chip(t("pm.action.unblock"), () => unblockIssue(id), "play", "var(--sx-string)")}</span>;
  return (
    <span style={{ display: "inline-flex", gap: 6 }}>
      {next && chip(t("pm.action.advanceTo", { col: t(`pm.col.${next}`) }), () => moveIssue(id, next), "chevronRight")}
      {col !== "done" && chip(t("pm.action.block"), () => blockIssue(id), "shield", "#e8688f")}
    </span>
  );
}

export function BacklogRowActions({ id }: { id: string }) {
  const t = useT();
  const [pending, start] = useTransition();
  return (
    <span style={{ display: "inline-flex", gap: 6 }}>
      <button className="chip-sm" disabled={pending} title={t("pm.action.promote")}
              style={{ cursor: "pointer", display: "inline-flex", alignItems: "center" }}
              onClick={() => start(() => promoteBacklogItem(id))}><Icon name="goto" size={12} /></button>
      <button className="chip-sm" disabled={pending} title={t("pm.action.deleteBacklog")}
              style={{ cursor: "pointer", display: "inline-flex", alignItems: "center" }}
              onClick={() => start(() => deleteBacklogItem(id))}><Icon name="trash" size={12} /></button>
    </span>
  );
}
