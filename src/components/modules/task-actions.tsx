"use client";

import { useState, useTransition } from "react";
import { useT } from "@/lib/i18n-context";
import { createTask, moveTask, deleteTask, blockTask, unblockTask } from "@/server/tasks";

type Agent = { id: string; name: string; color: string };

export function NewTaskButton({ agents }: { agents: Agent[] }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState(agents[0]?.id ?? "");
  const [prio, setPrio] = useState<"low" | "med" | "high">("med");
  const [pending, start] = useTransition();

  function submit() {
    start(async () => { await createTask({ title, assigneeId, prio }); setOpen(false); setTitle(""); });
  }
  return (
    <>
      <button className="btn-accent" onClick={() => setOpen(true)}>+ {t("tasks.newCard")}</button>
      {open && (
        <div className="modal-overlay" onMouseDown={() => setOpen(false)}>
          <div className="modal" style={{ padding: "20px 22px", width: 440, maxWidth: "94vw" }} onMouseDown={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>{t("tasks.newTask")}</div>
            <label className="form-label">{t("pm.field.title")}</label>
            <input className="form-input" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("tasks.descPlaceholder")} />
            <label className="form-label">{t("tasks.assignee")}</label>
            <select className="form-input" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <label className="form-label">{t("tasks.priority")}</label>
            <select className="form-input" value={prio} onChange={(e) => setPrio(e.target.value as "low" | "med" | "high")}>
              <option value="low">{t("tasks.prio.low")}</option><option value="med">{t("tasks.prio.med")}</option><option value="high">{t("tasks.prio.high")}</option>
            </select>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button className="btn-ghost" onClick={() => setOpen(false)}>{t("common.cancel")}</button>
              <button className="btn-accent" disabled={!title.trim() || pending} onClick={submit}>{pending ? t("tasks.creating") : t("common.create")}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const NEXT: Record<string, string> = { triage: "todo", todo: "doing", doing: "review", blocked: "doing", review: "done", done: "done" };

export function TaskCardActions({ id, col }: { id: string; col: string }) {
  const t = useT();
  const [pending, start] = useTransition();
  return (
    <span style={{ display: "inline-flex", gap: 4 }}>
      {col === "blocked"
        ? <button className="mini" disabled={pending} title={t("pm.action.unblock")} style={{ color: "var(--sx-string)" }} onClick={() => start(() => unblockTask(id))}>▶</button>
        : col !== "done" && <button className="mini" disabled={pending} title={t("tasks.advance")} onClick={() => start(() => moveTask(id, NEXT[col] as never))}>→</button>}
      {col !== "done" && col !== "blocked" && <button className="mini" disabled={pending} title={t("pm.action.block")} style={{ color: "#e8688f" }} onClick={() => start(() => blockTask(id))}>⊘</button>}
      <button className="mini" disabled={pending} title={t("common.delete")} onClick={() => start(() => deleteTask(id))}>✕</button>
    </span>
  );
}
