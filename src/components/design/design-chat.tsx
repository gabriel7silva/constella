"use client";

/* The Design chat — MOVED out of the Design module into Grace's DM (AGENTS dock + Welcome-Home). Same
   behavior as the old in-module chat: token-by-token streaming on the "design" channel, suggestion chips,
   image attach/paste/drop, canvas element-attach (via the `constella:open-grace` seed the dock forwards),
   context donut + compact, and Stop. Each send runs the REAL prototype build (askDesign) — the /design
   canvas (which independently tails "design") paints live. Self-contained: its own SSE tail + styles, so it
   works wherever it's mounted. */

import { useState, useEffect, useRef } from "react";
import { useT } from "@/lib/i18n-context";
import { Icon } from "@/components/ui/icon";
import { ChatStream, type Msg, type Ev, type Agent } from "@/components/chat/parts";
import { getMessages } from "@/server/chat";
import { getEvents } from "@/server/events";
import { askDesign, getDesignChatContext } from "@/server/design/actions";
import { cancelRunClient, newRunToken } from "@/lib/run-client";
import { conversationContext, compactConversation, type ContextStat } from "@/server/actions/context-actions";
import { ContextDonut } from "@/components/shell/context-donut";
import type { CanvasSelection } from "@/lib/design/selection";

type Att = { name: string; type: string; size: number; path: string };
type Tr = ReturnType<typeof useT>;
type Grace = { id: string; name: string; handle: string; color?: string; image?: string | null } | null;
export type GraceSeed = { text?: string; selection?: CanvasSelection } | null;

function cap(s: string): string { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
// A chip must be a forward NEXT STEP — never a report of something Grace already did (past-tense / participle
// / status words in PT + EN). Infinitives still pass, so "Add a section" is a chip but "Added the section" isn't.
const DONE_RE = /\b(remov(i|ido|eu|idos)|adicion(ei|ado|ou|ados)|cri(ei|ado|ou|ados)|corrig(i|ido|iu)|ajust(ei|ado|ou)|atualiz(ei|ado|ou)|mud(ei|ado|ou)|delet(ei|ado|ou)|limp(ei|ado|ou)|troqu(ei)|troc(ado|ou)|inseri|inserido|fiz|feit[oa]s?|pront[oa]s?|conclu(i|í|ido|ída)|finaliz(ei|ado|ou)|implement(ei|ado|ou)|ger(ei|ado|ou)|salv(ei|o|ado)|apliqu(ei)|aplic(ado|ou)|added|removed|deleted|created|fixed|updated|changed|cleaned|adjusted|renamed|moved|made|done|ready|here'?s|i'?ve|i\s+have|i\s+just|i\s+made)\b/i;
function isForwardStep(v: string): boolean {
  if (v.length < 2 || v.length > 42) return false;
  if (DONE_RE.test(v)) return false;
  if ((v.match(/\s+/g) || []).length > 6) return false;
  return true;
}
type Suggestion = { label: string; prompt: string };
const SUGG_POOL_SCREENS: [string, string][] = [
  ["design.sugg.adjustPalette", "Adjust the color palette"], ["design.sugg.improveSpacing", "Improve the spacing"],
  ["design.sugg.mobileVersion", "Create a mobile version"], ["design.sugg.darkTheme", "Try a dark theme"],
  ["design.sugg.addSection", "Add a section"], ["design.sugg.newScreen", "Create a new screen"],
  ["design.sugg.visualDocs", "Generate the visual docs"], ["design.sugg.askReview", "Ask Grace for a review"],
  ["design.sugg.approve", "Approve design"], ["design.sugg.sendExec", "Send to execution"],
];
const SUGG_POOL_EMPTY: [string, string][] = [
  ["design.sugg.firstScreen", "Build the first screen"], ["design.sugg.proposePalette", "Propose a color palette"],
  ["design.sugg.defineTypography", "Define the typography"], ["design.sugg.mainFlow", "Design the main flow"],
  ["design.sugg.heroSection", "Add a hero section"], ["design.sugg.mobileVersion", "Create a mobile version"],
];
/** Real, state-aware composer suggestions (no extra LLM call) — Grace's own **bold** forward options first,
 *  then a curated pool. `designMockFiles` decides screens-vs-empty pool. */
function buildSuggestions(msgs: Msg[], designMockFiles: string[], t: Tr): Suggestion[] {
  const out: Suggestion[] = [];
  const norm = (s?: string) => (s ?? "").replace(/\s+/g, " ").replace(/^[-•*\s]+/, "").replace(/[.:;,!?]+$/, "").trim();
  const add = (label: string, prompt: string) => { const v = norm(label); if (v.length >= 2 && v.length <= 42 && !out.some((x) => x.label.toLowerCase() === v.toLowerCase())) out.push({ label: cap(v), prompt }); };
  const lastAgent = [...msgs].reverse().find((m) => m.fromKind === "agent" && m.text);
  if (lastAgent?.text) {
    for (const m of lastAgent.text.matchAll(/\*\*(.+?)\*\*/g)) { const v = norm(m[1]); if (isForwardStep(v)) add(v, v); if (out.length >= 4) break; }
  }
  const hasScreens = designMockFiles.some((p) => /\.html?$/i.test(p));
  const pool = hasScreens ? SUGG_POOL_SCREENS : SUGG_POOL_EMPTY;
  for (const [key, prompt] of pool) { add(t(key), prompt); if (out.length >= 4) break; }
  return out.slice(0, 4);
}

// Namespaced `dc-*` classes so they NEVER collide with the Design module's own `dz-*` CSS (design-room.tsx
// injects `.dz-chat{width:312px;flex:0 0 312px}` — a same-name collision made this chat overflow the dock).
const CSS = `
.dc-chat{flex:1 1 0;min-height:0;min-width:0;display:flex;flex-direction:column;background:var(--bg-panel);overflow:hidden;}
.dc-ctxbar{flex:0 0 auto;display:flex;align-items:center;padding:6px 12px;border-bottom:1px solid var(--border-subtle);}
.dc-composer{flex:0 0 auto;border-top:1px solid var(--border-subtle);padding:11px 13px 13px;}
.dc-chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:9px;}
.dc-chip{font-size:11px;font-weight:600;color:var(--text-dim);background:var(--bg-elevated);border:1px solid var(--border);border-radius:999px;padding:5px 10px;cursor:pointer;transition:.15s;}
.dc-chip:hover{color:var(--accent);border-color:var(--accent);}
.dc-attach{display:flex;align-items:center;gap:7px;font-size:11px;color:var(--text);background:var(--bg-elevated);border:1px solid var(--accent);border-radius:9px;padding:6px 9px;margin-bottom:8px;}
.dc-attach .sw{width:13px;height:13px;border-radius:3px;border:1px solid var(--border);}
.dc-attach .x{margin-left:auto;cursor:pointer;color:var(--text-dim);display:grid;place-items:center;}
.dc-atts{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;}
.dc-att{display:flex;align-items:center;gap:6px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:8px;padding:3px 4px 3px 6px;font-size:10.5px;color:var(--text-dim);max-width:158px;}
.dc-att img{width:22px;height:22px;border-radius:4px;object-fit:cover;flex:0 0 22px;}
.dc-att .nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.dc-att .rm{cursor:pointer;color:var(--text-faint);display:grid;place-items:center;width:16px;height:16px;border-radius:4px;flex:0 0 16px;}
.dc-att .rm:hover{color:var(--text);background:var(--bg-app);}
.dc-uperr{font-size:10.5px;color:#e5687a;margin-bottom:6px;}
.dc-input{display:flex;align-items:center;gap:8px;background:var(--bg-input,var(--bg-elevated));border:1px solid var(--border);border-radius:11px;padding:8px 8px 8px 12px;}
.dc-input input{flex:1;min-width:0;background:none;border:none;outline:none;color:var(--text);font-size:12.5px;font-family:inherit;}
.dc-input input::placeholder{color:var(--text-faint);}
.dc-clip{width:30px;height:30px;flex:0 0 30px;border-radius:8px;border:1px solid var(--border);background:var(--bg-elevated);color:var(--text-dim);display:grid;place-items:center;cursor:pointer;}
.dc-clip:hover{color:var(--accent);border-color:var(--accent);}
.dc-clip:disabled{opacity:.5;cursor:default;}
.dc-send{width:30px;height:30px;flex:0 0 30px;border-radius:8px;border:none;background:var(--accent);color:var(--accent-fg,#1a1205);display:grid;place-items:center;cursor:pointer;}
.dc-send:disabled{opacity:.5;cursor:default;}
`;

/** The Design chat, mounted inside Grace's DM. `seed` carries a canvas element / prompt forwarded by the dock
 *  (from the `constella:open-grace` event); applied to the composer, then cleared via `onSeedConsumed`. */
export function DesignChat({ grace, seed, onSeedConsumed, operator }: { grace: Grace; seed?: GraceSeed; onSeedConsumed?: () => void; operator?: { name: string; image?: string | null } }) {
  const t = useT();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [chatEvents, setChatEvents] = useState<Ev[]>([]);
  const [chatLoading, setChatLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const graceRunToken = useRef<string | null>(null);
  const [cancelledRunIds, setCancelledRunIds] = useState<Set<string>>(() => new Set());
  const evSeq = useRef(0);
  const msgCursor = useRef(0);
  const esRef = useRef<EventSource | null>(null);
  const [msg, setMsg] = useState("");
  const [atts, setAtts] = useState<Att[]>([]);
  const [attached, setAttached] = useState<CanvasSelection | null>(null);
  const [upErr, setUpErr] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [ctx, setCtx] = useState<ContextStat | null>(null);
  const [compacting, setCompacting] = useState(false);
  const [designMockFiles, setDesignMockFiles] = useState<string[]>([]);
  const [approved, setApproved] = useState(false);
  const [drag, setDrag] = useState(false);

  // Apply a canvas element / prompt forwarded from the /design canvas.
  useEffect(() => {
    if (!seed) return;
    if (seed.selection) setAttached(seed.selection);
    if (seed.text) setMsg(seed.text);
    onSeedConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  // Design context (only what the suggestion chips need): screens present + approved state.
  useEffect(() => { getDesignChatContext().then((c) => { setDesignMockFiles(c.designMockFiles); setApproved(c.approved); }).catch(() => {}); }, [msgs.length]);

  // Load the "design" channel history once, then tail it over a single SSE connection.
  useEffect(() => {
    let cancelled = false;
    const CAP = 250;
    const cap2 = <T,>(a: T[]): T[] => (a.length > CAP ? a.slice(-CAP) : a);
    async function loadHistory() {
      const [m, e] = await Promise.all([getMessages("design"), getEvents("design", 0)]);
      if (cancelled) return;
      const ms = m as Msg[], evs = e as Ev[];
      setMsgs(ms); setChatEvents(evs);
      evSeq.current = evs.reduce((mx, r) => Math.max(mx, r.seq), 0);
      msgCursor.current = ms.reduce((mx, r) => Math.max(mx, r.createdAt ? new Date(r.createdAt).getTime() : 0), 0);
    }
    function connect() {
      if (cancelled || document.hidden || esRef.current) return;
      const es = new EventSource(`/api/stream?channel=design&evCursor=${evSeq.current}&msgCursor=${msgCursor.current}`);
      esRef.current = es;
      es.addEventListener("ev", (e) => {
        const row = JSON.parse((e as MessageEvent).data) as Ev;
        if (row.seq > evSeq.current) evSeq.current = row.seq;
        setChatEvents((cur) => (cur.some((x) => x.id === row.id) ? cur : cap2([...cur, row])));
      });
      es.addEventListener("msg", (e) => {
        const row = JSON.parse((e as MessageEvent).data) as Msg;
        const tm = row.createdAt ? new Date(row.createdAt).getTime() : 0;
        if (tm > msgCursor.current) msgCursor.current = tm;
        setMsgs((cur) => (cur.some((x) => x.id === row.id) ? cur : cap2([...cur, row])));
        setChatEvents((cur) => cur.filter((x) => !(x.runId === row.id && x.kind === "text")));
        setCancelledRunIds((cur) => { if (!cur.has(row.id)) return cur; const next = new Set(cur); next.delete(row.id); return next; });
        if (row.fromKind === "agent") { setPending(false); graceRunToken.current = null; }
      });
    }
    function disconnect() { if (esRef.current) { esRef.current.close(); esRef.current = null; } }
    loadHistory().catch(() => {}).finally(() => { if (cancelled) return; setChatLoading(false); if (!document.hidden) connect(); });
    const onVis = () => { if (document.hidden) disconnect(); else connect(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { cancelled = true; document.removeEventListener("visibilitychange", onVis); disconnect(); };
  }, []);

  const loadCtx = async () => {
    try {
      let stat = await conversationContext("design");
      if (stat.used >= stat.max && !compacting) {
        setCompacting(true);
        try { await compactConversation("design"); stat = await conversationContext("design"); } finally { setCompacting(false); }
      }
      setCtx(stat);
    } catch { /* ignore */ }
  };
  useEffect(() => { loadCtx(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [msgs.length]);
  async function onCompact() {
    if (compacting) return;
    setCompacting(true);
    try { await compactConversation("design"); await loadCtx(); } finally { setCompacting(false); }
  }

  // Generate the run token up front so Stop has a handle from the instant Grace starts.
  function askGrace(prompt: string, attachments?: Att[], selection?: CanvasSelection) {
    const token = newRunToken();
    graceRunToken.current = token;
    setPending(true);
    return askDesign(prompt, attachments, selection, token).then((r) => {
      if (!r.ok) { setUpErr(r.error || t("design.toast.couldNotStart")); setPending(false); if (graceRunToken.current === token) graceRunToken.current = null; }
      return r;
    });
  }
  function send(override?: string) {
    const text = (override ?? msg).trim();
    if ((!text && !atts.length && !attached) || pending) return;
    const payload = atts.slice();
    const selPayload = attached;
    setMsg(""); setAtts([]); setUpErr(""); setAttached(null);
    void askGrace(text || (selPayload ? "Adjust this element." : "Use the attached image(s) as the visual reference."), payload, selPayload ?? undefined);
  }
  function stopGrace() {
    const token = graceRunToken.current;
    if (!token) return;
    graceRunToken.current = null;
    setCancelledRunIds((cur) => { const next = new Set(cur); next.add(token); return next; });
    setChatEvents((cur) => cur.filter((e) => e.runId !== token));
    setPending(false);
    void cancelRunClient(token);
  }
  async function pickFiles(list: FileList | File[] | null) {
    if (!list) return;
    const files = (Array.from(list) as File[]).filter((f) => f instanceof File);
    if (!files.length) return;
    setUpErr("");
    const chosen = files.slice(0, Math.max(0, 6 - atts.length));
    if (!chosen.length) { setUpErr(t("design.toast.upTo6")); return; }
    const fd = new FormData();
    for (const f of chosen) fd.append("files", f);
    setUploading(true);
    try {
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok || !j.ok) { setUpErr(j.error || t("design.toast.uploadFailed")); return; }
      setAtts((a) => [...a, ...(j.attachments as Att[])].slice(0, 6));
    } catch { setUpErr(t("design.toast.uploadFailed")); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  }
  function onPaste(e: React.ClipboardEvent) {
    const imgs = Array.from(e.clipboardData?.items || [])
      .filter((it) => it.kind === "file" && it.type.startsWith("image/"))
      .map((it) => it.getAsFile()).filter((f): f is File => !!f);
    if (imgs.length) { e.preventDefault(); void pickFiles(imgs); }
  }

  const graceAgent: Agent | null = grace
    ? { id: grace.id, handle: grace.handle, name: grace.name, role: "Frontend", color: grace.color ?? "#84aef5", image: grace.image ?? null, adapter: "claude", status: "idle", health: null }
    : null;
  const chatAgents = graceAgent ? [graceAgent] : [];
  const byRun: Record<string, Ev[]> = {};
  for (const e of chatEvents) (byRun[e.runId] ??= []).push(e);
  const msgIds = new Set(msgs.map((m) => m.id));
  const liveRuns = Object.entries(byRun).filter(([rid]) => !msgIds.has(rid) && !cancelledRunIds.has(rid)) as [string, Ev[]][];
  const lastByTime = [...msgs].sort((a, b) => (a.createdAt ? new Date(a.createdAt).getTime() : 0) - (b.createdAt ? new Date(b.createdAt).getTime() : 0)).at(-1);
  const showSuggest = !pending && (msgs.length === 0 || lastByTime?.fromKind === "agent");
  const suggestions = showSuggest ? buildSuggestions(msgs, designMockFiles, t) : [];

  return (
    <div className="dc-chat">
      <style>{CSS}</style>
      {ctx && <div className="dc-ctxbar"><ContextDonut stat={ctx} onCompact={onCompact} compacting={compacting} /><span /></div>}
      <ChatStream
        msgs={msgs}
        typing={pending && graceAgent ? [graceAgent.handle] : []}
        agents={chatAgents}
        byRun={byRun}
        liveRuns={liveRuns}
        loading={chatLoading}
        operator={operator}
        markdownAgent
        avatarSize={28}
        emptyHint={t("design.chat.emptyHint")}
      />
      <div className={"dc-composer" + (drag ? " drag" : "")}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={(e) => { e.preventDefault(); setDrag(false); }}
        onDrop={(e) => { e.preventDefault(); setDrag(false); void pickFiles(e.dataTransfer.files); }}>
        {!approved && suggestions.length > 0 && !attached && <div className="dc-chips">{suggestions.map((c) => <span className="dc-chip" key={c.label} onClick={() => send(c.prompt)}>{c.label}</span>)}</div>}
        {attached && (
          <div className="dc-attach">
            <span className="sw" style={{ background: "var(--accent)" }} /> {t("design.composer.elementLabel")} <b style={{ fontWeight: 700 }}>{attached.componentName}</b>
            <span className="x" onClick={() => setAttached(null)}><Icon name="close" size={12} /></span>
          </div>
        )}
        {upErr && <div className="dc-uperr">{upErr}</div>}
        {atts.length > 0 && (
          <div className="dc-atts">
            {atts.map((a, i) => (
              <span className="dc-att" key={a.path}>
                {a.type.startsWith("image/") && <img src={`/api/upload?path=${encodeURIComponent(a.path)}`} alt="" />}
                <span className="nm">{a.name}</span>
                <span className="rm" title={t("design.composer.remove")} onClick={() => setAtts((x) => x.filter((_, j) => j !== i))}><Icon name="close" size={11} /></span>
              </span>
            ))}
          </div>
        )}
        <div className="dc-input">
          <button className="dc-clip" disabled={pending || uploading} title={t("design.composer.attach")} onClick={() => fileRef.current?.click()}>
            <Icon name={uploading ? "refresh" : "add"} size={15} className={uploading ? "sync-spin" : ""} />
          </button>
          <input placeholder={attached ? t("design.composer.changePlaceholder", { name: attached.componentName }) : t("design.composer.placeholder")} value={msg} disabled={pending}
            onChange={(e) => setMsg(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} onPaste={onPaste} />
          {pending ? (
            <button className="dc-send" style={{ background: "var(--sx-keyword)", borderColor: "var(--sx-keyword)" }} onClick={stopGrace} title={t("chat.stop")}><Icon name="close" size={15} /></button>
          ) : (
            <button className="dc-send" disabled={!msg.trim() && !atts.length && !attached} onClick={() => send()}><Icon name="send" size={15} /></button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*,.pdf" multiple style={{ display: "none" }} onChange={(e) => pickFiles(e.target.files)} />
      </div>
    </div>
  );
}
