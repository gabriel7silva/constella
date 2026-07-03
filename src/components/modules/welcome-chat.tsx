"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { sendMessage, agentRespond, getMessages, getDmPreviews, clearConversation } from "@/server/chat";
import { getEvents } from "@/server/events";
import { telegramStatus } from "@/server/actions/profile-actions";
import { conversationContext, compactConversation, type ContextStat } from "@/server/actions/context-actions";
import { useT } from "@/lib/i18n-context";
import { cancelRunClient } from "@/lib/run-client";
import { Icon } from "@/components/ui/icon";
import { Avatar } from "@/components/ui/avatar";
import { ContextDonut } from "@/components/shell/context-donut";
import { PeopleList, TelegramConnectCard } from "@/components/shell/chat-dock";
import { ChatStream, ChatComposer, StatusPill, type Agent, type Msg, type Ev, type Attachment } from "@/components/chat/parts";

type Preview = { text: string; mine: boolean };
type TgStatus = { connected: boolean; allowedName?: string; chatIdMasked?: string };

// The Welcome Home's central chat — a full inline chat (the floating dock is hidden on `/`). Same
// ChatStream/ChatComposer as the dock, plus Team Room / Direct / Telegram tabs, the context donut +
// compact, and per-channel live SSE. The room thread is shared with the dock, so context is preserved.
export function WelcomeChat({ agents, operator }: { agents: Agent[]; operator: { name: string; image?: string | null } }) {
  const t = useT();
  const router = useRouter();
  const [view, setView] = useState("room"); // room | people | telegram | dm:<handle>
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [events, setEvents] = useState<Ev[]>([]);
  const [typing, setTyping] = useState<string[]>([]);
  const [sendBusy, setSendBusy] = useState(false);
  const runTokens = useRef<Record<string, string>>({}); // handle -> in-flight run token, for the Stop button
  const [cancelledRunIds, setCancelledRunIds] = useState<Set<string>>(() => new Set());
  const sendSeq = useRef(0);
  const activeSendSeq = useRef<number | null>(null);
  const stoppedSends = useRef<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [full, setFull] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [ctx, setCtx] = useState<ContextStat | null>(null);
  const [compacting, setCompacting] = useState(false);
  const [previews, setPreviews] = useState<Record<string, Preview>>({});
  const [tg, setTg] = useState<TgStatus | null>(null);
  const [pending, start] = useTransition();
  const msgCursor = useRef(0);
  const evSeq = useRef(0);
  const esRef = useRef<EventSource | null>(null);
  const byHandle = Object.fromEntries(agents.map((a) => [a.handle, a]));
  const inDm = view.startsWith("dm:");
  const inPeople = view === "people";
  const inTg = view === "telegram";
  const dmH = inDm ? view.slice(3) : null;
  const dmAgent = dmH ? byHandle[dmH] : null;
  const channel = inDm ? view : inTg ? "telegram" : "room";

  // Per-channel history + a single live SSE connection (re-runs on channel switch).
  useEffect(() => {
    if (inPeople) return;
    let cancelled = false;
    const chan = channel;
    setMsgs([]); setEvents([]); msgCursor.current = 0; evSeq.current = 0; setLoading(true);
    function connect() {
      if (cancelled || document.hidden || esRef.current) return;
      const es = new EventSource(`/api/stream?channel=${encodeURIComponent(chan)}&evCursor=${evSeq.current}&msgCursor=${msgCursor.current}`);
      esRef.current = es;
      es.addEventListener("msg", (e) => {
        const row = JSON.parse((e as MessageEvent).data) as Msg;
        const tm = row.createdAt ? new Date(row.createdAt).getTime() : 0;
        if (tm > msgCursor.current) msgCursor.current = tm;
        // /clear wiped the conversation server-side — drop stale local history, keep the confirmation.
        if (row.kind === "cleared") { setMsgs([row]); setEvents([]); setTyping([]); setCancelledRunIds(new Set()); return; }
        setMsgs((cur) => (cur.some((x) => x.id === row.id) ? cur : [...cur, row].slice(-200)));
        setEvents((cur) => cur.filter((x) => !(x.runId === row.id && x.kind === "text")));
        setCancelledRunIds((cur) => {
          if (!cur.has(row.id)) return cur;
          const next = new Set(cur);
          next.delete(row.id);
          return next;
        });
        if (row.fromHandle) setTyping((cur) => cur.filter((x) => x !== row.fromHandle));
      });
      es.addEventListener("ev", (e) => {
        const row = JSON.parse((e as MessageEvent).data) as Ev;
        if (row.seq > evSeq.current) evSeq.current = row.seq;
        setEvents((cur) => (cur.some((x) => x.id === row.id) ? cur : [...cur, row].slice(-250)));
      });
    }
    function disconnect() { if (esRef.current) { esRef.current.close(); esRef.current = null; } }
    (async () => {
      try {
        const [m, e] = await Promise.all([getMessages(chan), getEvents(chan, 0)]);
        if (cancelled) return;
        const ms = m as Msg[], evs = e as Ev[];
        setMsgs(ms.slice(-200)); setEvents(evs);
        msgCursor.current = ms.reduce((mx, r) => Math.max(mx, r.createdAt ? new Date(r.createdAt).getTime() : 0), 0);
        evSeq.current = evs.reduce((mx, r) => Math.max(mx, r.seq), 0);
      } catch { /* empty thread */ }
      if (!cancelled) { setLoading(false); if (!document.hidden) connect(); }
    })();
    const onVis = () => { if (document.hidden) disconnect(); else connect(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { cancelled = true; document.removeEventListener("visibilitychange", onVis); disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // DM previews (for the Direct roster) + Telegram status + the context donut.
  useEffect(() => { getDmPreviews().then((p) => setPreviews(p as Record<string, Preview>)).catch(() => {}); }, [view]);
  useEffect(() => { if (inTg) telegramStatus().then(setTg).catch(() => setTg({ connected: false })); /* eslint-disable-next-line */ }, [view]);
  async function loadCtx() {
    try {
      let s = await conversationContext(channel);
      if (s.used >= s.max && !compacting) { setCompacting(true); try { await compactConversation(channel); s = await conversationContext(channel); } finally { setCompacting(false); } }
      setCtx(s);
    } catch { /* ignore */ }
  }
  useEffect(() => { if (!inPeople) loadCtx(); else setCtx(null); /* eslint-disable-next-line */ }, [view, msgs.length]);
  async function onCompact() { if (compacting) return; setCompacting(true); try { await compactConversation(channel); await loadCtx(); } finally { setCompacting(false); } }

  // The hero "Ask the KB" button focuses this composer.
  useEffect(() => {
    function f() { setView("room"); setTimeout(() => document.querySelector<HTMLTextAreaElement>(".welcome-chat .composer-input")?.focus(), 60); }
    window.addEventListener("constella:focus-cmdbar", f);
    return () => window.removeEventListener("constella:focus-cmdbar", f);
  }, []);

  const byRun: Record<string, Ev[]> = {};
  for (const e of events) (byRun[e.runId] ??= []).push(e);
  const msgIds = new Set(msgs.map((m) => m.id));
  const liveRuns = Object.entries(byRun).filter(([rid]) => !msgIds.has(rid) && !cancelledRunIds.has(rid));

  function doSend(text: string, attachments?: Attachment[]) {
    const v = text.trim();
    if (!v && !attachments?.length) return;
    // In the room, plain text asks the KB; /command + @mention pass through. In a DM/Telegram, send as-is.
    const toSend = channel === "room" && v && !v.startsWith("/") && !v.startsWith("@") ? "/kb " + v : v;
    const seq = ++sendSeq.current;
    activeSendSeq.current = seq;
    stoppedSends.current.delete(seq);
    setSendBusy(true);
    start(async () => {
      let tokensByHandle: Record<string, string> = {};
      try {
        const { responders } = await sendMessage(channel, toSend, attachments);
        if (stoppedSends.current.has(seq)) return;
        if (responders.length) {
          tokensByHandle = Object.fromEntries(responders.map((h) => [h, crypto.randomUUID()]));
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
        if (inDm) getDmPreviews().then((p) => setPreviews(p as Record<string, Preview>)).catch(() => {});
      } catch { /* stream surfaces failures */ }
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
    }
    runTokens.current = {};
    setTyping([]);
    setSendBusy(false);
    for (const token of tokens) void cancelRunClient(token);
  }

  function doClear() {
    setConfirmClear(false);
    start(async () => { await clearConversation(channel).catch(() => {}); setMsgs([]); setEvents([]); setTyping([]); setCancelledRunIds(new Set()); await loadCtx(); });
  }

  const composerPlaceholder = inDm && dmAgent ? `${t("home.chat.message")} ${dmAgent.name}…` : inTg ? "Telegram · @ada (CEO)…" : t("home.cmd.placeholder");

  return (
    <section className={"welcome-chat" + (full ? " full" : "")}>
      <div className="wc-head">
        <div className="wc-head-titles">
          <span className="wc-head-title"><Icon name="chat" size={15} /> {t("home.chat.title")}</span>
          <span className="wc-head-sub">{t("home.chat.sub")}</span>
        </div>
        <div className="wc-head-actions">
          <button className="wc-head-btn" title={t("home.openKnowledge")} onClick={() => router.push("/knowledge" as Route)}><Icon name="branch" size={14} /></button>
          <button className="wc-head-btn" title={t("home.chat.fullscreen")} onClick={() => setFull((f) => !f)}><Icon name={full ? "close" : "goto"} size={14} /></button>
          <button className="wc-head-btn" title={t("home.chat.clear")} onClick={() => setConfirmClear(true)}><Icon name="trash" size={14} /></button>
        </div>
      </div>

      <div className="dock-tabs">
        <button className={"dock-tab" + (!inDm && !inPeople && !inTg ? " on" : "")} onClick={() => setView("room")}><Icon name="agents" size={14} /> {t("home.chat.tab.room")}</button>
        <button className={"dock-tab" + (inPeople || inDm ? " on" : "")} onClick={() => setView("people")}><Icon name="chat" size={14} /> {t("home.chat.tab.direct")}</button>
        <button className={"dock-tab" + (inTg ? " on" : "")} onClick={() => setView("telegram")}><Icon name="send" size={14} /> Telegram</button>
      </div>

      {!inPeople && !(inTg && tg && !tg.connected) && (
        <div className="ctx-bar">
          {ctx ? <ContextDonut stat={ctx} onCompact={onCompact} compacting={compacting} /> : <span />}
          {inTg
            ? <span className="ctx-hint"><Icon name="bot" size={12} /> {t("home.chat.tgHint")} · @ada (CEO)</span>
            : <span className="ctx-hint"><Icon name="bot" size={12} /> {t("home.chat.dmAda")}</span>}
        </div>
      )}

      {inDm && dmAgent ? (
        <>
          <div className="chat-header dm">
            <button className="dm-back-btn" onClick={() => setView("people")}><Icon name="chevronLeft" size={14} /></button>
            <Avatar name={dmAgent.name} color={dmAgent.color} image={dmAgent.image} size={30} health={dmAgent.health} />
            <div>
              <div className="chat-title">{dmAgent.name} <span className="agent-handle">@{dmAgent.handle}</span></div>
              <div className="chat-sub">{dmAgent.role} · {dmAgent.adapter}</div>
            </div>
            <span style={{ marginLeft: "auto" }}><StatusPill status={dmAgent.status} /></span>
          </div>
          <ChatStream msgs={msgs} typing={typing} agents={agents} byRun={byRun} liveRuns={liveRuns} loading={loading} operator={operator} markdownAgent avatarSize={40} />
          <ChatComposer onSend={doSend} agents={agents} requireMention={false} placeholder={composerPlaceholder} busy={sendBusy || typing.length > 0} onStop={stopAll} />
        </>
      ) : inPeople ? (
        <PeopleList agents={agents} previews={previews} onOpenDM={(h) => setView("dm:" + h)} />
      ) : inTg ? (
        tg && !tg.connected
          ? <TelegramConnectCard onConnected={() => telegramStatus().then(setTg).catch(() => {})} />
          : <>
              <ChatStream msgs={msgs} typing={typing} agents={agents} byRun={byRun} liveRuns={liveRuns} loading={loading || !tg} operator={operator} markdownAgent avatarSize={40} />
              <ChatComposer onSend={doSend} agents={agents} requireMention={false} placeholder={composerPlaceholder} busy={sendBusy || typing.length > 0} onStop={stopAll} />
            </>
      ) : (
        <>
          <ChatStream msgs={msgs} typing={typing} agents={agents} byRun={byRun} liveRuns={liveRuns} loading={loading} operator={operator} markdownAgent avatarSize={40} emptyHint={t("home.chat.intro")} />
          <ChatComposer onSend={doSend} agents={agents} requireMention={false} placeholder={composerPlaceholder} busy={sendBusy || typing.length > 0} onStop={stopAll} />
        </>
      )}

      {confirmClear && (
        <div className="modal-overlay" onMouseDown={() => setConfirmClear(false)}>
          <div className="modal" style={{ width: 440, maxWidth: "92vw" }} onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head"><div className="modal-title"><Icon name="trash" size={15} style={{ color: "var(--sx-keyword)" }} /> {t("home.chat.clear")}</div></div>
            <div className="modal-body"><div style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.6 }}>{t("home.chat.clearConsequences")}</div></div>
            <div className="modal-foot">
              <button className="btn-ghost" onClick={() => setConfirmClear(false)}>{t("block.cancel")}</button>
              <button className="btn-accent" style={{ background: "var(--sx-keyword)", borderColor: "var(--sx-keyword)", color: "#fff" }} disabled={pending} onClick={doClear}>{t("home.chat.clear")}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
