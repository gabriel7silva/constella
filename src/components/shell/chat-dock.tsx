"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import { sendMessage, agentRespond, getMessages, getDmPreviews, clearConversation, listSessions, createSession, switchSession, renameSession, deleteSession, listChatRefs } from "@/server/chat";
import { useT } from "@/lib/i18n-context";
import { cancelRunClient, newRunToken } from "@/lib/run-client";
import { DesignChat, type GraceSeed } from "@/components/design/design-chat";
import type { CanvasSelection } from "@/lib/design/selection";
import { telegramStatus, connectTelegram, disconnectTelegram } from "@/server/actions/profile-actions";
import { getEvents } from "@/server/events";
import { conversationContext, compactConversation, type ContextStat } from "@/server/actions/context-actions";
import { getChatNotifications, markNotifRead, markChannelRead, getUnreadCounts, type ChatNotif } from "@/server/actions/chat-notif-actions";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { StatusDot } from "@/components/ui/status-dot";
import { ContextDonut } from "@/components/shell/context-donut";
import { ChatStream, ChatComposer, StatusPill, type Agent, type Msg, type Ev, type Attachment, type Ref } from "@/components/chat/parts";

/* Team Room (channel) + Direct (per-agent DM) dock. Resizable + movable dock, member avatars,
   @mention autocomplete, work-block diff/terminal cards, typing dots. The chat render primitives
   (ChatStream/ChatComposer/WorkBlock…) live in components/chat/parts.tsx, shared with the Welcome
   Home central chat. Data is REAL — messages from getMessages, the live work-stream from
   getEvents/emit, replies via the CLI. */

type Preview = { text: string; mine: boolean };

/* ----------------------------------------------------------------- people roster */
export function PeopleList({ agents, previews, onOpenDM }: { agents: Agent[]; previews: Record<string, Preview>; onOpenDM: (h: string) => void }) {
  const t = useT();
  const [q, setQ] = useState("");
  const f = q.trim().toLowerCase();
  const list = agents.filter((a) => !f || a.name.toLowerCase().includes(f) || a.handle.includes(f) || a.role.toLowerCase().includes(f));
  return (
    <>
      <div className="dm-search">
        <Icon name="search" size={13} />
        <input placeholder={t("chat.searchAgents")} value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      </div>
      <div className="people-list scroll">
        {list.length === 0 && <div className="mention-empty">{t("chat.noAgentMatch", { q })}</div>}
        {list.map((a) => {
          const pv = previews[a.handle];
          return (
            <div className="people-row" key={a.handle} onClick={() => onOpenDM(a.handle)}>
              <Avatar name={a.name} color={a.color} image={a.image} size={36} health={a.health} />
              <div className="people-meta">
                <div className="people-name" style={{ display: "flex", alignItems: "center", gap: 6 }}>{a.name} <span className="agent-handle">@{a.handle}</span> {a.status !== "idle" && <StatusDot status={a.status} />}</div>
                <div className={"people-sub" + (pv ? " preview" : "")}>{pv ? (pv.mine ? t("chat.youPrefix") : "") + (pv.text || "…") : `${a.role} · ${a.adapter}`}</div>
              </div>
              <span className="people-go"><Icon name={pv ? "chat" : "chevronRight"} size={14} /></span>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ----------------------------------------------------------------- telegram connect card */
type TgStatus = { connected: boolean; allowedName?: string; chatIdMasked?: string };

export function TelegramConnectCard({ onConnected }: { onConnected: () => void }) {
  const t = useT();
  const [bot, setBot] = useState("");
  const [chat, setChat] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [busy, startBusy] = useTransition();
  function save() {
    setErr(""); setOk("");
    startBusy(async () => {
      const r = await connectTelegram(bot, chat, name);
      if (!r.ok) { setErr(r.error ?? t("chat.tg.connectionFailed")); return; }
      setOk(t("chat.tg.botConnected", { bot: "@" + (r.username ?? "bot") }));
      setBot(""); setChat(""); setName("");
      onConnected();
    });
  }
  return (
    <div className="tg-connect scroll">
      <div className="tg-card">
        <div className="tg-card-head">
          <span className="tg-card-ico"><Icon name="send" size={18} /></span>
          <div>
            <div className="tg-card-title">{t("chat.tg.connectTitle")}</div>
            <div className="tg-card-sub">{t("chat.tg.connectSub")}</div>
          </div>
        </div>
        <ol className="tg-steps">
          <li>{t("chat.tg.step1.a")} <b>@BotFather</b> {t("chat.tg.step1.b")} → <code>/newbot</code> → {t("chat.tg.step1.c")} <b>{t("chat.tg.step1.token")}</b>.</li>
          <li>{t("chat.tg.step2.a")} <b>@userinfobot</b> → {t("chat.tg.step2.b")} <b>{t("chat.tg.step2.chatId")}</b> {t("chat.tg.step2.c")}</li>
          <li>{t("chat.tg.step3")}</li>
        </ol>
        <label className="tg-field"><span>{t("chat.tg.botToken")}</span>
          <input className="form-input" placeholder="123456789:AA…" value={bot} onChange={(e) => setBot(e.target.value)} /></label>
        <div className="tg-field-row">
          <label className="tg-field"><span>{t("chat.tg.yourChatId")}</span>
            <input className="form-input" placeholder="123456789" value={chat} onChange={(e) => setChat(e.target.value)} /></label>
          <label className="tg-field"><span>{t("chat.tg.yourName")}</span>
            <input className="form-input" placeholder={t("chat.tg.namePlaceholder")} value={name} onChange={(e) => setName(e.target.value)} /></label>
        </div>
        {err && <div className="tg-msg err">{err}</div>}
        {ok && <div className="tg-msg ok">{ok}</div>}
        <button className="btn-accent tg-save" disabled={busy || !bot.trim() || !chat.trim()} onClick={save}>
          {busy ? <span className="spin"><Icon name="refresh" size={13} /></span> : <Icon name="send" size={13} />} {t("chat.tg.connectBot")}
        </button>
        <div className="tg-note"><Icon name="bot" size={12} /> {t("chat.tg.isolatedNote")}</div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- dock */
export function ChatDock({ agents, operator }: { agents: Agent[]; operator?: { name: string; image?: string | null } }) {
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState<"right" | "left">("right");
  const [width, setWidth] = useState(380);
  const [view, setView] = useState<string>("room");
  const [roomFilter, setRoomFilter] = useState<string>("all"); // team-room: all · role:X · @handle · type:work · type:chat
  const [roomQ, setRoomQ] = useState(""); // team-room: free-text history search
  const t = useT();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [events, setEvents] = useState<Ev[]>([]);
  const [typing, setTyping] = useState<string[]>([]);
  const [sendBusy, setSendBusy] = useState(false);
  const runTokens = useRef<Record<string, string>>({}); // handle -> in-flight run token, for the Stop button
  const [cancelledRunIds, setCancelledRunIds] = useState<Set<string>>(() => new Set());
  const sendSeq = useRef(0);
  const activeSendSeq = useRef<number | null>(null);
  const stoppedSends = useRef<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [ctx, setCtx] = useState<ContextStat | null>(null);
  const [compacting, setCompacting] = useState(false);
  const [notifs, setNotifs] = useState<ChatNotif[]>([]);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [notifOpen, setNotifOpen] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [previews, setPreviews] = useState<Record<string, Preview>>({});
  const [seed, setSeed] = useState("");
  const [seedKey, setSeedKey] = useState(0);
  const [sessions, setSessions] = useState<{ id: string; title: string; active: boolean; createdAt: number }[]>([]);
  const [confirmDlg, setConfirmDlg] = useState<{ title: string; body: string; confirmLabel: string; onConfirm: () => void } | null>(null);
  const [reloadKey, setReloadKey] = useState(0); // bump to force a channel history reload (session switch)
  const [refs, setRefs] = useState<Ref[]>([]); // live goals/specs/issues for in-room #-references
  const [, start] = useTransition();
  const evSeq = useRef(0);        // last event.seq seen (event cursor)
  const msgCursor = useRef(0);    // last message.createdAt epoch ms seen
  const esRef = useRef<EventSource | null>(null);
  const cacheRef = useRef<Record<string, { msgs: Msg[]; events: Ev[]; evSeq: number; msgCursor: number }>>({});
  const cacheOrder = useRef<string[]>([]);
  const [tg, setTg] = useState<TgStatus | null>(null);
  const byHandle = Object.fromEntries(agents.map((a) => [a.handle, a]));
  // The frontend/design agent (Grace) — her DM IS the Design module's chat: it rides the "design" channel
  // and each send builds/updates the canvas via askDesign (same thread the Design page shows). Matches
  // frontendAgent() in server/design/actions.ts.
  const designHandle = agents.find((a) => a.handle === "grace")?.handle
    ?? agents.find((a) => /front\s?end|\bui\b|\bux\b/i.test(a.role))?.handle ?? null;
  const [graceSeed, setGraceSeed] = useState<GraceSeed>(null); // canvas element/prompt forwarded into Grace's DM chat
  const inDm = view.startsWith("dm:");
  // Load the live #-reference targets (goals/specs/issues) once the dock is opened.
  useEffect(() => { if (open && !refs.length) listChatRefs().then(setRefs).catch(() => {}); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const inPeople = view === "people";
  const inTg = view === "telegram";
  const dmH = inDm ? view.slice(3) : null;
  const dmAgent = dmH ? byHandle[dmH] : null;
  const isDesignDm = inDm && !!designHandle && dmH === designHandle;
  const channel = isDesignDm ? "design" : inDm ? view : inTg ? "telegram" : "room";

  // toggle + persisted UI state (same localStorage keys as the mock)
  useEffect(() => {
    function toggle() { setOpen((o) => !o); }
    function openChat(e: Event) {
      setOpen(true);
      const ch = (e as CustomEvent).detail?.channel as string | undefined;
      if (ch === "room" || ch === "telegram" || (ch && ch.startsWith("dm:"))) setView(ch);
    }
    window.addEventListener("constella:toggle-chat", toggle);
    window.addEventListener("constella:open-chat", openChat as EventListener);
    return () => {
      window.removeEventListener("constella:toggle-chat", toggle);
      window.removeEventListener("constella:open-chat", openChat as EventListener);
    };
  }, []);
  useEffect(() => {
    try {
      if (localStorage.getItem("bx.chatOpen") === "1") setOpen(true);
      const s = localStorage.getItem("bx.chatSide"); if (s === "left" || s === "right") setSide(s);
      const w = Number(localStorage.getItem("bx.chatWidth")); if (w >= 320 && w <= 640) setWidth(w);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => { try { localStorage.setItem("bx.chatOpen", open ? "1" : "0"); } catch { /* ignore */ } }, [open]);
  useEffect(() => { try { localStorage.setItem("bx.chatSide", side); } catch { /* ignore */ } }, [side]);
  useEffect(() => { try { localStorage.setItem("bx.chatWidth", String(width)); } catch { /* ignore */ } }, [width]);

  useEffect(() => {
    function openDm(e: Event) {
      const d = (e as CustomEvent).detail as { handle?: string; text?: string } | undefined;
      if (!d?.handle) return;
      setOpen(true); setView("dm:" + d.handle);
      if (d.text) { setSeed(d.text); setSeedKey((k) => k + 1); }
    }
    window.addEventListener("constella:open-dm", openDm as EventListener);
    return () => window.removeEventListener("constella:open-dm", openDm as EventListener);
  }, []);

  // Canvas → Grace bridge: the Design page (canvas element-select, "chat with Grace") dispatches this to
  // open Grace's DM seeded with a prompt and/or the picked element, so the DM stays the single design chat.
  useEffect(() => {
    function openGrace(e: Event) {
      const d = (e as CustomEvent).detail as { text?: string; selection?: CanvasSelection } | undefined;
      if (!designHandle) return;
      setOpen(true); setView("dm:" + designHandle);
      setGraceSeed({ text: d?.text, selection: d?.selection });
    }
    window.addEventListener("constella:open-grace", openGrace as EventListener);
    return () => window.removeEventListener("constella:open-grace", openGrace as EventListener);
  }, [designHandle]);

  // Real-time: load the channel's history once, then keep a SINGLE SSE connection open that tails
  // the server (DB) for new messages + work-events. Visibility-gated: a hidden tab holds no connection.
  useEffect(() => {
    if (!open || inPeople) return;
    let cancelled = false;
    const chan = channel; // pin the channel for this effect (cache writes use the right key)
    const CAP = 250;      // max events/msgs kept per channel (state + cache)
    const empty = () => ({ msgs: [], events: [], evSeq: 0, msgCursor: 0 });
    const cap = <T,>(a: T[]): T[] => (a.length > CAP ? a.slice(-CAP) : a);
    cacheOrder.current = [...cacheOrder.current.filter((c) => c !== chan), chan];
    while (cacheOrder.current.length > 6) { const ev = cacheOrder.current.shift(); if (ev && ev !== chan) delete cacheRef.current[ev]; }

    const cached = cacheRef.current[chan];
    if (cached) {
      setMsgs(cached.msgs); setEvents(cached.events);
      evSeq.current = cached.evSeq; msgCursor.current = cached.msgCursor;
      setLoading(false);
    } else {
      setMsgs([]); setEvents([]); evSeq.current = 0; msgCursor.current = 0; setLoading(true);
    }

    async function loadHistory() {
      const [m, e] = await Promise.all([getMessages(chan), getEvents(chan, 0)]);
      if (cancelled) return;
      const ms = m as Msg[], evs = e as Ev[];
      setMsgs(ms); setEvents(evs);
      evSeq.current = evs.reduce((mx, r) => Math.max(mx, r.seq), 0);
      msgCursor.current = ms.reduce((mx, r) => Math.max(mx, r.createdAt ? new Date(r.createdAt).getTime() : 0), 0);
      cacheRef.current[chan] = { msgs: ms, events: evs, evSeq: evSeq.current, msgCursor: msgCursor.current };
    }
    function connect() {
      if (cancelled || document.hidden || esRef.current) return;
      const es = new EventSource(`/api/stream?channel=${encodeURIComponent(chan)}&evCursor=${evSeq.current}&msgCursor=${msgCursor.current}`);
      esRef.current = es;
      es.addEventListener("ev", (e) => {
        const row = JSON.parse((e as MessageEvent).data) as Ev;
        if (row.seq > evSeq.current) evSeq.current = row.seq;
        setEvents((cur) => (cur.some((x) => x.id === row.id) ? cur : cap([...cur, row])));
        const c = cacheRef.current[chan] ?? empty();
        if (!c.events.some((x) => x.id === row.id)) cacheRef.current[chan] = { ...c, events: cap([...c.events, row]), evSeq: evSeq.current };
      });
      es.addEventListener("msg", (e) => {
        const row = JSON.parse((e as MessageEvent).data) as Msg;
        const tm = row.createdAt ? new Date(row.createdAt).getTime() : 0;
        if (tm > msgCursor.current) msgCursor.current = tm;
        // /clear wiped the conversation server-side — SSE only appends, so drop the stale local history
        // and keep just this confirmation (else the deleted messages linger until a reload).
        if (row.kind === "cleared") {
          setMsgs([row]); setEvents([]); setTyping([]); setCancelledRunIds(new Set());
          cacheRef.current[chan] = { ...empty(), msgs: [row], msgCursor: msgCursor.current, evSeq: evSeq.current };
          return;
        }
        setMsgs((cur) => (cur.some((x) => x.id === row.id) ? cur : cap([...cur, row])));
        setEvents((cur) => cur.filter((x) => !(x.runId === row.id && x.kind === "text")));
        setCancelledRunIds((cur) => {
          if (!cur.has(row.id)) return cur;
          const next = new Set(cur);
          next.delete(row.id);
          return next;
        });
        const c = cacheRef.current[chan] ?? empty();
        cacheRef.current[chan] = {
          ...c,
          msgs: c.msgs.some((x) => x.id === row.id) ? c.msgs : cap([...c.msgs, row]),
          events: c.events.filter((x) => !(x.runId === row.id && x.kind === "text")),
          msgCursor: msgCursor.current,
        };
      });
    }
    function disconnect() { if (esRef.current) { esRef.current.close(); esRef.current = null; } }

    if (cached) { if (!document.hidden) connect(); }
    else loadHistory().catch(() => {}).finally(() => { if (cancelled) return; setLoading(false); if (!document.hidden) connect(); });
    const onVis = () => { if (document.hidden) disconnect(); else connect(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { cancelled = true; document.removeEventListener("visibilitychange", onVis); disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, view, reloadKey]);

  // DM sessions: load the session list when a DM is open; switching/creating reloads the message stream.
  useEffect(() => { if (open && inDm) listSessions(channel).then(setSessions).catch(() => {}); else setSessions([]); /* eslint-disable-next-line */ }, [open, view, reloadKey]);
  function reloadActiveChannel() { delete cacheRef.current[channel]; setReloadKey((k) => k + 1); }
  function onNewSession() { start(async () => { await createSession(channel).catch(() => {}); reloadActiveChannel(); }); }
  function onSwitchSession(id: string) { if (sessions.find((s) => s.id === id)?.active) return; start(async () => { await switchSession(channel, id).catch(() => {}); reloadActiveChannel(); }); }
  function onRenameSession(id: string, current: string) { const tt = prompt(t("chat.dock.renameSession"), current); if (tt == null) return; start(async () => { await renameSession(id, tt).catch(() => {}); listSessions(channel).then(setSessions).catch(() => {}); }); }
  function onDeleteSession(id: string, title: string) {
    setConfirmDlg({
      title: t("chat.dock.deleteSessionTitle"), body: t("chat.dock.deleteSessionBody", { title }), confirmLabel: t("common.delete"),
      onConfirm: () => start(async () => { await deleteSession(channel, id).catch(() => {}); reloadActiveChannel(); listSessions(channel).then(setSessions).catch(() => {}); }),
    });
  }

  const loadPreviews = () => getDmPreviews().then((p) => setPreviews(p as Record<string, Preview>));
  useEffect(() => { if (open) loadPreviews(); /* eslint-disable-next-line */ }, [open, view]);

  const loadTg = () => telegramStatus().then((s) => setTg(s)).catch(() => setTg({ connected: false }));
  useEffect(() => { if (open && inTg) loadTg(); /* eslint-disable-next-line */ }, [open, view]);

  const loadCtx = async () => {
    if (inPeople) return;
    try {
      let stat = await conversationContext(channel);
      if (stat.used >= stat.max && !compacting) { // 100% → auto-compact, then re-read
        setCompacting(true);
        try { await compactConversation(channel); stat = await conversationContext(channel); } finally { setCompacting(false); }
      }
      setCtx(stat);
    } catch { /* ignore */ }
  };
  useEffect(() => { if (open && !inPeople) loadCtx(); else if (inPeople) setCtx(null); /* eslint-disable-next-line */ }, [open, view, msgs.length]);

  async function onCompact() {
    if (compacting) return;
    setCompacting(true);
    try { await compactConversation(channel); await loadCtx(); } finally { setCompacting(false); }
  }

  // Wipe the current conversation (destructive — confirm via a styled modal first).
  function onClear() {
    setConfirmDlg({
      title: t("chat.dock.clearTitle"),
      body: t("chat.dock.clearBody"),
      confirmLabel: t("common.clear"),
      onConfirm: () => start(async () => {
        await clearConversation(channel).catch(() => {});
        setMsgs([]); setEvents([]); setTyping([]); setCancelledRunIds(new Set());
        delete cacheRef.current[channel];
        evSeq.current = 0; msgCursor.current = 0;
        await loadCtx();
        if (inDm) await loadPreviews();
      }),
    });
  }

  const loadNotifs = async () => {
    try { const [n, u] = await Promise.all([getChatNotifications(), getUnreadCounts()]); setNotifs(n); setUnread(u); } catch { /* ignore */ }
  };
  useEffect(() => { if (open) loadNotifs(); /* eslint-disable-next-line */ }, [open, view, msgs.length]);
  useEffect(() => { if (open && !inPeople) { markChannelRead(channel).then(loadNotifs).catch(() => {}); } /* eslint-disable-next-line */ }, [open, view, msgs.length]);

  async function jumpToNotif(n: ChatNotif) {
    setNotifOpen(false);
    if (n.channel) setView(n.channel.startsWith("dm:") ? n.channel : "room");
    if (n.messageId) { setHighlightId(n.messageId); setTimeout(() => setHighlightId(null), 2600); }
    try { await markNotifRead(n.id); } catch { /* ignore */ }
    loadNotifs();
  }

  function startResize(e: React.MouseEvent) {
    e.preventDefault();
    const startX = e.clientX, startW = width;
    function move(ev: MouseEvent) {
      const dx = ev.clientX - startX;
      const w = side === "right" ? startW - dx : startW + dx;
      setWidth(Math.max(320, Math.min(640, w)));
    }
    function up() { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); document.body.style.cursor = ""; }
    document.body.style.cursor = "col-resize";
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
  }

  function doSend(text: string, attachments?: Attachment[]) {
    const seq = ++sendSeq.current;
    activeSendSeq.current = seq;
    stoppedSends.current.delete(seq);
    setSendBusy(true);
    start(async () => {
      let tokensByHandle: Record<string, string> = {};
      try {
        const { responders } = await sendMessage(channel, text, attachments);
        if (stoppedSends.current.has(seq)) return;
        if (responders.length) {
          tokensByHandle = Object.fromEntries(responders.map((h) => [h, newRunToken()]));
          runTokens.current = { ...runTokens.current, ...tokensByHandle };
          setTyping(responders);
          for (const h of responders) {
            const token = tokensByHandle[h];
            if (stoppedSends.current.has(seq)) { void cancelRunClient(token); break; }
            await agentRespond(channel, h, token);
            if (runTokens.current[h] === token) delete runTokens.current[h];
            setTyping((cur) => cur.filter((x) => x !== h));
            if (stoppedSends.current.has(seq)) break;
          }
          if (!stoppedSends.current.has(seq)) setTyping([]);
        }
        if (inDm) await loadPreviews();
      } catch (e) { console.error("[chat] send/reply failed:", e); /* the SSE stream surfaces server-side failures; log client-side ones so they're never silent */ }
      finally {
        for (const [h, token] of Object.entries(tokensByHandle)) {
          if (runTokens.current[h] === token) delete runTokens.current[h];
        }
        stoppedSends.current.delete(seq);
        if (activeSendSeq.current === seq) activeSendSeq.current = null;
        setSendBusy(false);
      }
    });
  }
  function stopAll() {
    if (activeSendSeq.current != null) stoppedSends.current.add(activeSendSeq.current);
    const tokens = Object.values(runTokens.current);
    if (tokens.length) {
      const tokenSet = new Set(tokens);
      setCancelledRunIds((cur) => {
        const next = new Set(cur);
        for (const token of tokens) next.add(token);
        return next;
      });
      setEvents((cur) => cur.filter((e) => !tokenSet.has(e.runId)));
      const cachedChan = cacheRef.current[channel];
      if (cachedChan) cacheRef.current[channel] = { ...cachedChan, events: cachedChan.events.filter((e) => !tokenSet.has(e.runId)) };
    }
    runTokens.current = {};
    setTyping([]);
    setSendBusy(false);
    for (const token of tokens) void cancelRunClient(token);
  }

  if (!open) return <button className="chat-fab" style={{ display: "grid", placeItems: "center" }} onClick={() => setOpen(true)} title={t("chrome.chat.agentRoom")}><Icon name="chat" size={20} /></button>;

  const byRun: Record<string, Ev[]> = {};
  for (const e of events) (byRun[e.runId] ??= []).push(e);
  const msgIds = new Set(msgs.map((m) => m.id));
  const liveRuns = Object.entries(byRun).filter(([rid]) => !msgIds.has(rid) && !cancelledRunIds.has(rid));
  const activeDmCount = Object.keys(previews).length;
  const roomUnread = unread["room"] ?? 0;
  const dmUnread = Object.entries(unread).reduce((s, [ch, n]) => (ch.startsWith("dm:") ? s + n : s), 0);
  const tgUnread = unread["telegram"] ?? 0;

  return (
    <div className={"chat-dock " + side} style={{ width }}>
      <div className={"dock-resizer " + side} onMouseDown={startResize} />

      <div className="dock-toolbar">
        <span className="dock-toolbar-title"><Icon name="agents" size={15} style={{ color: "var(--accent)" }} /> {t("chat.dock.agents")}</span>
        <div className="dock-tools">
          <div className="dock-bell-wrap">
            <button className="dock-tool" title={t("top.notifications")} onClick={() => setNotifOpen((o) => !o)}>
              <Icon name="bell" size={15} />
              {notifs.length > 0 && <span className="dock-bell-badge">{notifs.length}</span>}
            </button>
            {notifOpen && (
              <div className="dock-notif-pop">
                <div className="dock-notif-head">{t("top.notifications")} {notifs.length > 0 && <span>({notifs.length})</span>}</div>
                {notifs.length === 0 && <div className="dock-notif-empty">{t("chat.dock.nothingNeedsYou")}</div>}
                {notifs.map((n) => (
                  <button key={n.id} className={"dock-notif-row" + (n.kind === "approval" ? " approval" : "")} onClick={() => jumpToNotif(n)}>
                    <span className="dn-ico"><Icon name={n.kind === "approval" ? "check" : "at"} size={13} /></span>
                    <span className="dn-body">
                      <span className="dn-text">{n.text}</span>
                      {n.detail && <span className="dn-detail">{n.detail}</span>}
                    </span>
                    <span className="dn-go"><Icon name="chevronRight" size={12} /></span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className="dock-tool" title={side === "right" ? t("chat.dock.moveLeft") : t("chat.dock.moveRight")} onClick={() => setSide((s) => (s === "right" ? "left" : "right"))}>
            <Icon name={side === "right" ? "dockLeft" : "dockRight"} size={15} />
          </button>
          <button className="dock-tool" title={t("chat.dock.hide")} onClick={() => setOpen(false)}><Icon name="close" size={15} /></button>
        </div>
      </div>

      <div className="dock-tabs">
        <button className={"dock-tab" + (!inDm && !inPeople && !inTg ? " on" : "")} onClick={() => setView("room")}>
          <Icon name="agents" size={14} /> {t("chat.dock.tabRoom")}
          {roomUnread > 0 && <span className="dt-badge">{roomUnread}</span>}
        </button>
        <button className={"dock-tab" + (inPeople || inDm ? " on" : "")} onClick={() => setView("people")}>
          <Icon name="chat" size={14} /> {t("chat.dock.tabDirect")}
          {(dmUnread || activeDmCount) > 0 && <span className="dt-badge">{dmUnread || activeDmCount}</span>}
        </button>
        <button className={"dock-tab" + (inTg ? " on" : "")} onClick={() => setView("telegram")}>
          <Icon name="send" size={14} /> Telegram
          {tgUnread > 0 && <span className="dt-badge">{tgUnread}</span>}
        </button>
      </div>

      {!inPeople && !(inTg && tg && !tg.connected) && (
        <div className="ctx-bar">
          {ctx ? <ContextDonut stat={ctx} onCompact={onCompact} compacting={compacting} /> : <span />}
          {inTg
            ? <span className="ctx-hint" title={t("chat.dock.tgIsolatedTip")}><Icon name="bot" size={12} /> {t("chat.dock.isolatedThreadAda")}</span>
            : <span className="ctx-hint" title={t("chat.dock.dmAdaTip")}><Icon name="bot" size={12} /> {t("home.chat.dmAda")}</span>}
        </div>
      )}

      {inDm && dmAgent ? (
        <>
          <div className="dm-back-row">
            <button className="dm-back-btn" onClick={() => setView("people")}><Icon name="chevronLeft" size={14} /> {t("chat.dock.allAgents")}</button>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap", justifyContent: "flex-end" }}>
              {sessions.map((s) => (
                <span key={s.id} className="sess-pill">
                  <button className={"sess-tab" + (s.active ? " active" : "")} title={s.active ? t("chat.dock.sessActiveTip") : t("chat.dock.sessSwitchTip")}
                    onClick={() => onSwitchSession(s.id)} onDoubleClick={() => onRenameSession(s.id, s.title)}>{s.title}</button>
                  {sessions.length > 1 && <button className="sess-del" title={t("chat.dock.sessDelete")} onClick={() => onDeleteSession(s.id, s.title)}><Icon name="close" size={11} /></button>}
                </span>
              ))}
              <button className="sess-new" title={t("chat.dock.sessNewTip")} onClick={onNewSession}><Icon name="add" size={12} /> {t("chat.dock.sessNew")}</button>
            </div>
          </div>
          <div className="chat-header dm">
            <Avatar name={dmAgent.name} color={dmAgent.color} image={dmAgent.image} size={34} health={dmAgent.health} />
            <div>
              <div className="chat-title">{dmAgent.name} <span className="agent-handle">@{dmAgent.handle}</span></div>
              <div className="chat-sub">{dmAgent.role} · {dmAgent.adapter}</div>
            </div>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
              <StatusPill status={dmAgent.status} />
              <button className="dock-tool" title={t("chat.dock.clearConversation")} onClick={onClear}><Icon name="trash" size={15} /></button>
            </div>
          </div>
          {isDesignDm ? (
            <DesignChat grace={{ id: dmAgent.id, name: dmAgent.name, handle: dmAgent.handle, color: dmAgent.color, image: dmAgent.image }} seed={graceSeed} onSeedConsumed={() => setGraceSeed(null)} operator={operator} />
          ) : (
            <>
              <div className="dm-context-note">
                <span className="ico"><Icon name="bot" size={14} /></span>
                {t("chat.dock.dmContextNote", { name: dmAgent.name })}
              </div>
              <ChatStream msgs={msgs} typing={typing} agents={agents} byRun={byRun} liveRuns={liveRuns} loading={loading} highlightId={highlightId} operator={operator} markdownAgent />
              <ChatComposer key={"dm:" + dmH + ":" + seedKey} onSend={doSend} agents={agents} defaultText={seed} placeholder={t("chat.dock.messageAgent", { name: dmAgent.name })} busy={sendBusy || typing.length > 0} onStop={stopAll} />
            </>
          )}
        </>
      ) : inPeople ? (
        <PeopleList agents={agents} previews={previews} onOpenDM={(h) => { setView("dm:" + h); }} />
      ) : inTg ? (
        <>
          <div className="chat-header room">
            <div className="brand-ico" style={{ background: "linear-gradient(150deg,#2aabee,#229ed9)", color: "#fff" }}><Icon name="send" size={16} /></div>
            <div>
              <div className="chat-title">Telegram</div>
              <div className="chat-sub">{tg?.connected ? t("chat.tg.connectedSub", { name: tg.allowedName || t("chat.tg.you"), chatId: tg.chatIdMasked ?? "" }) : t("chat.tg.connectPrompt")}</div>
            </div>
            {tg?.connected && (
              <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                <button className="dock-tool" title={t("chat.dock.clearConversation")} onClick={onClear}><Icon name="trash" size={15} /></button>
                <button className="dock-tool" title={t("chat.tg.disconnect")}
                  onClick={() => { if (confirm(t("chat.tg.disconnectConfirm"))) start(async () => { await disconnectTelegram(); loadTg(); }); }}>
                  <Icon name="close" size={15} />
                </button>
              </div>
            )}
          </div>
          {tg && !tg.connected ? (
            <TelegramConnectCard onConnected={loadTg} />
          ) : (
            <>
              <div className="dm-context-note">
                <span className="ico"><Icon name="send" size={14} /></span>
                {t("chat.tg.isolatedThreadNote")}
              </div>
              <ChatStream msgs={msgs} typing={typing} agents={agents} byRun={byRun} liveRuns={liveRuns} loading={loading || !tg} highlightId={highlightId} operator={operator} markdownAgent />
              <ChatComposer key={"telegram:" + seedKey} onSend={doSend} agents={agents} placeholder={t("chat.tg.composerPlaceholder")} busy={sendBusy || typing.length > 0} onStop={stopAll} />
            </>
          )}
        </>
      ) : (
        <>
          <div className="chat-header room">
            <div>
              <div className="chat-title">{t("chat.dock.teamChannel")}</div>
              <div className="chat-sub">{t("chat.dock.teamChannelSub", { n: agents.length })}</div>
            </div>
            <div className="chat-members">
              {agents.slice(0, 6).map((a) => (
                <button key={a.handle} className="member-btn" title={t("chat.dock.dmName", { name: a.name })} onClick={() => { setView("dm:" + a.handle); }}>
                  <Avatar name={a.name} color={a.color} size={26} />
                </button>
              ))}
              {agents.length > 6 && <button className="more" title={t("chat.dock.allAgents")} onClick={() => setView("people")}>+{agents.length - 6}</button>}
            </div>
          </div>
          {(() => {
            const distinctRoles = Array.from(new Set(agents.map((a) => a.role))).sort();
            const base = roomFilter === "all"
              ? msgs
              : roomFilter === "type:work"
                ? msgs.filter((m) => (byRun[m.id]?.length ?? 0) > 0 || !!m.kind)
                : roomFilter === "type:chat"
                  ? msgs.filter((m) => !(byRun[m.id]?.length) && !m.kind)
                  : roomFilter.startsWith("role:")
                    ? msgs.filter((m) => m.fromKind === "operator" || (m.fromHandle && byHandle[m.fromHandle]?.role === roomFilter.slice(5)))
                    : msgs.filter((m) => m.fromKind === "operator" || m.fromHandle === roomFilter);
            const q = roomQ.trim().toLowerCase();
            const filteredMsgs = q ? base.filter((m) => (m.text ?? "").toLowerCase().includes(q)) : base;
            return (
              <>
                <div className="room-filter">
                  <span className="rf-label">{t("chat.filter")}</span>
                  <button type="button" className={"rf-chip" + (roomFilter === "all" ? " on" : "")} onClick={() => setRoomFilter("all")}>{t("common.all")}</button>
                  <button type="button" className={"rf-chip rf-lane" + (roomFilter === "type:work" ? " on" : "")} title={t("chat.filter.work")} onClick={() => setRoomFilter(roomFilter === "type:work" ? "all" : "type:work")}>{t("chat.filter.work")}</button>
                  <button type="button" className={"rf-chip rf-lane" + (roomFilter === "type:chat" ? " on" : "")} title={t("chat.filter.discussion")} onClick={() => setRoomFilter(roomFilter === "type:chat" ? "all" : "type:chat")}>{t("chat.filter.discussion")}</button>
                  {distinctRoles.map((role) => (
                    <button key={"role:" + role} type="button" className={"rf-chip rf-role" + (roomFilter === "role:" + role ? " on" : "")} title={t("chat.filter.byRole")} onClick={() => setRoomFilter(roomFilter === "role:" + role ? "all" : "role:" + role)}>{role}</button>
                  ))}
                  {agents.map((a) => (
                    <button key={a.handle} type="button" className={"rf-chip" + (roomFilter === a.handle ? " on" : "")} title={a.name} onClick={() => setRoomFilter(roomFilter === a.handle ? "all" : a.handle)}>@{a.handle}</button>
                  ))}
                  <span className="rf-search">
                    <Icon name="search" size={12} />
                    <input value={roomQ} onChange={(e) => setRoomQ(e.target.value)} placeholder={t("chat.filter.search")} aria-label={t("chat.filter.search")} />
                    {roomQ && <button type="button" className="rf-clear" onClick={() => setRoomQ("")} aria-label={t("common.dismiss")}><Icon name="close" size={11} /></button>}
                  </span>
                </div>
                <ChatStream msgs={filteredMsgs} typing={typing} agents={agents} byRun={byRun} liveRuns={liveRuns} loading={loading} highlightId={highlightId} operator={operator} markdownAgent refs={refs} />
              </>
            );
          })()}
          <ChatComposer key={"room:" + seedKey} onSend={doSend} agents={agents} defaultText={view === "room" ? seed : ""} requireMention placeholder={t("chat.dock.roomPlaceholder")} refs={refs} busy={sendBusy || typing.length > 0} onStop={stopAll} />
        </>
      )}
      {confirmDlg && (
        <div className="modal-overlay" onMouseDown={() => setConfirmDlg(null)}>
          <div className="modal" style={{ width: 380 }} onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head"><div className="modal-title"><Icon name="trash" size={15} style={{ color: "var(--sx-keyword)" }} /> {confirmDlg.title}</div></div>
            <div className="modal-body"><div style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.55 }}>{confirmDlg.body}</div></div>
            <div className="modal-foot">
              <button className="btn-ghost" onClick={() => setConfirmDlg(null)}>{t("common.cancel")}</button>
              <button className="btn-accent" style={{ background: "var(--sx-keyword)", borderColor: "var(--sx-keyword)", color: "#fff" }} onClick={() => { confirmDlg.onConfirm(); setConfirmDlg(null); }}>{confirmDlg.confirmLabel}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
