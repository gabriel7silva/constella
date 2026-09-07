"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { useT } from "@/lib/i18n-context";
import { pullKbForComposer, sendMessageToKb, taskRef } from "@/server/chat";
import { seedDefaultBlocksAction } from "@/server/actions/blocks-actions";
import { reindexKbAction } from "@/server/actions/kb-actions";

/* Shared chat primitives — the message stream, the composer, work-blocks, attachments. Used by BOTH
   the floating dock (chat-dock.tsx) and the Welcome Home central chat (welcome-chat.tsx) so the two
   render identically (bubbles, avatars, /commands, @mentions, collapsible logs). Pure prop-driven. */

export type Agent = { id: string; handle: string; name: string; role: string; color: string; image?: string | null; adapter: string; status: string; health: "alive" | "stale" | "down" | null };
export type Attachment = { name: string; type: string; size: number; path: string };
export type Msg = { id: string; fromKind: string; fromHandle: string | null; text: string; createdAt?: string | Date | null; sources?: string[] | null; attachments?: Attachment[] | null; taskId?: string | null; kind?: string | null; blocks?: string[] | null };
export type Ev = { id: string; runId: string; agentId: string | null; seq: number; kind: string; target: string; detail: string };

// Work-step verb labels — keyed by the stable step.kind enum. Translated at the render site via
// `chat.verb.<kind>` (pattern A); this set is the canonical key list (also used as the EN fallback).
export const VERB: Record<string, string> = { read: "Read", create: "Create", edit: "Edit", run: "Run", search: "Search" };

// Slash commands: `cmd`/`arg` are stable identifiers (never translated); the human description is
// translated at the render site via `chat.slash.<descKey>` (pattern A).
export type SlashCmd = { cmd: string; descKey: string; arg?: string };
export const SLASH_CMDS: SlashCmd[] = [
  { cmd: "/help", descKey: "help" },
  { cmd: "/kb", descKey: "kb", arg: "<question>" },
  { cmd: "/search", descKey: "search", arg: "<query>" },
  { cmd: "/graph", descKey: "graph", arg: "<key>" },
  { cmd: "/status", descKey: "status" },
  { cmd: "/agents", descKey: "agents" },
  { cmd: "/agent", descKey: "agent", arg: "<handle>" },
  { cmd: "/new-goal", descKey: "newGoal", arg: "<brief>" },
  { cmd: "/new-issue", descKey: "newIssue", arg: "<title>" },
  { cmd: "/new-spec", descKey: "newSpec", arg: "<title>" },
  { cmd: "/generate-plan", descKey: "generatePlan", arg: "<brief>" },
  { cmd: "/approve", descKey: "approve" },
  { cmd: "/reject", descKey: "reject", arg: "<reason>" },
  { cmd: "/run-247", descKey: "run247" },
  { cmd: "/pause", descKey: "pause" },
  { cmd: "/cancel", descKey: "cancel" },
  { cmd: "/archive", descKey: "archive" },
  { cmd: "/assign", descKey: "assign", arg: "<issue> <@agent>" },
  { cmd: "/review", descKey: "review" },
  { cmd: "/close-sprint", descKey: "closeSprint" },
  { cmd: "/test-dev", descKey: "testDev" },
  { cmd: "/github", descKey: "github" },
  { cmd: "/prepare-deploy", descKey: "prepareDeploy" },
  { cmd: "/export-source", descKey: "exportSource", arg: "<repo>" },
  { cmd: "/models", descKey: "models" },
  { cmd: "/skills", descKey: "skills" },
  { cmd: "/locks", descKey: "locks" },
  { cmd: "/telegram", descKey: "telegram" },
  { cmd: "/reindex", descKey: "reindex" },
  { cmd: "/curate", descKey: "curate" },
  { cmd: "/clear", descKey: "clear" },
];

export const STATUS_COLOR: Record<string, { c: string; bg: string }> = {
  idle: { c: "#6b7390", bg: "rgba(120,130,160,.16)" },
  working: { c: "#b3d97a", bg: "rgba(179,217,122,.15)" },
  review: { c: "#e0a44e", bg: "rgba(224,164,78,.16)" },
  blocked: { c: "#e8688f", bg: "rgba(232,104,143,.16)" },
};

export function StatusPill({ status }: { status: string }) {
  const t = useT();
  const s = STATUS_COLOR[status] ?? STATUS_COLOR.idle;
  return <span className="status-pill" style={{ color: s.c, background: s.bg }}>{status in STATUS_COLOR ? t("chat.status." + status) : status}</span>;
}

export function clock(d?: string | Date | null): string {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  const time = dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const date = dt.toLocaleDateString([], { day: "2-digit", month: "short" });
  return `${date}, ${time}`; // date + time on every message
}

export type Ref = { kind: "goal" | "spec" | "issue"; key: string; title: string; id: string };

export function renderMentions(text: string, known: Set<string>, refs?: Ref[]) {
  // Split on @handle tokens AND #KEY tokens in one pass
  const refMap = refs ? Object.fromEntries(refs.map((r) => [r.key.toLowerCase(), r])) : {};
  const hasRefs = refs && refs.length > 0;
  const pattern = hasRefs ? /(@[a-z0-9-]+|#[a-z0-9_-]+)/gi : /(@[a-z0-9-]+)/gi;
  return text.split(pattern).map((p, i) => {
    if (/^@[a-z0-9-]+$/i.test(p) && known.has(p.slice(1).toLowerCase()))
      return <span className="mention" key={i}>{p}</span>;
    if (hasRefs && /^#[a-z0-9_-]+$/i.test(p)) {
      const ref = refMap[p.slice(1).toLowerCase()];
      if (ref) {
        const href = ref.kind === "goal" ? "/goals" : ref.kind === "spec" ? "/planner" : "/pm";
        return <a className="ref-chip" key={i} href={href} title={ref.title}>{p}</a>;
      }
    }
    return <span key={i}>{p}</span>;
  });
}

/* ----------------------------------------------------------------- work card */
function WorkStep({ step }: { step: Ev }) {
  const t = useT();
  const verb = step.kind in VERB ? t("chat.verb." + step.kind) : step.kind;
  const isRun = step.kind === "run";
  const isEdit = step.kind === "edit" && !!step.detail;
  const isCreate = step.kind === "create" && !!step.detail;
  const diff = isEdit ? step.detail.split("\n") : [];
  const adds = isEdit ? diff.filter((l) => l.startsWith("+")).length : 0;
  const dels = isEdit ? diff.filter((l) => l.startsWith("-")).length : 0;
  const code = isCreate ? step.detail.slice(0, 4000).split("\n") : [];

  return (
    <div className="work-step">
      <div className="wstep-head">
        <span className={"wstep-verb " + step.kind}>{verb}</span>
        <span className="wstep-file">{step.target}</span>
        {isEdit && <span className="wstep-badge"><span className="plus">+{adds}</span> <span className="minus">−{dels}</span></span>}
        {isCreate && <span className="wstep-badge"><span className="plus">+{code.length}</span></span>}
      </div>

      {isCreate && (
        <div className="wstep-code scroll">
          {code.map((l, i) => (
            <div className="wcode-line" key={i}>
              <span className="wcode-gutter">{i + 1}</span>
              <span className="wcode-text">{l || "​"}</span>
            </div>
          ))}
        </div>
      )}

      {isEdit && (
        <div className="wstep-code scroll">
          {diff.map((l, i) => {
            const t = l.startsWith("+") ? "add" : l.startsWith("-") ? "del" : "ctx";
            return (
              <div className={"wdiff-line " + t} key={i}>
                <span className="wdiff-sign">{t === "add" ? "+" : t === "del" ? "−" : " "}</span>
                <span className="wdiff-text">{l.slice(1) || "​"}</span>
              </div>
            );
          })}
        </div>
      )}

      {isRun && step.detail && (() => {
        // Collapse very long command output to keep the feed readable — show the head, note the rest.
        const lines = step.detail.split("\n");
        const head = lines.slice(0, 14);
        return (
          <div className="wstep-term">
            {head.map((l, i) => <div key={i} className={/✓|passed|ok\b/i.test(l) ? "ok" : ""}>{l || "​"}</div>)}
            {lines.length > head.length && <div className="wstep-more">… +{lines.length - head.length} lines</div>}
          </div>
        );
      })()}
    </div>
  );
}

export function WorkBlock({ steps, live }: { steps: Ev[]; live: boolean }) {
  const t = useT();
  const acts = steps.filter((s) => ["read", "create", "edit", "run", "search"].includes(s.kind));
  const edited = acts.filter((s) => s.kind === "create" || s.kind === "edit").length;
  const thinking = [...steps].reverse().find((s) => s.kind === "thinking");
  const done = !live;
  const [expanded, setExpanded] = useState(live);
  if (acts.length === 0 && !thinking) return null;
  return (
    <div className={"work-block" + (expanded ? "" : " collapsed")}>
      <button type="button" className="work-head" onClick={() => setExpanded((e) => !e)}>
        {done ? <span className="done-check"><Icon name="check" size={15} /></span> : <span className="spin"><Icon name="refresh" size={14} /></span>}
        <span className="wlabel">{done ? t("chat.work.done") : t("chat.work.working")}</span>
        <span className="wmeta">{done ? t(acts.length === 1 ? "chat.work.actions.one" : "chat.work.actions.other", { n: acts.length }) : t("chat.work.workingEllipsis")}</span>
        {done && edited > 0 && <span className="wmeta wfiles" title="files changed">✎ {edited}</span>}
        <span className={"work-toggle" + (expanded ? " open" : "")}><Icon name="chevronRight" size={13} /></span>
      </button>
      {expanded && (
        <>
          {thinking?.detail && <div className="work-thinking"><span className="ti"><Icon name="bot" size={13} /></span><span>{thinking.detail}</span></div>}
          <div className="work-steps">{acts.map((s) => <WorkStep key={s.id} step={s} />)}</div>
        </>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- composer */
export function ChatComposer({ onSend, placeholder, agents, defaultText = "", requireMention = false, enableAttachments = true, refs, busy = false, onStop }: {
  onSend: (t: string, attachments?: Attachment[]) => void; placeholder: string; agents: Agent[]; defaultText?: string;
  requireMention?: boolean; enableAttachments?: boolean; refs?: Ref[];
  busy?: boolean; onStop?: () => void; // while an agent is replying, Send morphs into Stop in the same spot
}) {
  const [text, setText] = useState(defaultText);
  const t = useT();
  const mentionOk = !requireMention
    || text.trim().startsWith("/")
    || (text.match(/@([a-z0-9-]+)/gi) || []).some((m) => agents.some((a) => a.handle.toLowerCase() === m.slice(1).toLowerCase()));
  const [focus, setFocus] = useState(false);
  const [men, setMen] = useState<{ query: string; start: number; items: Agent[]; index: number } | null>(null);
  const [refPop, setRefPop] = useState<{ query: string; start: number; items: Ref[]; index: number } | null>(null);
  const [cmd, setCmd] = useState<{ items: SlashCmd[]; index: number } | null>(null);
  const [atts, setAtts] = useState<Attachment[]>([]);
  const [upErr, setUpErr] = useState("");
  const [uploading, setUploading] = useState(false);
  const [kbOpen, setKbOpen] = useState(false);
  const [kbQuery, setKbQuery] = useState("");
  const [kbResult, setKbResult] = useState<{ text: string; sources: string[] } | null>(null);
  const [kbErr, setKbErr] = useState("");
  const [kbPending, startKb] = useTransition();
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const caretRef = useRef<number | null>(null);
  const kbPullEnabled = refs !== undefined;

  async function pickFiles(list: FileList | null) {
    if (!list || !list.length) return;
    setUpErr("");
    const room = 10 - atts.length;
    const chosen = Array.from(list).slice(0, Math.max(0, room));
    if (!chosen.length) { setUpErr(t("chat.composer.maxAttachments")); return; }
    const fd = new FormData();
    for (const f of chosen) fd.append("files", f);
    setUploading(true);
    try {
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok || !j.ok) { setUpErr(j.error ?? t("chat.composer.uploadFailed")); return; }
      setAtts((a) => [...a, ...(j.attachments as Attachment[])].slice(0, 10));
    } catch { setUpErr(t("chat.composer.uploadFailed")); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  useEffect(() => {
    if (caretRef.current != null && taRef.current) {
      taRef.current.setSelectionRange(caretRef.current, caretRef.current);
      caretRef.current = null;
    }
  });

  function recompute(value: string, caret: number) {
    const sm = value.match(/^\/([a-z-]*)$/i);
    if (sm) {
      const q = sm[1].toLowerCase();
      const items = SLASH_CMDS.filter((c) => c.cmd.slice(1).startsWith(q));
      setMen(null); setRefPop(null);
      setCmd(items.length ? { items, index: 0 } : null);
      return;
    }
    setCmd(null);
    // # references
    const rm = value.slice(0, caret).match(/#([a-z0-9_-]*)$/i);
    if (rm && refs && refs.length > 0) {
      const q = rm[1].toLowerCase();
      const items = refs.filter((r) => r.key.toLowerCase().includes(q) || r.title.toLowerCase().includes(q));
      setMen(null);
      setRefPop({ query: q, start: caret - rm[0].length, items, index: 0 });
      return;
    }
    setRefPop(null);
    const m = value.slice(0, caret).match(/@([a-z0-9-]*)$/i);
    if (!m) { setMen(null); return; }
    const q = m[1].toLowerCase();
    const items = agents.filter((a) => a.handle.includes(q) || a.name.toLowerCase().includes(q) || a.role.toLowerCase().includes(q));
    setMen({ query: q, start: caret - m[0].length, items, index: 0 });
  }
  function autosize(el: HTMLTextAreaElement) { el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 260) + "px"; }
  function choose(a: Agent) {
    if (!men || !taRef.current) return;
    const before = text.slice(0, men.start);
    const after = text.slice(taRef.current.selectionStart);
    const insert = "@" + a.handle + " ";
    setText(before + insert + after);
    caretRef.current = (before + insert).length;
    setMen(null);
    requestAnimationFrame(() => taRef.current?.focus());
  }
  function chooseRef(r: Ref) {
    if (!refPop || !taRef.current) return;
    const before = text.slice(0, refPop.start);
    const after = text.slice(taRef.current.selectionStart);
    const insert = "#" + r.key + " ";
    setText(before + insert + after);
    caretRef.current = (before + insert).length;
    setRefPop(null);
    requestAnimationFrame(() => taRef.current?.focus());
  }
  function chooseCmd(c: SlashCmd) {
    const insert = c.cmd + (c.arg ? " " : "");
    setText(insert);
    caretRef.current = insert.length;
    setCmd(null);
    requestAnimationFrame(() => taRef.current?.focus());
  }
  function openKbPull() {
    const seed = text.replace(/@[a-z0-9-]+/gi, "").trim().slice(0, 180);
    setKbQuery(seed);
    setKbResult(null);
    setKbErr("");
    setMen(null); setCmd(null); setRefPop(null);
    setKbOpen((open) => !open);
  }
  function searchKbPull() {
    const q = kbQuery.trim();
    if (!q) {
      setKbResult(null);
      setKbErr(t("chat.kbPull.empty"));
      return;
    }
    setKbErr("");
    setKbResult(null);
    startKb(async () => {
      const r = await pullKbForComposer(q);
      if (r.ok && r.text) setKbResult({ text: r.text, sources: r.sources ?? [] });
      else setKbErr(t("chat.kbPull.noResult"));
    });
  }
  function insertKbPull() {
    if (!kbResult) return;
    const sources = kbResult.sources.length ? `\nSources: ${kbResult.sources.join(", ")}` : "";
    const block = `KB: ${kbResult.text}${sources}`;
    setText((cur) => cur.trim() ? `${cur.trimEnd()}\n\n${block}` : block);
    setKbOpen(false);
    setKbResult(null);
    setKbErr("");
    requestAnimationFrame(() => {
      if (taRef.current) {
        autosize(taRef.current);
        taRef.current.focus();
      }
    });
  }
  function fire() {
    const b = text.trim();
    if (!b && atts.length === 0) return;
    if (!mentionOk) return;
    onSend(b, atts.length ? atts : undefined);
    setText(""); setAtts([]); setUpErr("");
    if (taRef.current) taRef.current.style.height = "auto";
    setMen(null); setCmd(null); setRefPop(null); setKbOpen(false);
  }
  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (cmd && cmd.items.length) {
      if (e.key === "ArrowDown") { e.preventDefault(); setCmd((s) => s && ({ ...s, index: (s.index + 1) % s.items.length })); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setCmd((s) => s && ({ ...s, index: (s.index - 1 + s.items.length) % s.items.length })); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); chooseCmd(cmd.items[cmd.index]); return; }
      if (e.key === "Escape") { e.preventDefault(); setCmd(null); return; }
    }
    if (refPop && refPop.items.length) {
      if (e.key === "ArrowDown") { e.preventDefault(); setRefPop((s) => s && ({ ...s, index: (s.index + 1) % s.items.length })); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setRefPop((s) => s && ({ ...s, index: (s.index - 1 + s.items.length) % s.items.length })); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); chooseRef(refPop.items[refPop.index]); return; }
      if (e.key === "Escape") { e.preventDefault(); setRefPop(null); return; }
    }
    if (men && men.items.length) {
      if (e.key === "ArrowDown") { e.preventDefault(); setMen((s) => s && ({ ...s, index: (s.index + 1) % s.items.length })); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setMen((s) => s && ({ ...s, index: (s.index - 1 + s.items.length) % s.items.length })); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); choose(men.items[men.index]); return; }
      if (e.key === "Escape") { e.preventDefault(); setMen(null); return; }
    }
    if (e.key === "Escape" && kbOpen) { e.preventDefault(); setKbOpen(false); return; }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); fire(); }
  }

  return (
    <div className="chat-composer">
      {men && (
        <div className="mention-pop">
          <div className="mention-head"><Icon name="at" size={12} /> {t("chat.composer.mentionAgent")}</div>
          <div className="mention-list scroll">
            {men.items.length === 0 && <div className="mention-empty">{t("chat.noAgentMatch", { q: men.query })}</div>}
            {men.items.map((a, i) => (
              <div key={a.handle} className={"mention-item" + (i === men.index ? " active" : "")}
                onMouseEnter={() => setMen((s) => s && ({ ...s, index: i }))}
                onMouseDown={(e) => { e.preventDefault(); choose(a); }}>
                <Avatar name={a.name} color={a.color} image={a.image} size={24} />
                <div className="mi-text"><div className="mi-name">{a.name} <span className="mi-handle">@{a.handle}</span></div></div>
                <span className="mi-role">{a.role}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {refPop && (
        <div className="mention-pop">
          <div className="mention-head"><Icon name="branch" size={12} /> {t("chat.composer.referenceItem")}</div>
          <div className="mention-list scroll">
            {refPop.items.length === 0 && <div className="mention-empty">{t("chat.noRefMatch", { q: refPop.query })}</div>}
            {refPop.items.map((r, i) => (
              <div key={r.id} className={"mention-item" + (i === refPop.index ? " active" : "")}
                onMouseEnter={() => setRefPop((s) => s && ({ ...s, index: i }))}
                onMouseDown={(e) => { e.preventDefault(); chooseRef(r); }}>
                <span className="mi-ref-kind">{t("chat.composer.refKind." + r.kind)}</span>
                <div className="mi-text"><div className="mi-name"><span className="mi-handle">#{r.key}</span> {r.title}</div></div>
              </div>
            ))}
          </div>
        </div>
      )}
      {cmd && (
        <div className="mention-pop">
          <div className="mention-head"><Icon name="command" size={12} /> {t("chat.commands")}</div>
          <div className="mention-list scroll">
            {cmd.items.map((c, i) => (
              <div key={c.cmd} className={"mention-item" + (i === cmd.index ? " active" : "")}
                onMouseEnter={() => setCmd((s) => s && ({ ...s, index: i }))}
                onMouseDown={(e) => { e.preventDefault(); chooseCmd(c); }}>
                <div className="mi-text"><div className="mi-name">{c.cmd}{c.arg && <span className="mi-handle"> {c.arg}</span>}</div></div>
                <span className="mi-role">{t("chat.slash." + c.descKey)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {kbOpen && (
        <div className="mention-pop kb-pull-pop">
          <div className="mention-head"><Icon name="branch" size={12} /> {t("chat.kbPull.title")}</div>
          <div className="kb-pull-body">
            <div className="kb-pull-row">
              <input className="kb-pull-input" value={kbQuery}
                placeholder={t("chat.kbPull.placeholder")}
                onChange={(e) => { setKbQuery(e.target.value); setKbErr(""); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); searchKbPull(); }
                  if (e.key === "Escape") { e.preventDefault(); setKbOpen(false); }
                }} />
              <button type="button" className="att-btn" disabled={kbPending} onMouseDown={(e) => e.preventDefault()} onClick={searchKbPull}>
                {kbPending ? <span className="spin"><Icon name="refresh" size={13} /></span> : <Icon name="search" size={13} />}
                {t("chat.kbPull.search")}
              </button>
            </div>
            <div className="kb-pull-preview">
              {kbPending ? <div className="kb-pull-muted">{t("chat.kbPull.searching")}</div>
                : kbResult ? (
                  <>
                    <div className="kb-pull-text">{kbResult.text}</div>
                    {kbResult.sources.length > 0 && <div className="kb-pull-sources">{kbResult.sources.map((s) => <span key={s}>{s}</span>)}</div>}
                  </>
                )
                : <div className={kbErr ? "kb-pull-error" : "kb-pull-muted"}>{kbErr || t("chat.kbPull.empty")}</div>}
            </div>
            {kbResult && (
              <div className="kb-pull-actions">
                <button type="button" className="send-btn" onMouseDown={(e) => e.preventDefault()} onClick={insertKbPull}>
                  <Icon name="add" size={13} /> {t("chat.kbPull.insert")}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      <div className={"composer-box" + (focus ? " focus" : "")}>
        {atts.length > 0 && (
          <div className="att-row">
            {atts.map((a, i) => (
              <span className="att-chip" key={a.path}>
                <Icon name={/^image\//.test(a.type) ? "doc" : a.type === "application/pdf" ? "doc" : "files"} size={11} />
                <span className="att-name">{a.name}</span>
                <button className="att-x" onClick={() => setAtts((x) => x.filter((_, j) => j !== i))}><Icon name="close" size={10} /></button>
              </span>
            ))}
          </div>
        )}
        {upErr && <div style={{ fontSize: 10.5, color: "#e8688f", padding: "2px 8px" }}>{upErr}</div>}
        <textarea ref={taRef} className="composer-input" value={text} rows={1}
          placeholder={placeholder}
          onChange={(e) => { setText(e.target.value); recompute(e.target.value, e.target.selectionStart); autosize(e.target); }}
          onKeyDown={onKey} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} />
        {enableAttachments && <input ref={fileRef} type="file" multiple hidden accept=".png,.jpg,.jpeg,.gif,.webp,.bmp,.pdf,.txt,.md,.csv,.json,.log,.zip,.doc,.docx,.xls,.xlsx,.ppt,.pptx" onChange={(e) => pickFiles(e.target.files)} />}
        <div className="composer-foot">
          <span className="composer-actions">
            {enableAttachments && (
              <button type="button" className="att-btn" title={t("chat.composer.attachTitle")} disabled={uploading || atts.length >= 10} onClick={() => fileRef.current?.click()}>
                {uploading ? <span className="spin"><Icon name="refresh" size={13} /></span> : <Icon name="add" size={14} />} {atts.length > 0 ? `${atts.length}/10` : t("chat.composer.attach")}
              </button>
            )}
            {kbPullEnabled && (
              <button type="button" className="att-btn kb-pull-btn" title={t("chat.kbPull.open")} disabled={kbPending} onMouseDown={(e) => e.preventDefault()} onClick={openKbPull}>
                <Icon name="branch" size={13} /> {t("chat.kbPull.open")}
              </button>
            )}
          </span>
          {requireMention && text.trim() && !mentionOk
            ? <span className="composer-hint" style={{ color: "#f0a35e" }}><Icon name="at" size={11} /> {t("chat.composer.mentionToSend")}</span>
            : <span className="composer-hint"><kbd>↵</kbd> {t("chat.composer.send")} · <kbd>⇧↵</kbd> {t("chat.composer.newline")}</span>}
          {busy ? (
            <button className="send-btn" style={{ background: "var(--sx-keyword)", borderColor: "var(--sx-keyword)" }} onMouseDown={(e) => e.preventDefault()} onClick={onStop}>
              <Icon name="close" size={13} /> {t("chat.stop")}
            </button>
          ) : (
            <button className="send-btn" disabled={(!text.trim() && atts.length === 0) || !mentionOk} onMouseDown={(e) => e.preventDefault()} onClick={fire}>
              <Icon name="send" size={13} /> {t("home.cmd.run")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- attachments */
export function MsgAttachments({ atts }: { atts: Attachment[] }) {
  return (
    <div className="msg-atts">
      {atts.map((a) => {
        const url = `/api/upload?path=${encodeURIComponent(a.path)}`;
        return /^image\//.test(a.type) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <a key={a.path} href={url} target="_blank" rel="noreferrer" className="msg-att-img" title={a.name}><img src={url} alt={a.name} loading="lazy" /></a>
        ) : (
          <a key={a.path} href={url} target="_blank" rel="noreferrer" className="msg-att-doc" title={a.name}><Icon name="doc" size={13} /> <span className="mad-name">{a.name}</span></a>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------- send-to-KB */
export function KbSaveButton({ id }: { id: string }) {
  const t = useT();
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  return (
    <button type="button" className="cmsg-kb" disabled={pending || saved}
      title={saved ? t("chat.kbSave.saved") : t("chat.kbSave.send")}
      onClick={() => start(async () => { const r = await sendMessageToKb(id); if (r.ok) setSaved(true); })}
      style={{ background: "none", border: "none", cursor: saved ? "default" : "pointer", padding: 0, marginLeft: 2, display: "inline-flex", alignItems: "center", color: saved ? "var(--accent)" : "var(--text-faint)", opacity: pending ? 0.5 : 1 }}>
      <Icon name={saved ? "check" : "branch"} size={11} className={pending ? "sync-spin" : ""} />
    </button>
  );
}

/** Traceability chip on a task's room message → task key · issue · goal · column. Resolved lazily. */
export function MsgRef({ taskId }: { taskId: string }) {
  const [ref, setRef] = useState<{ taskKey: string; issueKey?: string; goalTitle?: string; col?: string } | null>(null);
  useEffect(() => { let on = true; taskRef(taskId).then((r) => { if (on) setRef(r); }).catch(() => {}); return () => { on = false; }; }, [taskId]);
  if (!ref) return null;
  return (
    <div style={{ marginTop: 5, fontSize: 10.5, color: "var(--text-faint)", display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
      <Icon name="branch" size={10} />
      <span style={{ color: "var(--accent)", fontWeight: 600 }}>{ref.taskKey}</span>
      {ref.issueKey && <span>· {ref.issueKey}</span>}
      {ref.goalTitle && <span>· {ref.goalTitle.slice(0, 40)}</span>}
      {ref.col && <span style={{ padding: "0 5px", borderRadius: 5, border: "1px solid var(--border)", textTransform: "capitalize" }}>{ref.col}</span>}
    </div>
  );
}

/** Synced-block chips — the canonical blocks a reply proposed an edit to. Links to the Knowledge page. */
export function MsgBlocks({ blocks }: { blocks: string[] }) {
  const router = useRouter();
  const t = useT();
  return (
    <div style={{ marginTop: 5, fontSize: 10.5, color: "var(--text-faint)", display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
      <Icon name="doc" size={10} />
      <span>{t("chat.touchedBlocks")}</span>
      {blocks.map((b) => (
        <button key={b} type="button" title={t("chat.touchedBlocks")} onClick={() => router.push("/knowledge" as Route)}
          style={{ color: "var(--accent)", fontWeight: 600, background: "rgba(120,100,255,.10)", border: "1px solid rgba(120,100,255,.25)", borderRadius: 4, padding: "0 5px", cursor: "pointer" }}>{b}</button>
      ))}
    </div>
  );
}

/** Collapsible "sources" line under an agent reply (RAG file paths). Collapsed by default. */
function SourcesLine({ sources }: { sources: string[] }) {
  const [open, setOpen] = useState(false);
  const t = useT();
  return (
    <div className="msg-sources">
      <button type="button" className="msg-sources-toggle" onClick={() => setOpen((o) => !o)}>
        <Icon name="pulse" size={10} /> {t("chat.sources", { n: sources.length })} <Icon name={open ? "chevronDown" : "chevronRight"} size={11} />
      </button>
      {open && <div className="msg-sources-list">{sources.map((s, i) => <span key={i}>{s}</span>)}</div>}
    </div>
  );
}

/** Long agent replies clamp to a readable height with a "show more" toggle. */
function MsgText({ text, markdown, known, refs }: { text: string; markdown: boolean; known: Set<string>; refs?: Ref[] }) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const long = text.length > 900;
  // The toggle is a SIBLING of the bubble — never inside the clamped+masked area, or the fade would hide
  // the very control that reveals the rest. Collapsed = clamped; expanded = cap to the viewport + scroll
  // INSIDE the bubble so a huge reply stays fully readable without breaking the layout.
  return (
    <>
      <div className={"cmsg-bubble" + (long && !expanded ? " clamped" : "") + (long && expanded ? " expanded" : "")}>
        {markdown ? <div className="md cmsg-md"><ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown></div> : renderMentions(text, known, refs)}
      </div>
      {long && <button type="button" className="cmsg-more" onClick={() => setExpanded((e) => !e)}>{expanded ? t("chat.showLess") : t("chat.showMore")}</button>}
    </>
  );
}

/** The structured, curated Knowledge Base answer card: markdown body + action buttons + collapsible
 *  sources. Posted by /kb for "how is the KB?"-style questions (message.kind === "kb-card"). */
function KbCard({ m }: { m: Msg }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [openSrc, setOpenSrc] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  return (
    <div className="kb-card">
      <div className="kb-card-head"><Icon name="branch" size={14} /> {t("kbcard.title")}</div>
      <div className="kb-card-body cmsg-md"><ReactMarkdown remarkPlugins={[remarkGfm]}>{m.text}</ReactMarkdown></div>
      {note && <div className="kb-card-note"><Icon name="check" size={12} /> {note}</div>}
      <div className="kb-card-actions">
        <button className="kbc-btn primary" disabled={pending} onClick={() => start(async () => { const r = await seedDefaultBlocksAction(); setNote(t("kbcard.created", { n: r.seeded })); router.refresh(); })}>{t("home.createBlocks")}</button>
        <button className="kbc-btn" onClick={() => router.push("/knowledge" as Route)}>{t("home.openKnowledge")}</button>
        <button className="kbc-btn" disabled={pending} onClick={() => start(async () => { const r = await reindexKbAction(); setNote(t("kb.reindexResult", { n: r.chunks })); router.refresh(); })}>{t("kb.reindex")}</button>
      </div>
      {m.sources && m.sources.length > 0 && (
        <div className="kb-card-sources">
          <button type="button" className="msg-sources-toggle" onClick={() => setOpenSrc((o) => !o)}>
            <Icon name="pulse" size={10} /> {t("chat.sources", { n: m.sources.length })} <Icon name={openSrc ? "chevronDown" : "chevronRight"} size={11} />
          </button>
          {openSrc && <div className="msg-sources-list">{m.sources.map((s, i) => <span key={i}>{s}</span>)}</div>}
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- stream */
export function ChatStream({ msgs, typing, agents, byRun, liveRuns, loading, highlightId, operator, markdownAgent = false, emptyHint, avatarSize = 30, refs }: {
  msgs: Msg[]; typing: string[]; agents: Agent[];
  byRun: Record<string, Ev[]>; liveRuns: [string, Ev[]][]; loading?: boolean; highlightId?: string | null;
  operator?: { name: string; image?: string | null };
  markdownAgent?: boolean;
  emptyHint?: string;
  avatarSize?: number;
  refs?: Ref[];
}) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const byHandle = Object.fromEntries(agents.map((a) => [a.handle, a]));
  const known = new Set(agents.map((a) => a.handle));
  const onScroll = () => { const el = ref.current; if (el) atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120; };
  useEffect(() => { const el = ref.current; if (el && atBottom.current) el.scrollTop = el.scrollHeight; }, [msgs, typing, byRun, liveRuns]);
  useEffect(() => { if (highlightId) document.getElementById("m-" + highlightId)?.scrollIntoView({ block: "center", behavior: "smooth" }); }, [highlightId, msgs]);

  return (
    <div className="chat-stream scroll" ref={ref} onScroll={onScroll}>
      {[...msgs].sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0, tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return ta !== tb ? ta - tb : (a.fromKind === "operator" ? 0 : 1) - (b.fromKind === "operator" ? 0 : 1);
      }).map((m) => {
        const isOp = m.fromKind === "operator";
        const a = m.fromHandle ? byHandle[m.fromHandle] : null;
        const work = byRun[m.id];
        const isCard = !isOp && m.kind === "kb-card";
        return (
          <div className={"cmsg" + (isOp ? " operator" : "") + (highlightId === m.id ? " highlight" : "")} id={"m-" + m.id} key={m.id}>
            {isOp
              ? (operator?.image
                ? <Avatar name={operator.name || t("chat.you")} color="#9a5cff" image={operator.image} size={avatarSize} />
                : <div className="avatar" style={{ background: "linear-gradient(150deg,#e0a44e,#9a5cff)", color: "#1a1206", width: avatarSize, height: avatarSize, borderRadius: Math.round(avatarSize * 0.3), display: "grid", placeItems: "center", fontWeight: 700, fontSize: Math.round(avatarSize * 0.4) }}>OP</div>)
              : a ? <Avatar name={a.name} color={a.color} image={a.image} size={avatarSize} /> : <Avatar name="?" color="#6b7390" size={avatarSize} />}
            <div className="cmsg-body">
              <div className="cmsg-head">
                <span className="cmsg-name">{isOp ? t("chat.you") : a?.name ?? m.fromHandle}</span>
                {!isOp && a && <span className="cmsg-role">{a.role}</span>}
                <span className="cmsg-when">{clock(m.createdAt)}</span>
                {!isOp && m.text && <KbSaveButton id={m.id} />}
              </div>
              {work && work.length > 0 && <WorkBlock steps={work} live={false} />}
              {isCard
                ? <KbCard m={m} />
                : m.text && <MsgText text={m.text} markdown={markdownAgent && !isOp} known={known} refs={refs} />}
              {m.attachments && m.attachments.length > 0 && <MsgAttachments atts={m.attachments} />}
              {!isOp && !isCard && m.sources && m.sources.length > 0 && <SourcesLine sources={m.sources} />}
              {!isOp && m.taskId && <MsgRef taskId={m.taskId} />}
              {!isOp && m.blocks && m.blocks.length > 0 && <MsgBlocks blocks={m.blocks} />}
            </div>
          </div>
        );
      })}
      {liveRuns.map(([rid, evs]) => {
        const aId = evs.find((e) => e.agentId)?.agentId;
        const a = agents.find((x) => x.id === aId);
        if (!a) return null;
        const newest = evs.reduce((mx, e) => Math.max(mx, e.seq || 0), 0);
        const finished = evs.some((e) => e.kind === "done") || (newest > 0 && Date.now() - newest > 120_000);
        const liveText = evs.filter((e) => e.kind === "text").map((e) => e.detail).join("");
        return (
          <div className="cmsg" key={"live-" + rid}>
            <Avatar name={a.name} color={a.color} image={a.image} size={avatarSize} />
            <div className="cmsg-body">
              <div className="cmsg-head"><span className="cmsg-name">{a.name}</span><span className="cmsg-role">{a.role}</span></div>
              <WorkBlock steps={evs} live={!finished} />
              {liveText && <div className="cmsg-bubble">{renderMentions(liveText, known, refs)}{!finished && <span className="live-caret" />}</div>}
            </div>
          </div>
        );
      })}
      {typing.filter((h) => { const a = byHandle[h]; return a && !liveRuns.some(([, evs]) => evs.some((e) => e.agentId === a.id)); }).map((h) => {
        const a = byHandle[h];
        if (!a) return null;
        return (
          <div className="cmsg" key={"typing-" + h}>
            <Avatar name={a.name} color={a.color} image={a.image} size={avatarSize} />
            <div className="cmsg-body">
              <div className="cmsg-head"><span className="cmsg-name">{a.name}</span><span className="cmsg-role">{a.role}</span></div>
              <div className="typing-bubble"><span /><span /><span /></div>
            </div>
          </div>
        );
      })}
      {loading && msgs.length === 0 && liveRuns.length === 0 && (
        <div className="chat-skel" aria-label={t("home.chat.loading")}>
          {[0, 1, 2].map((i) => (
            <div className="skel-row" key={i} style={{ animationDelay: `${i * 0.12}s` }}>
              <div className="skel-avatar" />
              <div className="skel-lines">
                <div className="skel-line" style={{ width: "38%" }} />
                <div className="skel-line" style={{ width: i === 1 ? "82%" : "64%" }} />
                {i !== 2 && <div className="skel-line" style={{ width: "48%" }} />}
              </div>
            </div>
          ))}
        </div>
      )}
      {!loading && msgs.length === 0 && typing.length === 0 && liveRuns.length === 0 && (
        <div className="mention-empty" style={{ textAlign: "center", padding: 22 }}>{emptyHint ?? t("chat.stream.emptyHint")}</div>
      )}
    </div>
  );
}
