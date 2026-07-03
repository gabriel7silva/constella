"use client";

/* Phase 2 + 3b of the Design roadmap — the "Live app" canvas. Instead of rendering Grace's self-contained HTML
   (the design-mock canvas), this points an iframe at the PROJECT's REAL running dev server, so a React / Vue /
   Svelte / Next / static app renders truthfully (it's the actual app). Reuses the dev-server actions + frameable
   probe Test Dev ships.

   Phase 3b — "Inspect": a toggle routes the iframe through the inspect PROXY (server/design/live-inspect-proxy),
   which injects a click-capture instrument (lib/design/live-instrument) into the real app's HTML. Clicking an
   element captures its context (tag/text/selector/route) and pre-fills "Ask Grace to change THIS element" — she
   edits the real source, the dev server HMR repaints. (Approach B, any stack. The precise file:line build-time
   stamp is Approach A, deferred.) With Inspect off the iframe points at the raw dev URL and the app behaves as
   itself. */

import { useState, useEffect, useRef, useTransition, type FormEvent, type CSSProperties } from "react";
import { Icon } from "@/components/ui/icon";
import { startDevServerAction, devServerStatusAction, previewFrameableAction, startLiveInspectAction, stopLiveInspectAction } from "@/server/actions/test-dev-actions";

type LogLine = { c: "out" | "err" | "info"; t: string };
type Status = { running: boolean; status: string; port?: number; url?: string; project?: string; logs: LogLine[] };
type Viewport = "desktop" | "tablet" | "mobile";
type LiveSel = { tag: string; id: string; classes: string; text: string; selector: string; landmark: string; href: string; role: string; box: { x: number; y: number; w: number; h: number }; path: string };
const VIEWPORTS: { id: Viewport; w: string; label: string }[] = [
  { id: "desktop", w: "100%", label: "Desktop" },
  { id: "tablet", w: "768px", label: "Tablet" },
  { id: "mobile", w: "390px", label: "Mobile" },
];

/** Render the project's live dev server inside the Design module, with click-to-inspect + "Ask Grace". */
export function LiveAppCanvas({ onAskGrace, asking }: { onAskGrace: (text: string) => void; asking: boolean }) {
  const [status, setStatus] = useState<Status>({ running: false, status: "idle", logs: [] });
  const [starting, start] = useTransition();
  const [addr, setAddr] = useState("");
  const [src, setSrc] = useState("");
  const [nonce, setNonce] = useState(0);
  const [vp, setVp] = useState<Viewport>("desktop");
  const [frameable, setFrameable] = useState(true);
  const [ask, setAsk] = useState("");
  const [inspect, setInspect] = useState(false);
  const [proxyUrl, setProxyUrl] = useState("");
  const [inspBusy, inspStart] = useTransition();
  const [inspErr, setInspErr] = useState("");
  const [sel, setSel] = useState<LiveSel | null>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const base = status.url ?? "";
  const live = status.status === "running" && !!base;
  const width = VIEWPORTS.find((v) => v.id === vp)?.w ?? "100%";
  const frameSrc = (inspect && proxyUrl ? proxyUrl : src) || base;   // fall back to the server URL so the iframe never gets an empty src (React warns + re-downloads)

  // Adopt the server URL on boot; poll while starting so the frame appears as soon as it's ready. Read the
  // live status via a ref (deps []) so the interval isn't torn down + recreated (with a redundant immediate
  // refetch) on every transition, and stop it once running/error so no idle timer lingers for the canvas life.
  const statusRef = useRef(status.status);
  statusRef.current = status.status;
  useEffect(() => {
    let alive = true;
    devServerStatusAction().then((s) => { if (alive) setStatus(s as Status); }).catch(() => {});
    const id = setInterval(() => {
      if (statusRef.current === "running" || statusRef.current === "error") { clearInterval(id); return; }
      devServerStatusAction().then((s) => { if (alive) setStatus(s as Status); }).catch(() => {});
    }, 3000);
    return () => { alive = false; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (base) { setAddr((a) => a || base); setSrc((s) => s || base); }
    else { setAddr(""); setSrc(""); }
  }, [base]);

  // Probe whether the running app allows being framed (X-Frame-Options / CSP frame-ancestors).
  useEffect(() => {
    if (!live || !src) { setFrameable(true); return; }
    let alive = true;
    previewFrameableAction(src).then((r) => { if (alive) setFrameable(r.frameable); }).catch(() => {});
    return () => { alive = false; };
  }, [live, src, nonce]);

  // Listen for the injected instrument: it reports the clicked element (live:select) and asks for the mode on
  // load (live:ready). Push the current mode into the frame so a reload re-syncs.
  useEffect(() => {
    function sendMode() { try { frameRef.current?.contentWindow?.postMessage({ __cstlaLiveHost: 1, type: "live:setMode", mode: inspect ? "inspect" : "off" }, "*"); } catch { /* frame not ready */ } }
    function onMsg(e: MessageEvent) {
      // Only trust messages from OUR inspect iframe — a popup/ad-frame/extension can postMessage a spoofed
      // `live:select` (the __cstlaLive tag is a constant the attacker can set) to inject text into Ask-Grace.
      if (e.source !== frameRef.current?.contentWindow) return;
      const m = e.data as { __cstlaLive?: number; type?: string; payload?: LiveSel } | undefined;
      if (!m || !m.__cstlaLive) return;
      if (m.type === "live:ready") sendMode();
      else if (m.type === "live:select" && m.payload) setSel(m.payload);
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [inspect]);

  function onStart() { start(async () => { try { const s = await startDevServerAction(); setStatus(s as Status); } catch { /* surfaced via status poll */ } }); }
  function resolve(input: string): string {
    const v = input.trim();
    if (!v) return base;
    if (/^https?:\/\//i.test(v)) return v;
    return base.replace(/\/$/, "") + (v.startsWith("/") ? v : "/" + v);
  }
  function go(e?: FormEvent) { e?.preventDefault(); const u = resolve(addr); setSrc(u); setAddr(u); setNonce((n) => n + 1); }

  function toggleInspect() {
    setInspErr("");
    if (inspect) { setInspect(false); setSel(null); setNonce((n) => n + 1); void stopLiveInspectAction().catch(() => {}); return; }
    inspStart(async () => {
      try {
        const r = await startLiveInspectAction();
        if (!r.ok || !r.url) { setInspErr(r.error || "Couldn't start inspect."); return; }
        setProxyUrl(r.url); setInspect(true); setSel(null); setNonce((n) => n + 1);
      } catch { setInspErr("Couldn't start inspect."); }
    });
  }

  function submitAsk(e?: FormEvent) {
    e?.preventDefault();
    const v = ask.trim(); if (!v || asking) return;
    if (sel) {
      const ctx = [
        `<${sel.tag}>`,
        sel.id ? `#${sel.id}` : "",
        sel.text ? `text "${sel.text}"` : "",
        sel.landmark ? `in "${sel.landmark}"` : "",
        `selector \`${sel.selector}\``,
        `on route ${sel.path}`,
      ].filter(Boolean).join(" · ");
      onAskGrace(`On the live app, change THIS element (${ctx}) — edit the real source, keep everything else intact: ${v}`);
    } else {
      onAskGrace(`On the live app: ${v}`);
    }
    setAsk(""); setSel(null);
  }

  const wrap: CSSProperties = { position: "absolute", inset: 0, zIndex: 40, display: "flex", flexDirection: "column", background: "var(--bg-app)" };

  return (
    <div style={wrap}>
      {/* browser bar */}
      <div className="dz-live-bar">
        <span className={"dz-live-dot " + (live ? "on" : status.status === "error" ? "err" : "")} />
        <button className="dz-ico" title="Reload" disabled={!live} onClick={() => setNonce((n) => n + 1)}><Icon name="refresh" size={14} /></button>
        <form className="dz-live-addr" onSubmit={go}>
          <Icon name={live ? "shield" : "goto"} size={12} />
          <input value={addr} placeholder={base || "the app isn't running yet"} disabled={!live || inspect} onChange={(e) => setAddr(e.target.value)} spellCheck={false} />
        </form>
        <button className={"dz-ico" + (inspect ? " on" : "")} title={inspect ? "Inspecting — click an element to target it (click again to turn off)" : "Inspect: click a real element to ask Grace to change it"} disabled={!live || inspBusy} onClick={toggleInspect}>
          <Icon name={inspBusy ? "refresh" : "target"} size={14} className={inspBusy ? "sync-spin" : ""} />
        </button>
        <div className="dz-seg">
          {VIEWPORTS.map((v) => <button key={v.id} className={vp === v.id ? "on" : ""} disabled={!live} onClick={() => setVp(v.id)}>{v.label}</button>)}
        </div>
        {live && <a className="dz-ico" title="Open in a new tab" href={src} target="_blank" rel="noreferrer"><Icon name="goto" size={14} /></a>}
      </div>
      {inspErr && <div className="dz-uperr" style={{ margin: "0 10px" }}>{inspErr}</div>}

      {/* stage */}
      <div className="dz-live-stage">
        {live && !frameable ? (
          <div className="dz-live-empty">
            <Icon name="shield" size={26} />
            <div className="t">The app blocks embedding</div>
            <div className="s">It sends X-Frame-Options / CSP that prevents the preview frame.</div>
            <a className="btn-accent" style={{ marginTop: 10 }} href={src} target="_blank" rel="noreferrer"><Icon name="goto" size={13} /> Open in a new tab</a>
          </div>
        ) : live ? (
          <iframe ref={frameRef} key={frameSrc + ":" + nonce} className="dz-live-frame" src={frameSrc} style={{ width, maxWidth: "100%" }} title="Live app preview"
            onLoad={() => { try { frameRef.current?.contentWindow?.postMessage({ __cstlaLiveHost: 1, type: "live:setMode", mode: inspect ? "inspect" : "off" }, "*"); } catch { /* frame not ready */ } }}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads" />
        ) : (
          <div className="dz-live-empty">
            <span className={starting || status.status === "starting" ? "sync-spin" : ""}><Icon name={starting || status.status === "starting" ? "refresh" : "play"} size={26} /></span>
            <div className="t">{status.status === "error" ? "The dev server failed to start" : starting || status.status === "starting" ? "Starting the dev server…" : "Run the real app"}</div>
            <div className="s">{status.status === "error" ? "Check the project boots (Test Dev shows the logs)." : "Boot the project's dev server to see the real running app here — any stack."}</div>
            {status.status !== "running" && status.status !== "starting" && !starting && (
              <button className="btn-accent" style={{ marginTop: 10 }} onClick={onStart}><Icon name="play" size={13} /> Start the app</button>
            )}
          </div>
        )}
      </div>

      {/* selected element (inspect) → ask Grace, pre-targeted */}
      {sel && (
        <div className="dz-attach" style={{ margin: "0 10px 6px" }}>
          <span className="sw" style={{ background: "#6366f1" }} /> Editing <b style={{ fontWeight: 700 }}>&lt;{sel.tag}&gt;{sel.id ? " #" + sel.id : ""}</b>{sel.text ? ` · “${sel.text.slice(0, 40)}”` : ""}
          <span className="x" onClick={() => setSel(null)}><Icon name="close" size={12} /></span>
        </div>
      )}

      {/* ask Grace — she edits the real source, the dev server hot-reloads */}
      <form className="dz-live-ask" onSubmit={submitAsk}>
        <Icon name="skill" size={14} />
        <input value={ask} placeholder={sel ? "Describe the change to this element — Grace edits the real source…" : "Ask Grace to change the live app — she edits the real source (HMR repaints it)…"} onChange={(e) => setAsk(e.target.value)} disabled={asking} />
        <button className="dz-mini-btn accent" disabled={asking || !ask.trim()} type="submit"><Icon name={asking ? "refresh" : "send"} size={13} className={asking ? "sync-spin" : ""} /> Ask Grace</button>
      </form>
    </div>
  );
}
