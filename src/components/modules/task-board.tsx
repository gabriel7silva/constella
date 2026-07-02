"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/ui/icon";
import { Avatar } from "@/components/ui/avatar";
import { useT } from "@/lib/i18n-context";
import { TaskCardActions } from "./task-actions";
import { updateTaskDescription, addTaskStep, toggleTaskStep, deleteTaskStep } from "@/server/tasks";

type Step = { id: string; text: string; done: boolean; active: boolean };
export type TaskRow = { id: string; key: string; title: string; description: string; col: string; prio: string; assigneeId: string | null; steps: Step[] };
type Ag = { id: string; name: string; color: string };

// Labels are translated at render via tasks.col.*; keep the stable enum id + column color.
const COLS = [
  { id: "triage", c: "#6cc7e0" }, { id: "todo", c: "#84aef5" },
  { id: "doing", c: "#e0a44e" }, { id: "blocked", c: "#e8688f" },
  { id: "review", c: "#c4a0ff" }, { id: "done", c: "#b3d97a" },
];
const PRIO_COLOR: Record<string, string> = { high: "#e8688f", med: "#f0a35e", low: "#6cc7e0" };

function TaskDetail({ task, agent, onClose }: { task: TaskRow; agent: Ag | null; onClose: () => void }) {
  const t = useT();
  const [desc, setDesc] = useState(task.description);
  const [step, setStep] = useState("");
  const [, start] = useTransition();
  const col = COLS.find((c) => c.id === task.col);
  return (
    <div className="detail-overlay" onMouseDown={onClose}>
      <div className="detail-panel" onMouseDown={(e) => e.stopPropagation()}>
        <div className="detail-head">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="kk-id" style={{ fontSize: 12 }}>{task.key}</span>
            <button className="dock-tool" onClick={onClose}><Icon name="close" size={15} /></button>
          </div>
          <div className="view-title" style={{ fontSize: 17, marginTop: 6 }}>{task.title}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
            {agent && <><Avatar name={agent.name} color={agent.color} size={22} /><span style={{ fontSize: 12.5, color: "var(--text)" }}>{agent.name}</span></>}
            <span className="pill" style={{ marginLeft: 6, background: PRIO_COLOR[task.prio] + "22", color: PRIO_COLOR[task.prio] }}>{t(`tasks.prio.${task.prio}`)}</span>
            {col && <span className="chip-sm">{t(`tasks.col.${col.id}`)}</span>}
          </div>
        </div>
        <div className="detail-body">
          <div>
            <div className="detail-label">{t("common.description")}</div>
            <textarea className="persona-ta" value={desc} onChange={(e) => setDesc(e.target.value)} onBlur={() => { if (desc !== task.description) start(() => updateTaskDescription(task.id, desc)); }} placeholder={t("tasks.descPlaceholder")} />
          </div>
          <div>
            <div className="detail-label">{t("tasks.liveProgress")}</div>
            {task.steps.length === 0 && <div style={{ fontSize: 12, color: "var(--text-faint)" }}>{t("tasks.noSteps", { who: agent ? agent.name : t("tasks.theAgent") })}</div>}
            {task.steps.map((s) => (
              <div className={"live-step " + (s.done ? "done" : s.active ? "active" : "")} key={s.id}>
                <span className="ls-ico" style={{ cursor: "pointer" }} onClick={() => start(() => toggleTaskStep(s.id, !s.done))}>
                  {s.done ? <Icon name="check" size={14} /> : s.active ? <span className="spin"><Icon name="refresh" size={13} /></span> : <Icon name="dot" size={8} />}
                </span>
                <span style={{ flex: 1 }}>{s.text}</span>
                <button className="iact danger" title={t("tasks.removeStep")} onClick={() => start(() => deleteTaskStep(s.id))}><Icon name="close" size={12} /></button>
              </div>
            ))}
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <input className="form-input" style={{ height: 30, fontSize: 12 }} placeholder={t("tasks.addStepPlaceholder")} value={step} onChange={(e) => setStep(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && step.trim()) { start(() => addTaskStep(task.id, step)); setStep(""); } }} />
              <button className="btn-ghost" style={{ padding: "4px 10px" }} disabled={!step.trim()} onClick={() => { start(() => addTaskStep(task.id, step)); setStep(""); }}><Icon name="add" size={12} /></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TaskBoard({ tasks, agents }: { tasks: TaskRow[]; agents: Ag[] }) {
  const t = useT();
  const byId = Object.fromEntries(agents.map((a) => [a.id, a]));
  const [selId, setSelId] = useState<string | null>(null);
  const sel = selId ? tasks.find((x) => x.id === selId) ?? null : null;

  return (
    <>
      <div className="kanban">
        {COLS.map((col) => {
          const cards = tasks.filter((c) => c.col === col.id);
          return (
            <div className="kan-col" key={col.id}>
              <div className="kan-col-head"><span className="kc-dot" style={{ background: col.c }} />{t(`tasks.col.${col.id}`)}<span className="kc-count">{cards.length}</span></div>
              <div className="kan-cards scroll">
                {cards.map((c) => {
                  const a = c.assigneeId ? byId[c.assigneeId] : null;
                  const doneSteps = c.steps.filter((s) => s.done).length;
                  return (
                    <div className="kan-card" key={c.id} style={{ cursor: "pointer" }} onClick={() => setSelId(c.id)}>
                      <div className="kk-id">{c.key}</div>
                      <div className="kk-title">{c.title}</div>
                      <div className="kk-foot">
                        <span className="kk-prio" style={{ background: PRIO_COLOR[c.prio] }} title={t(`tasks.prio.${c.prio}`)} />
                        {c.steps.length > 0 && <span className="chip-sm" title={t("tasks.stepsDone")}>{doneSteps}/{c.steps.length}</span>}
                        {a && <Avatar name={a.name} color={a.color} size={20} />}
                        <span style={{ marginLeft: "auto" }} onClick={(e) => e.stopPropagation()}><TaskCardActions id={c.id} col={c.col} /></span>
                      </div>
                    </div>
                  );
                })}
                {cards.length === 0 && <div className="muted" style={{ fontSize: 11.5, padding: "2px 1px" }}>{t("tasks.noCards")}</div>}
              </div>
            </div>
          );
        })}
      </div>
      {sel && <TaskDetail task={sel} agent={sel.assigneeId ? byId[sel.assigneeId] : null} onClose={() => setSelId(null)} />}
    </>
  );
}
