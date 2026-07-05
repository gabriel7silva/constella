"use client";

/* Constella — Design module room (real, no fakes). Left: the REAL frontend agent (Grace) via askDesign +
   the live "design" event stream (persisted chat bubbles, token-by-token). Center: a chrome-less LIVE canvas
   — Grace's self-contained HTML screens render in a sandboxed iframe (sandbox="allow-scripts", isolated) and
   update progressively while she writes them; a 6-mode toolbar (Select · Edit · Markup · Comments · Inspect ·
   Preview) + zoom drive direct-manipulation via an injected instrumentation script that talks to the host
   over postMessage (the CanvasSelection contract). Right: tabbed rail — Element (the selected node) · Screens ·
   Styles · Comments · Versions — all backed by real files + the design_* tables. Approve writes the official
   reference (design-mock/APPROVED.md) + records the decision in the KB/RAG. */

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n-context";
import { Icon } from "@/components/ui/icon";
import { Avatar } from "@/components/ui/avatar";
import { ChatStream, type Msg, type Ev, type Agent } from "@/components/chat/parts";
import { getMessages } from "@/server/chat";
import { getEvents } from "@/server/events";
import { askDesign, approveDesign, setTokens, getDesignScreen, addDesignComment, addDesignMarkup, deleteDesignComment, listDesignComments, listDesignVersions, restoreDesignVersion, applyDesignTextEdit, buildDesignProduction, commitDesignScreen, saveDesignCheckpoint, restoreDesignCheckpoint, listDesignDocs, readDesignDoc, handoffToExecution, scaffoldDesignFromBrief, resumeDesignHandoff, skipDesignGate } from "@/server/design/actions";
import { cancelRunClient, newRunToken } from "@/lib/run-client";
import { generatePlan } from "@/server/planner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { instrumentScreen, type CanvasMode, type CanvasInMsg } from "@/lib/design/canvas-instrument";
import { conversationContext, compactConversation, type ContextStat } from "@/server/actions/context-actions";
import { ContextDonut } from "@/components/shell/context-donut";
import type { CanvasSelection } from "@/lib/design/selection";
import { LiveAppCanvas } from "@/components/design/live-app-canvas";

// Map a prototype nav-link href (clicked in Preview) to one of the design's own screens, by basename. Empty/"/"/
// "index"/"home" → a home-ish screen (or the first). Returns null when nothing matches (link is then inert).
function resolveScreenHref(href: string, screens: string[]): string | null {
  const clean = href.split("#")[0].split("?")[0].replace(/\/+$/, "");
  const want = (clean.split("/").pop() || clean).replace(/\.html?$/i, "").toLowerCase();
  let hit = screens.find((p) => (p.split("/").pop() || p).replace(/\.html?$/i, "").toLowerCase() === want);
  if (!hit && (want === "" || want === "index" || want === "home")) hit = screens.find((p) => /(^|\/)(index|home)\.html?$/i.test(p)) || screens[0];
  return hit || null;
}

const DZ_CSS = `
.dz-wrap{flex:1;min-height:480px;display:flex;background:var(--bg-app);position:relative;height:100%;}
.dz-chat{width:312px;flex:0 0 312px;display:flex;flex-direction:column;min-height:0;border-right:1px solid var(--border-subtle);background:var(--bg-panel);}
.dz-chat-head{flex:0 0 auto;display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid var(--border-subtle);}
.dz-ch-t{font-size:13px;font-weight:700;color:var(--text);line-height:1.2;}
.dz-ch-s{font-size:11px;color:var(--text-dim);}
.dz-live{margin-left:auto;display:inline-flex;align-items:center;gap:5px;font-size:10.5px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:.5px;}
.dz-live .dot{width:6px;height:6px;border-radius:50%;background:var(--accent);animation:dzpulse 1.3s infinite;}
@keyframes dzpulse{0%,100%{opacity:.35;transform:scale(.8)}50%{opacity:1;transform:scale(1.15)}}
.dz-pulse{animation:dzbtnpulse 1.6s ease-in-out infinite;}
@keyframes dzbtnpulse{0%,100%{box-shadow:0 0 0 0 rgba(224,164,78,0)}50%{box-shadow:0 0 0 4px rgba(224,164,78,.30)}}
.dz-work{background:var(--bg-elevated);border:1px solid var(--border);border-radius:12px;padding:11px 12px;font-size:12px;color:var(--text);}
.dz-composer{flex:0 0 auto;border-top:1px solid var(--border-subtle);padding:11px 13px 13px;}
.dz-chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:9px;}
.dz-chip{font-size:11px;font-weight:600;color:var(--text-dim);background:var(--bg-elevated);border:1px solid var(--border);border-radius:999px;padding:5px 10px;cursor:pointer;transition:.15s;}
.dz-chip:hover{color:var(--accent);border-color:var(--accent);}
.dz-attach{display:flex;align-items:center;gap:7px;font-size:11px;color:var(--text);background:var(--bg-elevated);border:1px solid var(--accent);border-radius:9px;padding:6px 9px;margin-bottom:8px;}
.dz-attach .sw{width:13px;height:13px;border-radius:3px;border:1px solid var(--border);}
.dz-attach .x{margin-left:auto;cursor:pointer;color:var(--text-dim);display:grid;place-items:center;}
.dz-input{display:flex;align-items:center;gap:8px;background:var(--bg-input,var(--bg-elevated));border:1px solid var(--border);border-radius:11px;padding:8px 8px 8px 12px;}
.dz-input input{flex:1;background:none;border:none;outline:none;color:var(--text);font-size:12.5px;font-family:inherit;}
.dz-input input::placeholder{color:var(--text-faint);}
.dz-send{width:30px;height:30px;flex:0 0 30px;border-radius:8px;border:none;background:var(--accent);color:var(--accent-fg,#1a1205);display:grid;place-items:center;cursor:pointer;}
.dz-send:disabled{opacity:.5;cursor:default;}
.dz-center{flex:1;min-width:0;display:flex;flex-direction:column;min-height:0;background:var(--bg-app);}
.dz-bar{flex:0 0 auto;display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--border-subtle);flex-wrap:wrap;}
.dz-modes{display:flex;gap:1px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:9px;padding:3px;}
.dz-mode{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:600;color:var(--text-dim);padding:5px 9px;border-radius:6px;cursor:pointer;transition:.12s;}
.dz-mode:hover{color:var(--text);}
.dz-mode.on{background:var(--accent);color:var(--accent-fg,#1a1205);}
.dz-seg{display:flex;background:var(--bg-elevated);border:1px solid var(--border);border-radius:8px;padding:3px;}
.dz-seg button{border:none;background:none;color:var(--text-dim);font-size:11px;font-weight:600;padding:4px 8px;border-radius:5px;cursor:pointer;display:inline-flex;align-items:center;gap:5px;}
.dz-seg button.on{background:var(--bg-app);color:var(--text);box-shadow:var(--shadow);}
.dz-spacer{flex:1;}
.dz-pagestrip{flex:0 0 auto;display:flex;align-items:center;gap:8px;padding:7px 12px;border-bottom:1px solid var(--border-subtle);overflow-x:auto;}
.dz-ptabs{display:flex;gap:2px;}
.dz-ptab{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:600;color:var(--text-dim);padding:5px 10px;border-radius:7px;cursor:pointer;transition:.15s;white-space:nowrap;}
.dz-ptab:hover{color:var(--text);}
.dz-ptab.active{background:var(--bg-elevated);color:var(--text);}
.dz-hint{margin-left:auto;font-size:11px;color:var(--text-faint);display:inline-flex;align-items:center;gap:6px;white-space:nowrap;}
/* Browser-viewport zoom: when a screen exists the preview frame fills the canvas surface. The iframe document
   applies one global page scale, so the frame stays put and every prototype element zooms together. */
.dz-canvas{flex:1;min-height:0;overflow:hidden;display:grid;align-items:safe center;justify-items:safe center;padding:32px;background:radial-gradient(circle at 50% 0,rgba(224,164,78,.05),transparent 60%),var(--bg-app);}
.dz-canvas.has-screen{padding:0;align-items:stretch;justify-items:stretch;}
.dz-canvas.has-screen.framed{padding:24px;align-items:center;justify-items:center;overflow:auto;}
.dz-artwrap{position:relative;}
.dz-art{position:absolute;top:0;left:0;overflow:hidden;background:#fff;}
.dz-canvas.has-screen.framed .dz-art{border:1px solid var(--border);border-radius:18px;box-shadow:0 18px 55px -18px rgba(0,0,0,.45);}
.dz-bpw{width:46px;border:none;background:none;color:var(--text);font-size:11px;font-weight:600;text-align:center;border-radius:5px;outline:none;-moz-appearance:textfield;}
.dz-bpw::-webkit-outer-spin-button,.dz-bpw::-webkit-inner-spin-button{-webkit-appearance:none;margin:0;}
.dz-bpw::placeholder{color:var(--text-faint);}
.dz-bpw:focus{background:var(--bg-app);}
.dz-live-bar{flex:0 0 auto;display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--border-subtle);background:var(--bg-panel);}
.dz-live-dot{width:9px;height:9px;border-radius:50%;background:var(--text-faint);flex:0 0 auto;}
.dz-live-dot.on{background:var(--sx-string,#3fb950);box-shadow:0 0 0 3px rgba(63,185,80,.18);}
.dz-live-dot.err{background:#e8688f;}
.dz-ico{width:28px;height:28px;border:1px solid var(--border);border-radius:7px;background:var(--bg-app);color:var(--text-dim);display:inline-grid;place-items:center;cursor:pointer;flex:0 0 auto;text-decoration:none;}
.dz-ico:hover{color:var(--text);}.dz-ico:disabled{opacity:.4;cursor:default;}
.dz-live-addr{flex:1;min-width:0;display:flex;align-items:center;gap:7px;padding:0 10px;height:28px;border:1px solid var(--border);border-radius:7px;background:var(--bg-app);color:var(--text-dim);}
.dz-live-addr input{flex:1;min-width:0;border:none;background:none;outline:none;color:var(--text);font-size:12px;font-family:var(--mono-font);}
.dz-live-stage{flex:1;min-height:0;overflow:auto;display:grid;place-items:start center;padding:20px;background:radial-gradient(circle at 50% 0,rgba(99,102,241,.05),transparent 60%),var(--bg-app);}
.dz-live-frame{height:100%;min-height:560px;border:1px solid var(--border);border-radius:12px;background:#fff;box-shadow:0 18px 55px -18px rgba(0,0,0,.45);}
.dz-live-empty{margin:auto;display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center;color:var(--text-dim);padding:40px;max-width:380px;}
.dz-live-empty .t{font-size:14px;font-weight:600;color:var(--text);}.dz-live-empty .s{font-size:12px;line-height:1.5;}
.dz-live-ask{flex:0 0 auto;display:flex;align-items:center;gap:8px;padding:9px 12px;border-top:1px solid var(--border-subtle);background:var(--bg-panel);}
.dz-live-ask>svg{color:var(--accent);flex:0 0 auto;}
.dz-live-ask input{flex:1;min-width:0;border:1px solid var(--border);border-radius:8px;background:var(--bg-app);color:var(--text);font-size:12.5px;padding:8px 11px;outline:none;}
.dz-live-ask input:focus{border-color:var(--accent);}
.dz-emptywrap{margin:auto;display:grid;place-items:center;}
.dz-empty{display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center;padding:40px;max-width:380px;}
.dz-empty .ic{width:46px;height:46px;border-radius:13px;background:var(--bg-elevated);border:1px solid var(--border);display:grid;place-items:center;color:var(--accent);}
.dz-empty .t{font-size:14px;font-weight:700;color:var(--text);}
.dz-empty .s{font-size:12px;color:var(--text-dim);line-height:1.5;}
.dz-ovl{position:absolute;inset:0;pointer-events:none;z-index:6;}
.dz-hl{position:absolute;border:1.5px solid var(--accent);border-radius:3px;pointer-events:none;}
.dz-hl .tag{position:absolute;top:-18px;left:-1.5px;font-size:10px;font-weight:700;color:var(--accent-fg,#1a1205);background:var(--accent);padding:1px 6px;border-radius:4px;white-space:nowrap;}
.dz-selbox{position:absolute;border:2px solid var(--accent);border-radius:3px;pointer-events:none;}
.dz-selbox .h{position:absolute;width:9px;height:9px;background:var(--bg-app);border:1.5px solid var(--accent);border-radius:2px;pointer-events:auto;z-index:9;}
.dz-selbox .h.tl{left:-5px;top:-5px;cursor:nwse-resize}.dz-selbox .h.tr{right:-5px;top:-5px;cursor:nesw-resize}.dz-selbox .h.bl{left:-5px;bottom:-5px;cursor:nesw-resize}.dz-selbox .h.br{right:-5px;bottom:-5px;cursor:nwse-resize}
.dz-selbox .h.tm{left:50%;top:-5px;transform:translateX(-50%);cursor:ns-resize}.dz-selbox .h.bm{left:50%;bottom:-5px;transform:translateX(-50%);cursor:ns-resize}
.dz-selbox .h.ml{left:-5px;top:50%;transform:translateY(-50%);cursor:ew-resize}.dz-selbox .h.mr{right:-5px;top:50%;transform:translateY(-50%);cursor:ew-resize}
.dz-guide{position:absolute;background:var(--accent);pointer-events:none;z-index:8;opacity:.9;}
.dz-guide.v{top:0;bottom:0;width:1px;}
.dz-guide.h{left:0;right:0;height:1px;}
.dz-ctx{position:absolute;z-index:9;pointer-events:auto;display:flex;align-items:center;gap:3px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:10px;padding:4px;box-shadow:0 10px 30px -8px rgba(0,0,0,.5);}
.dz-ctx button{height:28px;padding:0 8px;border:none;background:none;border-radius:7px;color:var(--text-dim);display:inline-flex;align-items:center;gap:5px;cursor:pointer;font-size:11px;font-weight:600;}
.dz-ctx button:hover{background:var(--bg-app);color:var(--accent);}
.dz-ctx .sep{width:1px;height:18px;background:var(--border);margin:0 2px;}
.dz-ctx .ask{background:var(--accent);color:var(--accent-fg,#1a1205);}
.dz-mk{position:absolute;border:2px dashed var(--accent);background:rgba(224,164,78,.1);border-radius:4px;pointer-events:none;}
.dz-pin{position:absolute;width:23px;height:23px;border-radius:50% 50% 50% 3px;background:var(--accent);color:var(--accent-fg,#1a1205);display:grid;place-items:center;font-size:11px;font-weight:800;pointer-events:auto;cursor:pointer;box-shadow:0 4px 12px -2px rgba(0,0,0,.5);transform:translate(-2px,-23px);}
.dz-cpop{position:absolute;z-index:11;width:216px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:11px;padding:11px;box-shadow:0 14px 40px -10px rgba(0,0,0,.6);pointer-events:auto;}
.dz-cpop textarea{width:100%;background:var(--bg-app);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:inherit;font-size:12px;padding:8px;resize:none;outline:none;box-sizing:border-box;}
.dz-cpop .row{display:flex;gap:6px;justify-content:flex-end;margin-top:8px;}
.dz-build-bar{position:absolute;left:0;right:0;bottom:0;display:flex;align-items:center;gap:8px;padding:8px 14px;font-size:11px;font-weight:600;color:#fff;background:linear-gradient(90deg,rgba(224,164,78,.92),rgba(224,164,78,.7));z-index:7;}
.dz-build-bar .sh{flex:1;height:4px;border-radius:3px;background:rgba(255,255,255,.3);overflow:hidden;}
.dz-build-bar .sh::after{content:"";display:block;height:100%;width:40%;background:#fff;border-radius:3px;animation:dzshim 1.3s infinite;}
@keyframes dzshim{0%{transform:translateX(-120%)}100%{transform:translateX(320%)}}
.dz-approve-banner{flex:0 0 auto;display:flex;align-items:center;gap:12px;padding:10px 14px;background:linear-gradient(90deg,rgba(224,164,78,.14),rgba(224,164,78,.02));border-bottom:1px solid var(--border-subtle);}
.dz-ab-ic{width:30px;height:30px;border-radius:9px;background:var(--accent);color:var(--accent-fg,#1a1205);display:grid;place-items:center;flex:0 0 30px;}
.dz-ab-t{font-size:12.5px;font-weight:700;color:var(--text);}
.dz-ab-s{font-size:11px;color:var(--text-dim);}
.dz-ab-actions{margin-left:auto;display:flex;gap:7px;flex-wrap:wrap;}
.dz-mini-btn{font-size:11px;font-weight:600;border-radius:7px;padding:5px 10px;cursor:pointer;border:1px solid var(--border);background:var(--bg-elevated);color:var(--text);display:inline-flex;align-items:center;gap:6px;}
.dz-mini-btn.accent{background:var(--accent);color:var(--accent-fg,#1a1205);border-color:transparent;}
.dz-mini-btn:disabled{opacity:.6;cursor:default;}
.dz-rail{width:240px;flex:0 0 240px;display:flex;flex-direction:column;min-height:0;border-left:1px solid var(--border-subtle);background:var(--bg-panel);}
.dz-rail-tabs{flex:0 0 auto;display:flex;border-bottom:1px solid var(--border-subtle);padding:6px 7px;gap:2px;overflow-x:auto;}
.dz-rt{flex:1;font-size:10.5px;font-weight:600;color:var(--text-dim);padding:7px 4px;border-radius:7px;cursor:pointer;text-align:center;white-space:nowrap;transition:.15s;}
.dz-rt.active{background:var(--bg-elevated);color:var(--text);}
.dz-rail-body{flex:1;min-height:0;overflow-y:auto;padding:13px;}
/* Custom scrollbar — same look as the lateral menu (the global themed bar). Explicit on the Design
   module's scroll surfaces so they never fall back to the native thin bar. */
.dz-rail-body::-webkit-scrollbar,.dz-rail-tabs::-webkit-scrollbar,.dz-pagestrip::-webkit-scrollbar,.dz-canvas::-webkit-scrollbar{width:11px;height:11px;}
.dz-rail-body::-webkit-scrollbar-track,.dz-rail-tabs::-webkit-scrollbar-track,.dz-pagestrip::-webkit-scrollbar-track,.dz-canvas::-webkit-scrollbar-track{background:transparent;}
.dz-rail-body::-webkit-scrollbar-thumb,.dz-rail-tabs::-webkit-scrollbar-thumb,.dz-pagestrip::-webkit-scrollbar-thumb,.dz-canvas::-webkit-scrollbar-thumb{background:var(--scroll-thumb);border-radius:6px;border:3px solid transparent;background-clip:padding-box;}
.dz-rail-body::-webkit-scrollbar-thumb:hover,.dz-rail-tabs::-webkit-scrollbar-thumb:hover,.dz-pagestrip::-webkit-scrollbar-thumb:hover,.dz-canvas::-webkit-scrollbar-thumb:hover{background:var(--text-faint);background-clip:padding-box;}
.dz-rail-body::-webkit-scrollbar-corner,.dz-canvas::-webkit-scrollbar-corner{background:transparent;}
.dz-sec{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--text-faint);margin:4px 0 9px;}
.dz-row{display:flex;align-items:center;gap:9px;padding:8px 9px;border-radius:9px;border:1px solid transparent;cursor:pointer;transition:.15s;}
.dz-row:hover{background:var(--bg-elevated);}
.dz-row.active{background:var(--bg-elevated);border-color:var(--border);}
.dz-r-ic{width:26px;height:26px;flex:0 0 26px;border-radius:7px;background:var(--bg-app);border:1px solid var(--border);display:grid;place-items:center;color:var(--accent);}
.dz-r-t{font-size:12px;font-weight:600;color:var(--text);word-break:break-all;}
.dz-r-s{font-size:10.5px;color:var(--text-dim);}
.dz-r-meta{margin-left:auto;font-size:10px;color:var(--text-faint);flex:0 0 auto;}
.dz-addrow{display:flex;align-items:center;justify-content:center;gap:6px;padding:9px;border:1px dashed var(--border);border-radius:9px;color:var(--text-dim);font-size:11.5px;font-weight:600;cursor:pointer;margin-top:8px;}
.dz-addrow:hover{color:var(--accent);border-color:var(--accent);}
.dz-pp-row{display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid var(--border-subtle);font-size:11px;align-items:center;}
.dz-pp-row .k{color:var(--text-dim);flex:0 0 auto;}
.dz-pp-row .v{color:var(--text);text-align:right;word-break:break-word;font-family:var(--mono-font);font-size:10px;}
.dz-insw{width:11px;height:11px;border-radius:3px;display:inline-block;vertical-align:-1px;margin-right:5px;border:1px solid var(--border);}
.dz-swatches{display:flex;flex-wrap:wrap;gap:8px;}
.dz-sw{width:32px;height:32px;border-radius:9px;cursor:pointer;border:2px solid transparent;position:relative;transition:.15s;}
.dz-sw.on{border-color:var(--text);}
.dz-sw.on::after{content:"✓";position:absolute;inset:0;display:grid;place-items:center;color:#fff;font-size:13px;font-weight:800;text-shadow:0 1px 2px rgba(0,0,0,.5);}
.dz-opt{display:flex;gap:6px;flex-wrap:wrap;}
.dz-pill2{font-size:11px;font-weight:600;color:var(--text-dim);background:var(--bg-elevated);border:1px solid var(--border);border-radius:8px;padding:6px 11px;cursor:pointer;transition:.15s;}
.dz-pill2.on{color:var(--accent);border-color:var(--accent);background:rgba(224,164,78,.08);}
.dz-comp-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
.dz-comp{border:1px solid var(--border);border-radius:9px;padding:9px;background:var(--bg-elevated);}
.dz-comp .nm{font-size:11px;font-weight:600;color:var(--text);margin-top:7px;word-break:break-all;}
.dz-comp .ct{font-size:10px;color:var(--text-faint);}
.dz-preset{position:relative;}
.dz-preset-x{position:absolute;top:4px;right:4px;width:16px;height:16px;border:none;border-radius:5px;background:var(--bg-app);color:var(--text-dim);display:grid;place-items:center;cursor:pointer;opacity:0;transition:.12s;}
.dz-preset:hover .dz-preset-x{opacity:1;}
.dz-preset-x:hover{background:var(--danger,#e5484d);color:#fff;}
.dz-cmt{border:1px solid var(--border);border-radius:10px;padding:10px;margin-bottom:8px;background:var(--bg-elevated);}
.dz-cmt .h{display:flex;align-items:center;gap:7px;font-size:11px;font-weight:700;color:var(--text);}
.dz-cmt .pin{width:18px;height:18px;border-radius:50%;background:var(--accent);color:var(--accent-fg,#1a1205);display:grid;place-items:center;font-size:10px;font-weight:800;}
.dz-cmt .x{margin-left:auto;cursor:pointer;color:var(--text-faint);}
.dz-cmt .bd{font-size:11.5px;color:var(--text);margin:6px 0;line-height:1.45;}
.dz-cmt .rep{font-size:11px;color:var(--text-dim);border-left:2px solid var(--accent);padding-left:8px;line-height:1.45;display:flex;gap:6px;}
.dz-vnode{position:relative;padding:8px 9px;border-radius:9px;cursor:pointer;border:1px solid transparent;margin-bottom:4px;margin-left:16px;}
.dz-vnode:hover{background:var(--bg-elevated);}
.dz-vnode.active{background:var(--bg-elevated);border-color:var(--border);}
.dz-vnode::before{content:"";position:absolute;left:-13px;top:13px;width:9px;height:9px;border-radius:50%;background:var(--bg-panel);border:2px solid var(--border);}
.dz-vnode.active::before{background:var(--accent);border-color:var(--accent);}
.dz-vnode .vt{font-size:12px;font-weight:600;color:var(--text);display:flex;align-items:center;gap:6px;}
.dz-vnode .vs{font-size:10.5px;color:var(--text-dim);}
.dz-vnode .vtime{font-size:10px;color:var(--text-faint);}
.dz-tag{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--accent);background:rgba(224,164,78,.12);border-radius:5px;padding:1px 6px;}
.dz-modal-bg{position:fixed;inset:0;z-index:60;background:rgba(0,0,0,.55);display:grid;place-items:center;padding:24px;}
.dz-modal{width:560px;max-width:100%;max-height:90vh;display:flex;flex-direction:column;background:var(--bg-panel);border:1px solid var(--border);border-radius:14px;box-shadow:0 30px 80px -20px rgba(0,0,0,.7);overflow:hidden;}
.dz-modal-h{display:flex;align-items:center;gap:11px;padding:16px 18px;border-bottom:1px solid var(--border-subtle);}
.dz-modal-h .ic{width:34px;height:34px;border-radius:9px;background:var(--accent);color:var(--accent-fg,#1a1205);display:grid;place-items:center;}
.dz-modal-h .t{font-size:15px;font-weight:800;color:var(--text);}
.dz-modal-h .s{font-size:11.5px;color:var(--text-dim);}
.dz-modal-h .x{margin-left:auto;cursor:pointer;color:var(--text-dim);width:30px;height:30px;display:grid;place-items:center;border-radius:8px;}
.dz-modal-b{padding:16px 18px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;}
.dz-dl{display:flex;align-items:center;gap:9px;padding:9px 11px;border:1px solid var(--border);border-radius:9px;background:var(--bg-app);font-size:12px;color:var(--text);}
.dz-dl .ck{width:18px;height:18px;border-radius:50%;background:rgba(224,164,78,.16);color:var(--accent);display:grid;place-items:center;flex:0 0 18px;}
.dz-dl .n{margin-left:auto;font-size:10px;color:var(--text-faint);}
.dz-modal-f{display:flex;align-items:center;gap:10px;padding:14px 18px;border-top:1px solid var(--border-subtle);}
.dz-modal-f .note{font-size:11px;color:var(--text-dim);}
.dz-flash{position:absolute;bottom:14px;left:50%;transform:translateX(-50%);z-index:50;background:var(--bg-elevated);border:1px solid var(--accent);color:var(--text);font-size:12px;font-weight:600;border-radius:9px;padding:8px 14px;box-shadow:0 10px 30px -8px rgba(0,0,0,.5);}
.dz-composer.drag{outline:2px dashed var(--accent);outline-offset:-3px;background:rgba(224,164,78,.05);}
.dz-atts{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;}
.dz-att{display:flex;align-items:center;gap:6px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:8px;padding:3px 4px 3px 6px;font-size:10.5px;color:var(--text-dim);max-width:158px;}
.dz-att img{width:22px;height:22px;border-radius:4px;object-fit:cover;flex:0 0 22px;}
.dz-att .nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.dz-att .rm{cursor:pointer;color:var(--text-faint);display:grid;place-items:center;width:16px;height:16px;border-radius:4px;flex:0 0 16px;}
.dz-att .rm:hover{color:var(--text);background:var(--bg-app);}
.dz-clip{width:30px;height:30px;flex:0 0 30px;border-radius:8px;border:1px solid var(--border);background:var(--bg-elevated);color:var(--text-dim);display:grid;place-items:center;cursor:pointer;}
.dz-clip:hover{color:var(--accent);border-color:var(--accent);}
.dz-clip:disabled{opacity:.5;cursor:default;}
.dz-uperr{font-size:10.5px;color:#e5687a;margin-bottom:6px;}
.dz-strip{flex:0 0 40px;width:40px;display:flex;flex-direction:column;align-items:center;gap:12px;padding:12px 0;background:var(--bg-panel);cursor:pointer;color:var(--text-dim);}
.dz-strip.left{border-right:1px solid var(--border-subtle);}
.dz-strip.right{border-left:1px solid var(--border-subtle);}
.dz-strip:hover{color:var(--accent);background:var(--bg-elevated);}
.dz-collapse-btn{margin-left:auto;width:24px;height:24px;border-radius:6px;border:none;background:none;color:var(--text-dim);display:grid;place-items:center;cursor:pointer;flex:0 0 auto;}
.dz-collapse-btn:hover{color:var(--accent);background:var(--bg-elevated);}
.dz-save{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;border-radius:7px;padding:5px 9px;border:1px solid var(--border);white-space:nowrap;}
.dz-save.saving{color:var(--accent);border-color:var(--accent);background:rgba(224,164,78,.08);}
.dz-save.saved{color:#34d399;border-color:rgba(52,211,153,.4);background:rgba(52,211,153,.08);}
.dz-save.preview{color:var(--text-dim);border-color:var(--border);}
/* Per-element Property panel (live editor) */
.dz-pgrp-h{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--text-faint);margin:13px 0 7px;display:flex;align-items:center;gap:6px;}
.dz-pgrp-h:first-child{margin-top:4px;}
.dz-fgrid{display:grid;grid-template-columns:1fr 1fr;gap:7px;}
.dz-f{display:flex;flex-direction:column;gap:3px;min-width:0;}
.dz-f.full{grid-column:1 / -1;}
.dz-f>label{font-size:9.5px;font-weight:600;color:var(--text-dim);text-transform:uppercase;letter-spacing:.3px;}
.dz-f input,.dz-f select{width:100%;box-sizing:border-box;background:var(--bg-app);border:1px solid var(--border);border-radius:7px;color:var(--text);font-size:11px;font-family:var(--mono-font);padding:5px 7px;outline:none;}
.dz-f input:focus,.dz-f select:focus{border-color:var(--accent);}
.dz-colorrow{display:flex;align-items:center;gap:6px;}
.dz-colorrow input[type=color]{width:26px;height:26px;flex:0 0 26px;padding:1px;border:1px solid var(--border);border-radius:6px;background:none;cursor:pointer;}
.dz-colorrow input[type=text]{flex:1;min-width:0;}
/* Styles-panel token controls (sliders / color rows / sub-headers) */
.dz-trow{margin:9px 0;}
.dz-trow>label{display:flex;justify-content:space-between;align-items:center;font-size:11px;font-weight:600;color:var(--text-dim);margin-bottom:5px;}
.dz-trow>label .v{color:var(--accent);font-variant-numeric:tabular-nums;font-weight:700;}
.dz-trow input[type=range]{width:100%;height:4px;-webkit-appearance:none;appearance:none;background:var(--border);border-radius:3px;outline:none;cursor:pointer;}
.dz-trow input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:var(--accent);cursor:pointer;border:2px solid var(--bg-elevated);}
.dz-trow input[type=range]::-moz-range-thumb{width:14px;height:14px;border-radius:50%;background:var(--accent);cursor:pointer;border:none;}
.dz-trow input[type=text]{background:var(--bg-input,var(--bg-elevated));border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:11.5px;font-family:inherit;padding:6px 9px;outline:none;}
.dz-sub{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--text-faint);margin:12px 0 6px;}
.dz-adv{margin:10px 0;border-top:1px solid var(--border);padding-top:9px;}
.dz-adv>summary{font-size:11px;font-weight:600;color:var(--text-dim);cursor:pointer;}
.dz-f>label.dz-scrub{cursor:ew-resize;user-select:none;}
.dz-numf{position:relative;display:flex;align-items:stretch;}
.dz-numf input{flex:1;min-width:0;padding-right:16px;}
.dz-numf input::-webkit-outer-spin-button,.dz-numf input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0;}
.dz-steps{position:absolute;right:1px;top:1px;bottom:1px;width:15px;display:flex;flex-direction:column;}
.dz-steps button{flex:1;border:none;background:var(--bg-elevated);color:var(--text-dim);display:grid;place-items:center;cursor:pointer;padding:0;border-radius:0;}
.dz-steps button:first-child{border-top-right-radius:6px;}
.dz-steps button:last-child{border-bottom-right-radius:6px;}
.dz-steps button:hover{color:var(--accent);background:var(--bg-app);}
.dz-layer{display:flex;align-items:center;gap:7px;padding:5px 8px;border-radius:7px;cursor:pointer;font-size:11.5px;color:var(--text);border:1px solid transparent;}
.dz-layer:hover{background:var(--bg-elevated);}
.dz-layer.active{background:var(--bg-elevated);border-color:var(--accent);}
.dz-layer .lt{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.dz-layer .lg{font-size:9px;color:var(--text-faint);font-family:var(--mono-font);flex:0 0 auto;}
.dz-layer>svg{flex:0 0 auto;color:var(--text-dim);}
.dz-docnav{display:flex;flex-direction:column;gap:3px;margin-bottom:11px;}
.dz-doctab{display:flex;align-items:center;gap:7px;padding:6px 9px;border-radius:8px;cursor:pointer;font-size:11.5px;color:var(--text);border:1px solid transparent;transition:.15s;}
.dz-doctab:hover{background:var(--bg-elevated);}
.dz-doctab.active{background:var(--bg-elevated);border-color:var(--accent);color:var(--accent);}
.dz-doctab>span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.dz-doctab>svg{flex:0 0 auto;color:var(--text-dim);}
.dz-doctab.active>svg{color:var(--accent);}
.dz-docbody{font-size:12px;line-height:1.6;color:var(--text);border-top:1px solid var(--border-subtle);padding-top:11px;overflow-wrap:anywhere;}
.dz-docbody h1{font-size:15px;}.dz-docbody h2{font-size:13.5px;margin-top:14px;}.dz-docbody h3{font-size:12.5px;}
.dz-docbody code{font-family:var(--mono-font);font-size:11px;background:var(--bg-app);padding:1px 4px;border-radius:4px;}
.dz-docbody pre{background:var(--bg-app);border:1px solid var(--border-subtle);border-radius:8px;padding:9px;overflow-x:auto;}
.dz-docbody pre code{background:none;padding:0;}
.dz-docbody table{border-collapse:collapse;width:100%;font-size:11px;}
.dz-docbody th,.dz-docbody td{border:1px solid var(--border-subtle);padding:4px 7px;text-align:left;}
.dz-docbody a{color:var(--accent);}
.dz-quick{display:flex;gap:6px;flex-wrap:wrap;margin:14px 0 2px;}
.dz-quick .dz-mini-btn{flex:1;min-width:62px;justify-content:center;}
.dz-seg-mini{display:flex;background:var(--bg-app);border:1px solid var(--border);border-radius:7px;padding:2px;gap:1px;}
.dz-seg-mini button{flex:1;border:none;background:none;color:var(--text-dim);font-size:10.5px;font-weight:600;padding:4px 5px;border-radius:5px;cursor:pointer;display:grid;place-items:center;}
.dz-seg-mini button.on{background:var(--accent);color:var(--accent-fg,#1a1205);}
`;

const PALETTES = [
  { name: "Indigo", c: "#6366f1" }, { name: "Violet", c: "#8b5cf6" }, { name: "Blue", c: "#3b82f6" },
  { name: "Sky", c: "#0ea5e9" }, { name: "Cyan", c: "#06b6d4" }, { name: "Teal", c: "#14b8a6" },
  { name: "Emerald", c: "#10b981" }, { name: "Lime", c: "#84cc16" }, { name: "Amber", c: "#f59e0b" },
  { name: "Orange", c: "#f97316" }, { name: "Rose", c: "#f43f5e" }, { name: "Pink", c: "#ec4899" },
];
const FONTS = [
  { n: "Inter", s: "'Inter',system-ui,sans-serif" },
  { n: "IBM Plex", s: "'IBM Plex Sans',sans-serif" },
  { n: "Geist", s: "'Geist','Inter',ui-sans-serif,sans-serif" },
  { n: "System", s: "system-ui,-apple-system,Segoe UI,sans-serif" },
  { n: "Serif", s: "Georgia,'Times New Roman',serif" },
  { n: "Mono", s: "ui-monospace,'SF Mono',Menlo,monospace" },
  { n: "Display", s: "'Poppins','Inter',system-ui,sans-serif" },
];
const RADII = [{ n: "Sharp", r: 6 }, { n: "Soft", r: 16 }, { n: "Round", r: 26 }];

// Mode id + icon only — the visible label and hint are rendered at the call sites via
// t("design.mode."+id) / t("design.hint."+tool) so they live in the i18n dictionaries.
const MODES: { id: CanvasMode; ic: string }[] = [
  { id: "select", ic: "target" }, { id: "edit", ic: "newFile" },
  { id: "markup", ic: "skill" }, { id: "comments", ic: "chat" },
  { id: "inspect", ic: "search" }, { id: "preview", ic: "play" },
];

function hexA(hex: string, a: number) { const h = hex.replace("#", ""); const n = parseInt(h, 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }
function cap(s: string): string { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
function screenName(p: string) { return (p.split("/").pop() || p).replace(/\.html?$/i, ""); }
/** Agent file events carry the ABSOLUTE workspace path with OS separators (backslashes on Windows). Reduce
 *  any target to the relative, forward-slash `design-mock/...` form so it matches the screen list + getDesignScreen. */
function toDesignMockRel(t: string): string | null { const n = (t || "").replace(/\\/g, "/"); const i = n.toLowerCase().lastIndexOf("design-mock/"); return i >= 0 ? n.slice(i) : null; }
type Tr = (key: string, vars?: Record<string, string | number>) => string;
function ago(ms: number, t: Tr): string {
  const s = Math.max(0, Math.round((nowMs() - ms) / 1000));
  if (s < 60) return t("design.time.justNow");
  const m = Math.round(s / 60); if (m < 60) return t("design.time.minAgo", { n: m });
  const h = Math.round(m / 60); if (h < 24) return t("design.time.hAgo", { n: h });
  return t("design.time.dAgo", { n: Math.round(h / 24) });
}
function nowMs() { return new Date().getTime(); }

// A chip must be a forward NEXT STEP for the operator — never a report of something Grace already did
// ("removi o botão" / "I removed the button" / "pronto"). This matches PAST-TENSE / completed-action forms only
// (PT preterite -ei/-i, participles -ado/-ido, status words; EN -ed/done), NOT infinitives — so "Adicionar seção"
// and "Create a new screen" still pass while "Adicionei a seção" / "Created the screen" are rejected.
const DONE_RE = /\b(remov(i|ido|eu|idos)|adicion(ei|ado|ou|ados)|cri(ei|ado|ou|ados)|corrig(i|ido|iu)|ajust(ei|ado|ou)|atualiz(ei|ado|ou)|mud(ei|ado|ou)|delet(ei|ado|ou)|limp(ei|ado|ou)|troqu(ei)|troc(ado|ou)|inseri|inserido|fiz|feit[oa]s?|pront[oa]s?|conclu(i|í|ido|ída)|finaliz(ei|ado|ou)|implement(ei|ado|ou)|ger(ei|ado|ou)|salv(ei|o|ado)|apliqu(ei)|aplic(ado|ou)|added|removed|deleted|created|fixed|updated|changed|cleaned|adjusted|renamed|moved|made|done|ready|here'?s|i'?ve|i\s+have|i\s+just|i\s+made)\b/i;
function isForwardStep(v: string): boolean {
  if (v.length < 2 || v.length > 42) return false;
  if (DONE_RE.test(v)) return false;                          // describes a finished action → not a next step
  if ((v.match(/\s+/g) || []).length > 6) return false;       // too long to be an option label (a report sentence)
  return true;
}

// A suggestion chip carries a TRANSLATED visible `label` and an English `prompt`. The prompt is what gets sent to
// Grace via send()/askDesign — it MUST stay English. Grace's own bold-extracted options use label === prompt (we
// surface her exact wording), while the curated pool keeps the English prompt and renders the label via t().
type Suggestion = { label: string; prompt: string };
// Curated, state-aware pool of genuine next steps: [i18n key for the visible label, English prompt sent to Grace].
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

/** Real, context-aware composer suggestions — no extra LLM call. PRIMARY source: the FORWARD options Grace
 *  offered in her LATEST reply (she emphasises choices in **bold**), filtered so completed-action phrases never
 *  become chips. Filled from a curated, state-aware pool of genuine next steps. */
function buildSuggestions(msgs: Msg[], ctx: RoomCtx, t: Tr): Suggestion[] {
  const out: Suggestion[] = [];
  const norm = (s?: string) => (s ?? "").replace(/\s+/g, " ").replace(/^[-•*\s]+/, "").replace(/[.:;,!?]+$/, "").trim();
  const add = (label: string, prompt: string) => { const v = norm(label); if (v.length >= 2 && v.length <= 42 && !out.some((x) => x.label.toLowerCase() === v.toLowerCase())) out.push({ label: cap(v), prompt }); };
  const lastAgent = [...msgs].reverse().find((m) => m.fromKind === "agent" && m.text);
  if (lastAgent?.text) {
    for (const m of lastAgent.text.matchAll(/\*\*(.+?)\*\*/g)) { const v = norm(m[1]); if (isForwardStep(v)) add(v, v); if (out.length >= 4) break; }
  }
  const hasScreens = ctx.designMockFiles.some((p) => /\.html?$/i.test(p));
  const pool = hasScreens ? SUGG_POOL_SCREENS : SUGG_POOL_EMPTY;
  for (const [key, prompt] of pool) { add(t(key), prompt); if (out.length >= 4) break; }
  return out.slice(0, 4);
}

export type DesignTokens = { accent?: string; accentName?: string; theme?: "dark" | "light"; font?: string; fontName?: string; radius?: number; density?: number; fontScale?: number };
type Att = { name: string; type: string; size: number; path: string };
type Pt = {
  accent: string; accentName: string; accentFg?: string;
  secondary?: string; surface?: string; success?: string; warning?: string; danger?: string;
  theme: "dark" | "light";
  font: string; fontName: string; headingFont?: string; headingFontName?: string;
  fontWeight?: number; lineHeight?: number; letterSpacing?: number; fontScale: number;
  radius: number; borderWidth?: number; borderColor?: string; shadow?: "none" | "sm" | "md" | "lg";
  density: number; containerWidth?: number; motionMs?: number; ease?: string;
};
const DEFAULT_PT: Pt = {
  accent: "#6366f1", accentName: "Indigo", accentFg: "", secondary: "", surface: "", success: "", warning: "", danger: "",
  theme: "dark", font: FONTS[0].s, fontName: "Inter", headingFont: FONTS[0].s, headingFontName: "Inter",
  fontWeight: 400, lineHeight: 1.5, letterSpacing: 0, fontScale: 1,
  radius: 16, borderWidth: 1, borderColor: "", shadow: "md",
  density: 12, containerWidth: 1200, motionMs: 200, ease: "ease",
};
/** Pick a readable text color (near-black or white) for text placed on the accent color. */
function readableOn(hex: string): string { const h = hex.replace("#", ""); const x = h.length === 3 ? h.split("").map((c) => c + c).join("") : h; const n = parseInt(x, 16); const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255; return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? "#15171c" : "#ffffff"; }
/** Normalize a computed CSS color (rgb/rgba/#hex/name) to a #rrggbb hex the native color input accepts. */
function rgbToHex(c: string): string {
  const s = (c || "").trim();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s)) return s.length === 4 ? "#" + s.slice(1).split("").map((d) => d + d).join("") : s;
  const m = s.match(/rgba?\(([^)]+)\)/i);
  if (!m) return "#000000";
  const p = m[1].split(",").map((x) => parseFloat(x.trim()));
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n || 0))).toString(16).padStart(2, "0");
  return "#" + h(p[0]) + h(p[1]) + h(p[2]);
}

type DComment = { id: string; pageKey: string; xp: number; yp: number; body: string; reply: string; selection: unknown; createdAt: number };
type DVersion = { id: string; label: string; note: string; files: string[]; restorable: boolean; createdAt: number };
type Hover = { x: number; y: number; w: number; h: number; label: string };
type Markup = { x: number; y: number; w: number; h: number };
type ViewportMetrics = { scrollX: number; scrollY: number; viewportW: number; viewportH: number; docW: number; docH: number };

type RoomCtx = {
  mission: string; objective: string; stackList: string; brief: boolean;
  mockCount: number; designMockFiles: string[]; designSkillCount: number; hasImported: boolean; approved: boolean; gatePending?: boolean; gateScaffolded?: boolean; handoffPending?: boolean; handoffDone?: boolean;
};

function isMarkup(c: DComment): boolean { return !!(c.selection && typeof c.selection === "object" && (c.selection as { kind?: string }).kind === "markup"); }
function markupRect(c: DComment): Markup { return (c.selection as { rect: Markup }).rect; }
/** Human-readable location of a marked region (for Grace) — e.g. "top-left area, roughly 12%×8% of the page". */
function describeRegion(r: Markup): string {
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  const vert = cy < 33 ? "top" : cy < 66 ? "middle" : "bottom";
  const horz = cx < 33 ? "left" : cx < 66 ? "center" : "right";
  return `${vert}-${horz} area, roughly ${Math.round(r.w)}%×${Math.round(r.h)}% of the page`;
}
/** The default placeholder body counts as "no note typed". */
function markupNote(c: DComment): string { return c.body && c.body !== "(region marked for review)" ? c.body : ""; }

export function DesignRoom({ grace, context, status, tokens }: {
  grace: { id: string; name: string; handle: string; color: string; image?: string | null } | null;
  context: RoomCtx;
  status: string;
  tokens: DesignTokens | null;
}) {
  const router = useRouter();
  const t = useT();
  const [stateMode, setStateMode] = useState(status === "approved" || context.approved ? "approved" : "building");
  const [pendingUpdate, setPendingUpdate] = useState(false);          // edited the approved design since the last send → the execution button flips to "Send update"
  const [rail, setRail] = useState("screens");
  // The Design chat now lives in Grace's DM (AGENTS dock, "design" channel) — messaging her there builds the
  // canvas. The old in-module chat column is retired (default closed); the left strip + canvas affordances open
  // her DM instead. Kept behind `chatOpen` (always false) so the canvas/streaming machinery stays wired.
  const [chatOpen, setChatOpen] = useState(false);
  const [railOpen, setRailOpen] = useState(true);
  const [vp, setVp] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [customW, setCustomW] = useState<number | null>(null); // custom breakpoint width (px); overrides the vp preset when set
  const [liveMode, setLiveMode] = useState(false); // Phase 2: render the REAL running dev server (any stack) instead of the design-mock canvas
  const [zoom, setZoom] = useState(100);
  const [tool, setTool] = useState<CanvasMode>("select");
  const [pt, setPt] = useState<Pt>({ ...DEFAULT_PT, ...(tokens ?? {}) });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [flash, setFlash] = useState("");
  const [atts, setAtts] = useState<Att[]>([]);
  const [drag, setDrag] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [upErr, setUpErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const firstTokens = useRef(true);
  const [activeScreen, setActiveScreen] = useState("");
  const [screenHtml, setScreenHtml] = useState<string | null>(null);
  const [screenErr, setScreenErr] = useState("");
  // chat transcript on the "design" channel
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [chatEvents, setChatEvents] = useState<Ev[]>([]);
  const [chatLoading, setChatLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const graceRunToken = useRef<string | null>(null); // askDesign's runId while Grace is working, for Stop
  const [cancelledRunIds, setCancelledRunIds] = useState<Set<string>>(() => new Set());
  const evSeq = useRef(0);
  const msgCursor = useRef(0);
  const esRef = useRef<EventSource | null>(null);
  // canvas interaction
  const [liveScreens, setLiveScreens] = useState<string[]>([]);
  const [hover, setHover] = useState<Hover | null>(null);
  const [guides, setGuides] = useState<{ v: number[]; h: number[] } | null>(null);
  const [viewportMetrics, setViewportMetrics] = useState<ViewportMetrics>({ scrollX: 0, scrollY: 0, viewportW: 980, viewportH: 560, docW: 980, docH: 560 });
  const [canvasSize, setCanvasSize] = useState({ w: 1200, h: 700 });   // the fixed work-area px (the iframe is sized to this ÷ zoom)
  const [tree, setTree] = useState<{ path: string; tag: string; label: string; depth: number; kids: number }[]>([]); // Layers list
  const [interactive, setInteractive] = useState(false);     // screen has its own <script> → edits are preview-only (persist via Grace)
  const interactiveRef = useRef(false);
  const [sel, setSel] = useState<CanvasSelection | null>(null);
  const [multi, setMulti] = useState<CanvasSelection[]>([]);   // multi-selection set (sel = the primary / last-picked)
  const multiRef = useRef<CanvasSelection[]>([]);              // live mirror for the message handler (avoids stale closure)
  const [ctxMenu, setCtxMenu] = useState(false);
  const [attached, setAttached] = useState<CanvasSelection | null>(null);
  const [drawRect, setDrawRect] = useState<{ xPct: number; yPct: number; wPct: number; hPct: number } | null>(null);
  const [openCmt, setOpenCmt] = useState<{ xpPct: number; ypPct: number; selection?: CanvasSelection | null; markup?: Markup } | null>(null);
  const [cmtText, setCmtText] = useState("");
  const [comments, setComments] = useState<DComment[]>([]);
  const [versions, setVersions] = useState<DVersion[]>([]);
  const [selVersion, setSelVersion] = useState<string | null>(null); // Versions rail: which version is expanded (reveals Restore)
  const [ctx, setCtx] = useState<ContextStat | null>(null);   // chat context occupancy (donut) — channel "design"
  const [compacting, setCompacting] = useState(false);
  const [docs, setDocs] = useState<{ path: string; label: string }[]>([]); // Docs rail: Grace's design-mock markdown docs
  const [docPath, setDocPath] = useState<string | null>(null);             // selected doc
  const [docBody, setDocBody] = useState<string>("");                      // rendered markdown body
  const [reloadKey, setReloadKey] = useState(0);
  // Direct-manipulation edit state: while the operator is editing the canvas the iframe is AUTHORITATIVE —
  // editingRef suppresses every reload path (screen-load, live-preview, agent reconcile) so a re-read never
  // clobbers an in-progress edit. saveState drives the Saving…/Saved indicator.
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const editingRef = useRef(false);
  const editingScreenRef = useRef("");        // the screen an in-progress edit belongs to (commit targets THIS, not a switched-to screen)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const histRef = useRef<Map<string, { stack: string[]; labels: string[]; pos: number }>>(new Map()); // per-screen undo stack + action labels (survives reload)
  const [histVer, setHistVer] = useState(0);  // bumps when a stack changes → re-derives canUndo/canRedo
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const lastScreenEv = useRef("");
  const toolRef = useRef(tool);
  const shownScreenRef = useRef("");
  const ptRef = useRef(pt);
  const allScreensRef = useRef<string[]>([]);                          // live screen list for the (deps:[]) message handler
  const docsSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null); // debounced "Grace, reconcile source+docs to my canvas change"
  const approvedRef = useRef(false);
  const pendingRef = useRef(false);

  const ctxScreens = context.designMockFiles.filter((p) => /\.html?$/i.test(p));
  const allScreens = Array.from(new Set([...ctxScreens, ...liveScreens]));
  allScreensRef.current = allScreens;
  const componentFiles = context.designMockFiles.filter((p) => p.startsWith("design-mock/components/"));
  const approved = stateMode === "approved";
  const shownScreen = (activeScreen && allScreens.includes(activeScreen)) ? activeScreen : (allScreens[0] ?? "");
  shownScreenRef.current = shownScreen;
  approvedRef.current = approved;
  pendingRef.current = pending;
  toolRef.current = tool;
  ptRef.current = pt;
  const hasScreen = allScreens.length > 0 && screenHtml != null && !screenErr;
  // Host-side browser zoom: the iframe renders at a LARGER logical viewport (work area ÷ z) and the .dz-art wrapper is
  // transform:scale(z), so the page fills the work area, reflows, and reveals more (no in-iframe zoom → all coords are
  // plain px). The overlay (hover/sel/markup/pins) lives INSIDE that scaled wrapper, so it's positioned in iframe-
  // LOGICAL px (the wrapper applies z). Chrome (ctx menu / popover) lives OUTSIDE → multiply by z to land in painted px.
  const z = zoom / 100;
  // Breakpoint → a fixed device viewport (centered, framed, scrollable) so the screen REFLOWS at that width (Grace's
  // @media kicks in — true responsive, not scaling). Custom width overrides the preset. Desktop = fill the work area.
  const FRAME = customW != null
    ? { w: Math.max(320, Math.min(1920, customW)), h: Math.max(560, Math.round(Math.max(320, Math.min(1920, customW)) * 1.5)) }
    : vp === "tablet" ? { w: 768, h: 1024 }
      : vp === "mobile" ? { w: 390, h: 844 }
        : null; // desktop
  const isFramed = FRAME != null;
  const artW = isFramed ? FRAME.w : Math.max(1, canvasSize.w / z);   // iframe logical width  (the px the screen lays out in)
  const artH = isFramed ? FRAME.h : Math.max(1, canvasSize.h / z);   // iframe logical height
  const docW = Math.max(1, viewportMetrics.docW || viewportMetrics.viewportW || 1);
  const docH = Math.max(1, viewportMetrics.docH || viewportMetrics.viewportH || 1);
  // document px (from the instrument) → iframe-logical viewport px (subtract scroll; the wrapper scales it visually).
  const toVisualX = (x: number) => x - viewportMetrics.scrollX;
  const toVisualY = (y: number) => y - viewportMetrics.scrollY;
  const rectToVisual = (r: { x: number; y: number; w: number; h: number }) => ({ left: toVisualX(r.x), top: toVisualY(r.y), width: r.w, height: r.h });
  const pctRectToVisual = (r: { x: number; y: number; w: number; h: number }) => ({ left: toVisualX((r.x / 100) * docW), top: toVisualY((r.y / 100) * docH), width: (r.w / 100) * docW, height: (r.h / 100) * docH });
  const pctPointToVisual = (xPct: number, yPct: number) => ({ left: toVisualX((xPct / 100) * docW), top: toVisualY((yPct / 100) * docH) });
  // The comment popover sits OUTSIDE the scaled wrapper (full UI size), so convert the logical anchor to painted px (×z)
  // and clamp inside the painted footprint (artW*z × artH*z).
  const clampPopover = (xPct: number, yPct: number) => {
    const p = pctPointToVisual(xPct, yPct);
    return { left: Math.max(6, Math.min(p.left * z, Math.max(6, artW * z - 226))), top: Math.max(6, Math.min(p.top * z, Math.max(6, artH * z - 120))) };
  };
  const { canUndo, canRedo } = useMemo(() => {
    const e = histRef.current.get(shownScreen);
    return { canUndo: !!e && e.pos > 0, canRedo: !!e && e.pos < e.stack.length - 1 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [histVer, shownScreen]);

  useEffect(() => {
    if (document.getElementById("dz-style")) return;
    const el = document.createElement("style");
    el.id = "dz-style"; el.textContent = DZ_CSS;
    document.head.appendChild(el);
  }, []);
  // Panel collapse state — persisted so the operator's focused-canvas layout sticks across reloads.
  useEffect(() => {
    try {
      if (localStorage.getItem("bx.dzChat") === "0") setChatOpen(false);
      if (localStorage.getItem("bx.dzRail") === "0") setRailOpen(false);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => { try { localStorage.setItem("bx.dzChat", chatOpen ? "1" : "0"); } catch { /* ignore */ } }, [chatOpen]);
  // Open Grace's DM (AGENTS dock, "design" channel) seeded with an optional prompt and/or a picked canvas
  // element — the single design chat. chat-dock.tsx listens for "constella:open-grace".
  function openGraceDm(seedText?: string, selection?: CanvasSelection) {
    try { window.dispatchEvent(new CustomEvent("constella:open-grace", { detail: { text: seedText, selection } })); } catch { /* ignore */ }
  }
  // Pair Grace's DM with the canvas on entering /design (she builds/updates it from that DM).
  useEffect(() => { openGraceDm(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  useEffect(() => { try { localStorage.setItem("bx.dzRail", railOpen ? "1" : "0"); } catch { /* ignore */ } }, [railOpen]);

  // Load the "design" channel history once, then tail it over a single SSE connection.
  useEffect(() => {
    let cancelled = false;
    const CAP = 250;
    const cap = <T,>(a: T[]): T[] => (a.length > CAP ? a.slice(-CAP) : a);
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
        setChatEvents((cur) => (cur.some((x) => x.id === row.id) ? cur : cap([...cur, row])));
      });
      es.addEventListener("msg", (e) => {
        const row = JSON.parse((e as MessageEvent).data) as Msg;
        const tm = row.createdAt ? new Date(row.createdAt).getTime() : 0;
        if (tm > msgCursor.current) msgCursor.current = tm;
        setMsgs((cur) => (cur.some((x) => x.id === row.id) ? cur : cap([...cur, row])));
        setChatEvents((cur) => cur.filter((x) => !(x.runId === row.id && x.kind === "text")));
        setCancelledRunIds((cur) => {
          if (!cur.has(row.id)) return cur;
          const next = new Set(cur);
          next.delete(row.id);
          return next;
        });
        if (row.fromKind === "agent") {
          setPending(false); graceRunToken.current = null; setReloadKey((k) => k + 1); router.refresh();
          // Final reconcile: re-read the shown screen so an EDIT to an existing file (which doesn't change the
          // screen list, so the load effect wouldn't re-fire) still shows the finished result.
          const p = shownScreenRef.current;
          if (p) setTimeout(() => { if (editingRef.current) return; histRef.current.delete(p); setHistVer((v) => v + 1); getDesignScreen(p).then((r) => { if (r.ok && r.html != null) { setScreenHtml(r.html); setScreenErr(""); } }); }, 300);
        }
      });
    }
    function disconnect() { if (esRef.current) { esRef.current.close(); esRef.current = null; } }
    loadHistory().catch(() => {}).finally(() => { if (cancelled) return; setChatLoading(false); if (!document.hidden) connect(); });
    const onVis = () => { if (document.hidden) disconnect(); else connect(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { cancelled = true; document.removeEventListener("visibilitychange", onVis); disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live restyle the canvas immediately, then persist (debounced) for Grace's next build. Skip persist on mount.
  useEffect(() => {
    sendTokens();
    if (firstTokens.current) { firstTokens.current = false; return; }
    const id = setTimeout(() => { void setTokens(pt); }, 500);
    setPendingUpdate(true);                      // a token change is a pending update → the execution button flips to "Send update"
    if (approvedRef.current) scheduleDocsSync();  // read the LIVE approval flag (not the [pt]-stale closure) so a token edit across the approval boundary still reconciles global.css + design-system.md (debounced)
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pt]);

  // Keep the SOURCE + DOCS in sync with the operator's direct canvas changes (the canvas is the source of truth):
  // after a Styles-panel change on an APPROVED design, Grace reconciles global.css + design-system.md — she DOES it,
  // never just asks. Debounced (fires once the operator settles) + skipped while Grace is already running.
  function syncDocsWithGrace() {
    if (!approvedRef.current || pendingRef.current) return;
    const p = ptRef.current;
    void askGrace(`I changed the design directly on the canvas via the Styles panel — the canvas is the source of truth now. RECONCILE the source to match it; do NOT ask, just do it: write the current tokens into design-mock/styles/global.css (:root) — accent ${p.accent}, secondary ${p.secondary}, surface ${p.surface}, body font ${p.font}, heading font ${p.headingFont}, radius ${p.radius}px, theme ${p.theme} — and update design-mock/design-system.md (palette / typography / tokens) plus any affected component docs to reflect it, keeping every screen VISUALLY IDENTICAL. Then briefly summarize what you synced.`);
    toast("Grace is syncing your change into the source CSS + docs…");
  }
  function scheduleDocsSync() {
    if (docsSyncTimer.current) clearTimeout(docsSyncTimer.current);
    docsSyncTimer.current = setTimeout(() => { docsSyncTimer.current = null; syncDocsWithGrace(); }, 9000);
  }

  // Load the shown screen's HTML so the canvas renders Grace's REAL generated screen.
  useEffect(() => {
    if (!shownScreen) { setScreenHtml(null); return; }
    // The iframe holds the live truth while editing — never reload the screen being edited. Switching to a
    // DIFFERENT screen ends the edit session and loads normally.
    if (editingRef.current && shownScreen === editingScreenRef.current) return;
    if (editingRef.current) { editingRef.current = false; editingScreenRef.current = ""; setSaveState("idle"); }
    setViewportMetrics((v) => ({ ...v, scrollX: 0, scrollY: 0 }));
    let alive = true;
    setScreenErr("");
    getDesignScreen(shownScreen).then((r) => {
      if (!alive) return;
      if (r.ok && r.html != null) setScreenHtml(r.html);
      else { setScreenHtml(null); setScreenErr(r.error || t("design.toast.screenLoadFail")); }
    });
    return () => { alive = false; };
  }, [allScreens.join("|"), shownScreen]);

  // LIVE PREVIEW: while Grace writes/edits a design-mock screen, re-read it so the canvas fills in
  // progressively (block-by-block per file write), and follow the screen she is actively building.
  useEffect(() => {
    // The iframe is authoritative while the operator edits — don't let a stray live-write re-read clobber it.
    if (editingRef.current) return;
    // Only the IN-PROGRESS build auto-follows the screen Grace is writing. Events from a PERSISTED run are
    // history — re-processing them on every refresh would hijack the screen the operator manually selected.
    const persisted = new Set(msgs.map((m) => m.id));
    const evs = chatEvents.filter((e) => {
      if (e.kind !== "create" && e.kind !== "edit") return false;
      if (persisted.has(e.runId)) return false;
      const rel = toDesignMockRel(e.target || "");
      return rel != null && /^design-mock\/screens\/[^/]+\.html?$/i.test(rel);
    });
    if (!evs.length) return;
    const latest = evs[evs.length - 1];
    if (latest.id === lastScreenEv.current) return;
    lastScreenEv.current = latest.id;
    const path = toDesignMockRel(latest.target || "") as string; // relative design-mock/screens/<name>.html
    setLiveScreens((cur) => (cur.includes(path) ? cur : [...cur, path]));
    setActiveScreen(path);
    // The create/edit event fires on tool_use — BEFORE the CLI actually executes the write. Re-read after a
    // short delay so the new content has landed on disk (an immediate read races ahead and gets stale HTML).
    // Grace just rewrote this screen → drop its manual undo stack so the next baseline reseeds to her version.
    histRef.current.delete(path); setHistVer((v) => v + 1);
    setTimeout(() => { getDesignScreen(path).then((r) => { if (r.ok && r.html != null) { setScreenHtml(r.html); setScreenErr(""); } }); }, 550);
  }, [chatEvents, msgs]);

  // NOTE: `pending` stays true for the WHOLE run (until Grace's message lands / a failure), so the
  // composer's Stop button stays clickable the entire time. The typing "…" placeholder doesn't linger
  // because ChatStream already drops a handle's typing dot once its live run has events (see its
  // typing.filter) — so we must NOT clear `pending` early here, or Stop would flash and vanish.

  // Comments + versions + docs (real rows/files). Reload on mount and whenever Grace posts a new message.
  useEffect(() => {
    let alive = true;
    Promise.all([listDesignComments().catch(() => ({ comments: [] })), listDesignVersions().catch(() => ({ versions: [] })), listDesignDocs().catch(() => ({ docs: [] }))])
      .then(([c, v, d]) => { if (!alive) return; setComments((c as { comments: DComment[] }).comments || []); setVersions((v as { versions: DVersion[] }).versions || []); setDocs((d as { docs: { path: string; label: string }[] }).docs || []); });
    return () => { alive = false; };
  }, [reloadKey]);

  // Chat context occupancy + compaction — the SAME system as the Team Room/DM, scoped to the "design"
  // channel. Auto-compacts at 100%; a Compact button appears under 35% remaining (see ContextDonut).
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
  async function onCompact() {
    if (compacting) return;
    setCompacting(true);
    try { await compactConversation("design"); await loadCtx(); } finally { setCompacting(false); }
  }
  useEffect(() => { if (chatOpen) loadCtx(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [chatOpen, msgs.length]);

  // Docs rail: open a doc → fetch + render its markdown. Default to the first doc when the tab opens.
  function openDoc(path: string) {
    setDocPath(path); setDocBody("");
    void readDesignDoc(path).then((r) => { if (r.ok && r.body != null) setDocBody(r.body); else setDocBody(t("design.docs.readErr")); });
  }
  useEffect(() => {
    if (rail !== "docs" || !docs.length) return;
    if (!docPath || !docs.some((d) => d.path === docPath)) openDoc(docs[0].path);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rail, docs]);

  // Design gate: Ada requested a frontend plan but there's no design yet — kick Grace to set up the foundation
  // ONCE (runs in this request context, which the detached planner job lacks), so the operator lands on a
  // started prototype instead of an empty canvas. Guarded: only when truly empty + not already running.
  const scaffoldKickedRef = useRef(false);
  useEffect(() => {
    // Fire ONCE per held gate: gatePending + not already scaffolded (server marker) + not mid-run. No longer gated on
    // an empty design-mock — a New Work feature scaffolds even though earlier screens exist (scaffoldedAt + ref guard).
    if (!context.gatePending || context.gateScaffolded || scaffoldKickedRef.current || pending) return;
    scaffoldKickedRef.current = true;
    setPending(true);
    void scaffoldDesignFromBrief().then((r) => { if (!r.ok) { setPending(false); scaffoldKickedRef.current = false; } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context.gatePending, context.gateScaffolded]);

  // SAFETY NET for the "Grace is running" lock. `pending` gates every send (`send()` no-ops while true), but it
  // is otherwise cleared ONLY by the live SSE "msg" handler above — so on an SSE reconnect / tab-refocus,
  // loadHistory() repopulates `msgs` WITHOUT firing that handler and `pending` sticks true forever, silently
  // swallowing every further message. Clear it here once Grace's reply is present in `msgs`: for an
  // operator-initiated run her reply id === the run token; for a tokenless auto-run (gate scaffold / handoff),
  // fall back to "the newest message is from the agent". Keyed to the token so it can't race an operator send.
  useEffect(() => {
    if (!pending) return;
    const tok = graceRunToken.current;
    const resolved = tok
      ? msgs.some((m) => m.id === tok && m.fromKind === "agent")
      : msgs.length > 0 && msgs[msgs.length - 1].fromKind === "agent";
    if (resolved) { setPending(false); if (tok) graceRunToken.current = null; }
  }, [msgs, pending]);

  // Canvas ↔ host messages from the instrumented iframe.
  useEffect(() => {
    function onMsg(e: MessageEvent) {
      const m = e.data as (CanvasInMsg & { __cstla?: number }) | undefined;
      if (!m || !m.__cstla) return;
      // Reject when there's no iframe to match against (mount / srcDoc remount / live swap) — the old `&&`
      // form short-circuited to "accept" on a null ref, processing any window's message and crashing on the
      // unguarded payload derefs below.
      if (!iframeRef.current || e.source !== iframeRef.current.contentWindow) return;
      if (m.type === "canvas:viewport") {
        const p = m.payload;
        setViewportMetrics({
          scrollX: Math.max(0, p.scrollX || 0),
          scrollY: Math.max(0, p.scrollY || 0),
          viewportW: Math.max(1, p.viewportW || 1),
          viewportH: Math.max(1, p.viewportH || 1),
          docW: Math.max(1, p.docW || p.viewportW || 1),
          docH: Math.max(1, p.docH || p.viewportH || 1),
        });
      }
      else if (m.type === "canvas:ready") { sendMode(); sendTokens(); const it = !!m.payload?.interactive; interactiveRef.current = it; setInteractive(it); }
      else if (m.type === "canvas:hover") setHover(m.payload);
      else if (m.type === "canvas:guides") setGuides(m.payload);
      else if (m.type === "canvas:tree") setTree(m.payload?.items ?? []);
      else if (m.type === "canvas:nav") { const want = resolveScreenHref(String(m.payload?.href || ""), allScreensRef.current); if (want) { setActiveScreen(want); setSel(null); setMulti([]); setCtxMenu(false); } }
      else if (m.type === "canvas:select") { const s = { ...m.payload, pageId: shownScreenRef.current }; setSel(s); setMulti([s]); setCtxMenu(toolRef.current === "select" || toolRef.current === "edit"); }
      else if (m.type === "canvas:selectToggle") {
        const s = { ...m.payload, pageId: shownScreenRef.current };
        const prev = multiRef.current; const i = prev.findIndex((x) => x.cstlaId === s.cstlaId);
        const next = i >= 0 ? prev.filter((_, j) => j !== i) : [...prev, s];
        setMulti(next); setSel(next.length ? next[next.length - 1] : null); setCtxMenu(false);
      }
      else if (m.type === "canvas:reselect") { const s = { ...m.payload, pageId: shownScreenRef.current }; setSel(s); setMulti((prev) => prev.length ? prev.map((x) => x.cstlaId === s.cstlaId ? s : x) : [s]); }
      else if (m.type === "canvas:reselectMany") { const arr = (m.payload || []).map((p) => ({ ...p, pageId: shownScreenRef.current })); setMulti(arr); setSel(arr.length ? arr[arr.length - 1] : null); }
      else if (m.type === "canvas:removed") { setSel(null); setMulti([]); setCtxMenu(false); }
      else if (m.type === "canvas:dirty") { editingRef.current = true; editingScreenRef.current = shownScreenRef.current; setSaveState("saving"); if (savedTimer.current) { clearTimeout(savedTimer.current); savedTimer.current = null; } }
      else if (m.type === "canvas:editEnd") { editingRef.current = false; setSaveState("idle"); }   // text edit blurred unchanged → drop the "Saving…" indicator
      // Interactive screens (own <script>) are PREVIEW-ONLY: never serialize their runtime DOM back to the file
      // (that bakes in script-generated nodes and re-running the script on reload duplicates them).
      else if (m.type === "canvas:commit") { if (!interactiveRef.current) persist(m.payload.html); }
      else if (m.type === "canvas:history") { if (interactiveRef.current) { setSaveState("idle"); scheduleEditClear(); } else { pushHistory(m.payload.html, m.payload.label); persist(m.payload.html); setPendingUpdate(true); } }
      else if (m.type === "canvas:baseline") { if (!interactiveRef.current) seedBaseline(m.payload.html); }
      else if (m.type === "canvas:comment") setOpenCmt(m.payload);
      else if (m.type === "canvas:markupDraw") setDrawRect(m.payload);
      else if (m.type === "canvas:markup") { const p = m.payload; setDrawRect(p); setOpenCmt({ xpPct: p.xPct, ypPct: p.yPct, markup: { x: p.xPct, y: p.yPct, w: p.wPct, h: p.hPct } }); }
      else if (m.type === "canvas:edit") void onInlineEdit(m.payload.oldText, m.payload.newText);
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push the active tool into the iframe whenever it changes; clear transient overlays on Preview.
  useEffect(() => {
    sendMode();
    setGuides(null);
    if (tool === "preview") { setHover(null); setCtxMenu(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, shownScreen]);

  useEffect(() => {
    setHover(null);
    setGuides(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, shownScreen]);

  // Measure the work area (the fixed container). The iframe is sized to this ÷ zoom so the scaled wrapper paints to
  // fill it exactly. Re-measures on panel/rail/chat/window resize via a ResizeObserver.
  useEffect(() => {
    const el = canvasRef.current; if (!el) return;
    const measure = () => setCanvasSize({ w: Math.max(1, el.clientWidth), h: Math.max(1, el.clientHeight) });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [hasScreen]);

  // Refresh the Layers tree when the tab opens (and when the screen/version changes).
  useEffect(() => { if (rail === "layers") requestTree(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [rail, shownScreen, reloadKey]);

  // Ctrl/⌘+Z undo · Ctrl/⌘+Shift+Z (or Ctrl+Y) redo — unless typing in a field. (undo/redo read live refs.)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const a = document.activeElement as HTMLElement | null;
      if (a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.isContentEditable)) return;
      if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
      else if ((e.ctrlKey || e.metaKey) && (e.key === "y" || e.key === "Y")) { e.preventDefault(); redo(); }
      else if (e.key === "Escape") { setMulti([]); setSel(null); setCtxMenu(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mirror the multi-set into a ref (read by the message handler).
  useEffect(() => { multiRef.current = multi; }, [multi]);

  // ── Styles-panel token controls (drive setPt → live restyle via sendTokens + the debounced setTokens persist) ──
  const patchPt = (patch: Partial<Pt>) => setPt((s) => ({ ...s, ...patch }));
  function tColor(label: string, key: keyof Pt, fallback = "") {
    const val = String(pt[key] ?? "");
    return (<div className="dz-trow" key={String(key)}><label>{label}</label><div className="dz-colorrow">
      <input type="color" value={val || fallback || "#888888"} onChange={(e) => patchPt({ [key]: e.target.value } as Partial<Pt>)} />
      <input type="text" value={val} placeholder={fallback || t("design.styles.auto")} spellCheck={false} onChange={(e) => patchPt({ [key]: e.target.value } as Partial<Pt>)} />
    </div></div>);
  }
  function tRange(label: string, key: keyof Pt, min: number, max: number, step: number, suffix = "") {
    const val = Number(pt[key] ?? 0);
    return (<div className="dz-trow" key={String(key)}><label>{label}<span className="v">{val}{suffix}</span></label>
      <input type="range" min={min} max={max} step={step} value={val} onChange={(e) => patchPt({ [key]: Number(e.target.value) } as Partial<Pt>)} /></div>);
  }
  function sendMode() { try { iframeRef.current?.contentWindow?.postMessage({ __cstlaHost: 1, type: "canvas:setMode", mode: toolRef.current }, "*"); } catch { /* iframe not ready */ } }
  // Live restyle: push the Styles-panel tokens into the iframe so the canvas re-skins instantly (and on every
  // re-render of the iframe, so a live-preview reload keeps the operator's current look).
  function sendTokens() {
    const p = ptRef.current;
    try {
      iframeRef.current?.contentWindow?.postMessage({ __cstlaHost: 1, type: "canvas:applyTokens", tokens: {
        accent: p.accent, accentFg: p.accentFg || readableOn(p.accent),
        secondary: p.secondary, surface: p.surface, success: p.success, warning: p.warning, danger: p.danger,
        font: p.font, headingFont: p.headingFont, fontWeight: p.fontWeight, lineHeight: p.lineHeight, letterSpacing: p.letterSpacing,
        radius: p.radius, borderWidth: p.borderWidth, borderColor: p.borderColor, shadow: p.shadow,
        space: p.density, containerWidth: p.containerWidth, motionMs: p.motionMs, ease: p.ease,
        fontScale: p.fontScale, theme: p.theme,
      } }, "*");
    } catch { /* iframe not ready */ }
  }
  // Hand the operator's raw direct-manipulation edits to Grace: she refactors the inline overrides + transform
  // offsets + data-cstla-* stamps into clean, token-driven, professional CSS (the authoring layer), visually identical.
  function cleanUpWithGrace() {
    const p = shownScreenRef.current;
    if (!p) return;
    void askGrace(`I manually edited the screen ${p} directly on the canvas — it now has inline-style overrides, transform:translate offsets and data-cstla-id/data-cstla-tx attributes added by the visual editor. Refactor it into CLEAN, token-driven, professional CSS per the CSS STANDARD: fold the inline styles into the <style> sheet under semantic BEM-ish classes, turn transform offsets into real layout (flex/grid/margins/gap), drop every data-cstla-* attribute, and keep the screen VISUALLY IDENTICAL. Then summarize what you cleaned up.`);
  }
  // ── Persistence + host-owned undo/redo ───────────────────────────────────────────────────────────
  // The undo stack lives in the HOST, keyed per screen path, so it survives iframe reloads + screen-switches.
  // The iframe emits canvas:baseline (seed) on load and canvas:history (one entry) per discrete action; undo/redo
  // post the chosen snapshot back via canvas:setBody. Grace's autonomous edits reset a screen's stack (her builds
  // live in the Versions rail) — done where her writes land (live-preview effect + agent reconcile).
  function scheduleEditClear() {
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => { editingRef.current = false; editingScreenRef.current = ""; setSaveState("idle"); savedTimer.current = null; }, 1400);
  }
  function persist(html: string) {
    const path = editingScreenRef.current || shownScreenRef.current;
    if (!path) return;
    void commitDesignScreen(path, html).then((r) => {
      if (r.ok) { setSaveState("saved"); setReloadKey((k) => k + 1); }
      else { setSaveState("idle"); toast(r.error || t("design.toast.couldNotSaveEdit")); }
      scheduleEditClear();
    });
  }
  function pushHistory(html: string, label?: string) {
    const path = editingScreenRef.current || shownScreenRef.current; if (!path) return;
    let e = histRef.current.get(path);
    if (!e) { e = { stack: [], labels: [], pos: -1 }; histRef.current.set(path, e); }
    if (e.pos >= 0 && e.stack[e.pos] === html) return;     // no real change
    e.stack = e.stack.slice(0, e.pos + 1); e.labels = e.labels.slice(0, e.pos + 1);
    e.stack.push(html); e.labels.push(label || t("design.history.edited"));
    if (e.stack.length > 60) { e.stack.shift(); e.labels.shift(); }
    e.pos = e.stack.length - 1;
    setHistVer((v) => v + 1);
  }
  function seedBaseline(html: string) {
    const path = shownScreenRef.current; if (!path || histRef.current.has(path)) return; // keep stack across reload/switch
    histRef.current.set(path, { stack: [html], labels: [t("design.history.original")], pos: 0 });
    setHistVer((v) => v + 1);
  }
  function applyHistory(path: string, e: { stack: string[]; labels: string[]; pos: number }) {
    const html = e.stack[e.pos];
    setSel(null); setCtxMenu(false);
    editingRef.current = true; editingScreenRef.current = path; setSaveState("saving");
    if (savedTimer.current) { clearTimeout(savedTimer.current); savedTimer.current = null; }
    try { iframeRef.current?.contentWindow?.postMessage({ __cstlaHost: 1, type: "canvas:setBody", html }, "*"); } catch { /* iframe not ready */ }
    void commitDesignScreen(path, html).then(() => { setSaveState("saved"); setReloadKey((k) => k + 1); scheduleEditClear(); });
    setHistVer((v) => v + 1);
  }
  function undo() { const path = shownScreenRef.current, e = histRef.current.get(path); if (!e || e.pos <= 0) return; e.pos--; applyHistory(path, e); }
  function redo() { const path = shownScreenRef.current, e = histRef.current.get(path); if (!e || e.pos >= e.stack.length - 1) return; e.pos++; applyHistory(path, e); }
  // History panel: jump straight to any recorded state (works with the same per-screen stack as Ctrl+Z / Reset).
  function jumpHistory(i: number) { const path = shownScreenRef.current, e = histRef.current.get(path); if (!e || i < 0 || i >= e.stack.length || i === e.pos) return; e.pos = i; applyHistory(path, e); }
  // Reset = revert to the screen's original state (baseline). Reversible via Redo until the next edit.
  function resetScreen() { const path = shownScreenRef.current, e = histRef.current.get(path); if (!e || e.pos <= 0) return; e.pos = 0; applyHistory(path, e); toast(t("design.toast.reset")); }
  // Save = an explicit, restorable checkpoint in Versions (survives reload), on top of the session history.
  async function saveCheckpoint() {
    const path = shownScreenRef.current; if (!path || !hasScreen) return;
    setBusy(true);
    const r = await saveDesignCheckpoint(path);
    setBusy(false);
    if (r.ok) { toast(t("design.toast.savedCheckpoint", { label: r.label ?? "" })); setReloadKey((k) => k + 1); }
    else toast(r.error || t("design.toast.couldNotSaveCheckpoint"));
  }

  async function onInlineEdit(oldText: string, newText: string) {
    const path = shownScreenRef.current;
    if (!path || oldText === newText) return;
    const r = await applyDesignTextEdit(path, oldText, newText);
    if (r.ok) { const g = await getDesignScreen(path); if (g.ok && g.html != null) setScreenHtml(g.html); toast(t("design.toast.editApplied")); }
    else { toast(t("design.toast.sendingEdit")); void askGrace(`On screen ${path}, change the text "${oldText}" to "${newText}".`); }
  }

  function toast(text: string) { setFlash(text); setTimeout(() => setFlash((f) => (f === text ? "" : f)), 2400); }

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

  // Generate the run token up front and OWN it before the call (like the room/DM chat) so Stop has a
  // handle from the instant Grace starts — no window where the click lands before the server echoes an id.
  function askGrace(prompt: string, attachments?: Att[], selection?: CanvasSelection) {
    const token = newRunToken();
    graceRunToken.current = token;
    setPending(true);
    return askDesign(prompt, attachments, selection, token)
      .then((r) => {
        if (!r.ok) { toast(r.error || t("design.toast.couldNotStart")); setPending(false); if (graceRunToken.current === token) graceRunToken.current = null; }
        return r;
      });
  }
  // `override` lets a suggestion chip send immediately; `attached` scopes Grace to the selected element.
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
    setCancelledRunIds((cur) => {
      const next = new Set(cur);
      next.add(token);
      return next;
    });
    setChatEvents((cur) => cur.filter((e) => e.runId !== token));
    setPending(false);
    void cancelRunClient(token);
  }
  async function approve() {
    setBusy(true);
    const r = await approveDesign();
    setBusy(false);
    if (!r.ok) { toast(r.error || t("design.toast.approveFailed")); return; }
    setStateMode("approved"); toast(t("design.toast.designApproved")); router.refresh();
  }
  // Send to execution: approve → Grace writes the COMPLETE handoff docs live → the CEO is auto-activated when she's
  // done (New Work / first plan). Stay in Design so the operator watches Grace write the docs (chat + Docs tab).
  async function sendToExecution() {
    setBusy(true);
    const r = await handoffToExecution();
    setBusy(false);
    if (!r.ok) { toast(r.error || t("design.toast.couldNotSendExec")); return; }
    setStateMode("approved"); setPendingUpdate(false); setPending(true); setRail("docs");
    toast(t("design.toast.sentToExec"));
  }
  // Resume an interrupted handoff (crash / failed docs run left it pending) — re-runs Grace's docs → CEO.
  async function resumeHandoff() {
    setBusy(true);
    const r = await resumeDesignHandoff();
    setBusy(false);
    if (!r.ok) { toast(r.error || "Couldn't resume the handoff."); return; }
    setPending(true); setRail("docs");
    toast("Resuming handoff — Grace is finishing the documentation, then Ada plans it.");
  }
  async function buildProduction() {
    setBusy(true);
    const r = await buildDesignProduction();
    setBusy(false);
    if (!r.ok) { toast(r.error || t("design.toast.buildFailed")); return; }
    const before = r.built.reduce((s, b) => s + b.before, 0);
    const after = r.built.reduce((s, b) => s + b.after, 0);
    const pct = before ? Math.round((1 - after / before) * 100) : 0;
    const obf = r.built.filter((b) => b.obfuscated).length;
    toast(t("design.toast.built", { count: r.built.length, plural: r.built.length === 1 ? "" : "s", pct, obf: obf ? t("design.toast.builtObf", { n: obf }) : "" }));
    router.refresh();
  }
  async function submitComment(sendToGrace = false) {
    if (!openCmt) { setOpenCmt(null); setCmtText(""); setDrawRect(null); return; }
    // Markup region: the note is OPTIONAL — drawing the region is itself the action, so always persist it.
    if (openCmt.markup) {
      const note = cmtText.trim();
      const rect = openCmt.markup;
      await addDesignMarkup(shownScreenRef.current, rect, note);
      setOpenCmt(null); setCmtText(""); setDrawRect(null); setReloadKey((k) => k + 1); setRail("comments");
      // "Mark & ask Grace": persist the region, then hand it straight to Grace on the design channel.
      if (sendToGrace) { const loc = describeRegion(rect); void askGrace(`On screen ${shownScreenRef.current}, I marked a region for review (${loc}).${note ? ` My note: "${note}"` : " Please review and refine it."} Update the screen accordingly.`); }
      return;
    }
    // Point comment: requires text.
    if (!cmtText.trim()) { setOpenCmt(null); setCmtText(""); return; }
    // Attach the element the comment was pinned on (captured at click), so "Ask Grace to address" can edit
    // exactly that element instead of guessing from the comment text.
    const cs = openCmt.selection ?? sel;
    const csFixed = cs ? { ...cs, pageId: shownScreenRef.current } : undefined;
    await addDesignComment(shownScreenRef.current, openCmt.xpPct, openCmt.ypPct, cmtText.trim(), csFixed);
    setOpenCmt(null); setCmtText(""); setReloadKey((k) => k + 1); setRail("comments");
  }
  // ── Zoom: discrete 50/75/100 — host-side scaling (the iframe renders at work-area ÷ z, the .dz-art wrapper is
  //    transform:scale(z) so the page fills + reflows like browser zoom; see the canvas JSX + derived block) ──────

  function requestTree() { try { iframeRef.current?.contentWindow?.postMessage({ __cstlaHost: 1, type: "canvas:requestTree" }, "*"); } catch { /* iframe not ready */ } }
  function selectNode(path: string) { try { iframeRef.current?.contentWindow?.postMessage({ __cstlaHost: 1, type: "canvas:selectByPath", path }, "*"); } catch { /* iframe not ready */ } }

  // Suggestions: only on a fresh chat (starters) or right after Grace replies; vanish once you send.
  const lastByTime = [...msgs].sort((a, b) => (a.createdAt ? new Date(a.createdAt).getTime() : 0) - (b.createdAt ? new Date(b.createdAt).getTime() : 0)).at(-1);
  const showSuggest = !pending && (msgs.length === 0 || lastByTime?.fromKind === "agent");
  const suggestions = showSuggest ? buildSuggestions(msgs, context, t) : [];

  const graceAgent: Agent | null = grace
    ? { id: grace.id, handle: grace.handle, name: grace.name, role: "Frontend", color: grace.color, image: grace.image ?? null, adapter: "claude", status: "idle", health: null }
    : null;
  const chatAgents = graceAgent ? [graceAgent] : [];
  const byRun: Record<string, Ev[]> = {};
  for (const e of chatEvents) (byRun[e.runId] ??= []).push(e);
  const msgIds = new Set(msgs.map((m) => m.id));
  const liveRuns = Object.entries(byRun).filter(([rid]) => !msgIds.has(rid) && !cancelledRunIds.has(rid)) as [string, Ev[]][];
  const building = pending || liveRuns.length > 0;

  const screenComments = comments.filter((c) => c.pageKey === shownScreen && !isMarkup(c));
  const screenMarkups = comments.filter((c) => c.pageKey === shownScreen && isMarkup(c));
  // Each tab carries its key + a translated label (Comments/Versions append a live count).
  const railTabs: [string, string][] = [];
  // The design is a REFERENCE that must stay faithful to the approved mock, so the canvas has NO add/move/resize
  // or structural manipulation — Edit mode is text-only. The Element + Add tabs (which drove that) are removed.
  // The design system is still tunable live via the Styles tab.
  railTabs.push(["layers", t("design.tab.layers")], ["screens", t("design.tab.screens")], ["docs", t("design.tab.docs")], ["styles", t("design.tab.styles")], ["history", t("design.tab.history")], ["comments", `${t("design.tab.comments")}${screenComments.length ? " " + screenComments.length : ""}`], ["versions", `${t("design.tab.versions")}${versions.length ? " " + versions.length : ""}`]);
  const railSel = railTabs.some(([k]) => k === rail) ? rail : "screens"; // fall back when the active tab isn't available (e.g. left Edit mode)
  const hoverVisual = hover ? rectToVisual(hover) : null;
  const selVisual = sel ? rectToVisual(sel.boundingBox) : null;

  return (
    <div className="dz-wrap">
      {/* ── Left: the real frontend-agent chat (collapsible) ── */}
      {chatOpen ? (
      <div className="dz-chat">
        <div className="dz-chat-head">
          <Avatar name={grace?.name || "Grace"} color={grace?.color || "#84aef5"} image={grace?.image} size={28} />
          <div><div className="dz-ch-t">{grace?.name || "Grace"} · {t("design.chat.role")}</div><div className="dz-ch-s">{t("design.chat.subtitle")}</div></div>
          {building && <span className="dz-live"><span className="dot" /> {t("design.chat.live")}</span>}
          <button className="dz-collapse-btn" title={t("design.chat.collapse")} onClick={() => setChatOpen(false)}><Icon name="chevronLeft" size={15} /></button>
        </div>
        {ctx && <div className="ctx-bar"><ContextDonut stat={ctx} onCompact={onCompact} compacting={compacting} /><span /></div>}
        <ChatStream
          msgs={msgs}
          typing={pending && graceAgent ? [graceAgent.handle] : []}
          agents={chatAgents}
          byRun={byRun}
          liveRuns={liveRuns}
          loading={chatLoading}
          markdownAgent
          avatarSize={28}
          emptyHint={t("design.chat.emptyHint")}
        />
        <div className={"dz-composer" + (drag ? " drag" : "")}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={(e) => { e.preventDefault(); setDrag(false); }}
          onDrop={(e) => { e.preventDefault(); setDrag(false); void pickFiles(e.dataTransfer.files); }}>
          {!approved && suggestions.length > 0 && !attached && <div className="dz-chips">{suggestions.map((c) => <span className="dz-chip" key={c.label} onClick={() => send(c.prompt)}>{c.label}</span>)}</div>}
          {attached && (
            <div className="dz-attach">
              <span className="sw" style={{ background: pt.accent }} /> {t("design.composer.elementLabel")} <b style={{ fontWeight: 700 }}>{attached.componentName}</b>
              <span className="x" onClick={() => setAttached(null)}><Icon name="close" size={12} /></span>
            </div>
          )}
          {upErr && <div className="dz-uperr">{upErr}</div>}
          {atts.length > 0 && (
            <div className="dz-atts">
              {atts.map((a, i) => (
                <span className="dz-att" key={a.path}>
                  {a.type.startsWith("image/") && <img src={`/api/upload?path=${encodeURIComponent(a.path)}`} alt="" />}
                  <span className="nm">{a.name}</span>
                  <span className="rm" title={t("design.composer.remove")} onClick={() => setAtts((x) => x.filter((_, j) => j !== i))}><Icon name="close" size={11} /></span>
                </span>
              ))}
            </div>
          )}
          <div className="dz-input">
            <button className="dz-clip" disabled={pending || uploading} title={t("design.composer.attach")} onClick={() => fileRef.current?.click()}>
              <Icon name={uploading ? "refresh" : "add"} size={15} className={uploading ? "sync-spin" : ""} />
            </button>
            <input placeholder={attached ? t("design.composer.changePlaceholder", { name: attached.componentName }) : t("design.composer.placeholder")} value={msg} disabled={pending}
              onChange={(e) => setMsg(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} onPaste={onPaste} />
            {pending ? (
              <button className="dz-send" style={{ background: "var(--sx-keyword)", borderColor: "var(--sx-keyword)" }} onClick={stopGrace} title={t("chat.stop")}><Icon name="close" size={15} /></button>
            ) : (
              <button className="dz-send" disabled={!msg.trim() && !atts.length && !attached} onClick={() => send()}><Icon name="send" size={15} /></button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*,.pdf" multiple style={{ display: "none" }} onChange={(e) => pickFiles(e.target.files)} />
        </div>
      </div>
      ) : (
        <div className="dz-strip left" onClick={() => openGraceDm()} title="Chat with Grace — opens her DM (builds this canvas)">
          <Icon name="chat" size={16} />
          {building && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent)" }} />}
        </div>
      )}

      {/* ── Center: the live, interactive canvas ── */}
      <div className="dz-center">
        {context.handoffPending && (
          <div className="dz-approve-banner" style={{ background: "linear-gradient(90deg,rgba(224,164,78,.20),rgba(224,164,78,.03))" }}>
            <div className="dz-ab-ic" style={{ background: "rgba(224,164,78,.22)", color: "var(--accent)" }}><Icon name={building ? "refresh" : "warn"} size={17} className={building ? "sync-spin" : ""} /></div>
            <div><div className="dz-ab-t">{building ? t("design.handoff.finishing") : t("design.handoff.interrupted")}</div><div className="dz-ab-s">{building ? t("design.handoff.finishingSub") : t("design.handoff.interruptedSub")}</div></div>
            {!building && <div className="dz-ab-actions"><button className="dz-mini-btn accent" disabled={busy} onClick={resumeHandoff}><Icon name={busy ? "refresh" : "sync"} size={13} className={busy ? "sync-spin" : ""} /> {t("design.handoff.resume")}</button></div>}
          </div>
        )}
        {/* Terminal: already handed off + promoted — Ada is building on this design. The operator keeps iterating with
            Grace; an edit since the last send flips the button to "Send update" (flows as an apply-update, never a rebuild). */}
        {context.handoffDone && !context.handoffPending && (
          <div className="dz-approve-banner" style={{ background: pendingUpdate ? "linear-gradient(90deg,rgba(224,164,78,.22),rgba(224,164,78,.03))" : "linear-gradient(90deg,rgba(74,165,114,.20),rgba(74,165,114,.03))" }}>
            <div className="dz-ab-ic" style={{ background: pendingUpdate ? "rgba(224,164,78,.22)" : "rgba(74,165,114,.22)", color: pendingUpdate ? "var(--accent)" : "#3fa971" }}><Icon name={pendingUpdate ? "edit" : "goto"} size={17} /></div>
            <div><div className="dz-ab-t">{pendingUpdate ? "Design updated · send it to Ada" : "Handed off to execution · Ada is building"}</div><div className="dz-ab-s">{pendingUpdate ? "You edited the design after the last hand-off — send the update so Ada applies it on top (backend wiring preserved)." : "This design is the real frontend. Keep refining it with Grace — re-send to push an update (engineers&apos; backend wiring is preserved)."}</div></div>
            <div className="dz-ab-actions"><button className={"dz-mini-btn accent" + (pendingUpdate ? " dz-pulse" : "")} disabled={busy} onClick={sendToExecution}><Icon name={busy ? "refresh" : pendingUpdate ? "goto" : "sync"} size={13} className={busy ? "sync-spin" : ""} /> {pendingUpdate ? "Send update to execution" : "Re-send update"}</button></div>
          </div>
        )}
        {approved && !context.handoffPending && !context.handoffDone && (
          <div className="dz-approve-banner">
            <div className="dz-ab-ic"><Icon name={pendingUpdate ? "edit" : "check"} size={17} /></div>
            <div><div className="dz-ab-t">{pendingUpdate ? "Design updated · ready to send" : t("design.banner.approvedTitle")}</div><div className="dz-ab-s">{pendingUpdate ? "You edited the approved design — send it to execution to push the update." : t("design.banner.approvedSub")}</div></div>
            <div className="dz-ab-actions"><button className={"dz-mini-btn accent" + (pendingUpdate ? " dz-pulse" : "")} disabled={busy} onClick={sendToExecution}><Icon name={busy ? "refresh" : "goto"} size={13} className={busy ? "sync-spin" : ""} /> {pendingUpdate ? "Send update to execution" : t("design.banner.sendToExecution")}</button></div>
          </div>
        )}
        {!approved && context.gatePending && (
          <div className="dz-approve-banner" style={{ background: "linear-gradient(90deg,rgba(99,102,241,.16),rgba(99,102,241,.02))" }}>
            <div className="dz-ab-ic" style={{ background: "rgba(99,102,241,.18)", color: "#6366f1" }}><Icon name="bot" size={17} /></div>
            <div><div className="dz-ab-t">{t("design.banner.adaWaitingTitle")}</div><div className="dz-ab-s">{t("design.banner.adaWaitingPre")} <b>{t("design.banner.adaWaitingAction")}</b> {t("design.banner.adaWaitingPost")} {building ? t("design.banner.gridSettingUp") : t("design.banner.gridStart")}</div></div>
            <div className="dz-ab-actions">
              <button className="dz-mini-btn" disabled={pending} onClick={() => { setPending(true); void scaffoldDesignFromBrief().then((r) => { if (!r.ok) setPending(false); }); }}><Icon name={pending ? "refresh" : "skill"} size={13} className={pending ? "sync-spin" : ""} /> {t("design.banner.setUpWithGrace")}</button>
              <button className="dz-mini-btn" disabled={busy} onClick={() => { setBusy(true); void skipDesignGate().then(() => generatePlan()).then(() => { setBusy(false); router.refresh(); }); }}><Icon name={busy ? "refresh" : "goto"} size={13} className={busy ? "sync-spin" : ""} /> {t("design.banner.skipAndContinue")}</button>
            </div>
          </div>
        )}
        {/* toolbar */}
        <div className="dz-bar">
          <div className="dz-modes">
            {MODES.map((m) => <span key={m.id} className={"dz-mode " + (tool === m.id ? "on" : "")} onClick={() => setTool(m.id)} title={t("design.mode." + m.id)}><Icon name={m.ic} size={13} /> {t("design.mode." + m.id)}</span>)}
          </div>
          {allScreens.length > 0 && (
            <div className="dz-seg">
              <button onClick={undo} disabled={!canUndo} title={t("design.toolbar.undo")}><Icon name="chevronLeft" size={13} /></button>
              <button onClick={redo} disabled={!canRedo} title={t("design.toolbar.redo")}><Icon name="chevronRight" size={13} /></button>
              <button onClick={resetScreen} disabled={!canUndo} title={t("design.toolbar.resetTitle")}><Icon name="repeat" size={13} /> {t("design.toolbar.reset")}</button>
              <button onClick={saveCheckpoint} disabled={busy || !hasScreen} title={t("design.toolbar.saveTitle")}><Icon name="check" size={13} /> {t("design.toolbar.save")}</button>
              <button onClick={cleanUpWithGrace} title={t("design.toolbar.cleanUpTitle")}><Icon name="skill" size={13} /> {t("design.toolbar.cleanUp")}</button>
            </div>
          )}
          <div className="dz-spacer" />
          <div className="dz-seg">
            {[50, 75, 100].map((p) => (
              <button key={p} className={zoom === p ? "on" : ""} onClick={() => setZoom(p)} title={t("design.toolbar.zoom", { pct: p })}>{p}%</button>
            ))}
          </div>
          <div className="dz-seg">
            <button className={vp === "desktop" && customW == null ? "on" : ""} onClick={() => { setVp("desktop"); setCustomW(null); }} title={t("design.toolbar.desktop")}><Icon name="sidebarIcon" size={13} /></button>
            <button className={vp === "tablet" && customW == null ? "on" : ""} onClick={() => { setVp("tablet"); setCustomW(null); }} title={t("design.toolbar.tabletTitle")}>{t("design.toolbar.tablet")}</button>
            <button className={vp === "mobile" && customW == null ? "on" : ""} onClick={() => { setVp("mobile"); setCustomW(null); }} title={t("design.toolbar.mobileTitle")}>{t("design.toolbar.mobile")}</button>
            <input className="dz-bpw" type="number" min={320} max={1920} placeholder="px" value={customW ?? ""} title={t("design.toolbar.customWidth")}
              onChange={(e) => { const v = parseInt(e.target.value, 10); setCustomW(Number.isFinite(v) && v > 0 ? Math.max(320, Math.min(1920, v)) : null); }} />
          </div>
          <div className="dz-seg">
            <button className={pt.theme === "dark" ? "on" : ""} onClick={() => setPt((p) => ({ ...p, theme: "dark" }))} title={t("design.toolbar.dark")}><Icon name="moon" size={13} /></button>
            <button className={pt.theme === "light" ? "on" : ""} onClick={() => setPt((p) => ({ ...p, theme: "light" }))} title={t("design.toolbar.light")}><Icon name="sun" size={13} /></button>
          </div>
          <div className="dz-seg" title={t("design.mode2.tip")}>
            <button className={!liveMode ? "on" : ""} onClick={() => setLiveMode(false)}><Icon name="grid" size={13} /> {t("design.mode2.design")}</button>
            <button className={liveMode ? "on" : ""} onClick={() => setLiveMode(true)}><Icon name="play" size={13} /> {t("design.mode2.live")}</button>
          </div>
          {interactive ? (
            <span className="dz-save preview" title={t("design.toolbar.previewOnlyTitle")}>
              <Icon name="play" size={12} /> {t("design.toolbar.previewOnly")}
            </span>
          ) : saveState !== "idle" && (
            <span className={"dz-save " + saveState} title={saveState === "saving" ? t("design.toolbar.savingTitle") : t("design.toolbar.savedTitle")}>
              <Icon name={saveState === "saving" ? "refresh" : "check"} size={12} className={saveState === "saving" ? "sync-spin" : ""} /> {saveState === "saving" ? t("design.toolbar.saving") : t("design.toolbar.saved")}
            </span>
          )}
          <button className="dz-mini-btn" onClick={() => setShowExport(true)}><Icon name="arrowDown" size={13} /> {t("design.toolbar.export")}</button>
          <button className="dz-mini-btn accent" disabled={busy} onClick={approve} title={approved ? "Re-approve the current design as the official reference" : undefined}><Icon name="check" size={13} /> {approved ? "Approve changes" : t("design.toolbar.approve")}</button>
        </div>
        {/* page strip + mode hint */}
        {allScreens.length > 0 && (
          <div className="dz-pagestrip">
            <div className="dz-ptabs">
              {allScreens.slice(0, 8).map((p) => (
                <span key={p} className={"dz-ptab " + (shownScreen === p ? "active" : "")} onClick={() => { setActiveScreen(p); setSel(null); setCtxMenu(false); }}><Icon name="grid" size={13} /> {screenName(p)}</span>
              ))}
            </div>
            <span className="dz-hint"><Icon name={MODES.find((m) => m.id === tool)!.ic} size={12} /> {tool === "edit" ? "Click to select · double-click to edit text (the design stays faithful to the mock — no move/resize/add)" : tool === "select" ? "Click to select an element · switch to Edit to edit its text" : t("design.hint." + tool)}</span>
          </div>
        )}
        <div className={"dz-canvas" + (hasScreen ? ` has-screen ${isFramed ? "framed" : "desktop"}` : "")} ref={canvasRef}>
              {liveMode && <LiveAppCanvas onAskGrace={(text) => send(text)} asking={pending} />}
              {hasScreen ? (
                <div className="dz-artwrap" style={{ width: artW * z, height: artH * z }}>
                 <div className="dz-art" data-viewport={vp} style={{ width: artW, height: artH, transform: `scale(${z})`, transformOrigin: "top left" }}>
                  <iframe ref={iframeRef} title={t("design.canvas.previewTitle")} sandbox="allow-scripts" srcDoc={instrumentScreen(screenHtml ?? "")} onLoad={() => { sendMode(); sendTokens(); }}
                    style={{ width: "100%", height: "100%", border: "none", background: "#fff", display: "block" }} />
                  {/* overlay — inside the artboard, so iframe-internal-px boxes and %-pins scale in lockstep with the screen */}
                  <div className="dz-ovl">
                    {guides && tool === "edit" && <>
                      {guides.v.map((x, i) => <div className="dz-guide v" key={"gv" + i} style={{ left: toVisualX(x) }} />)}
                      {guides.h.map((y, i) => <div className="dz-guide h" key={"gh" + i} style={{ top: toVisualY(y) }} />)}
                    </>}
                    {hover && hoverVisual && !sel && tool !== "preview" && tool !== "markup" && tool !== "comments" && (
                      <div className="dz-hl" style={hoverVisual}><span className="tag">{hover.label}</span></div>
                    )}
                    {tool !== "preview" && multi.map((s) => (
                      <div className="dz-selbox" key={s.cstlaId} style={rectToVisual(s.boundingBox)} />
                    ))}
                    {screenMarkups.map((c) => <div className="dz-mk" key={c.id} style={pctRectToVisual(markupRect(c))} />)}
                    {drawRect && <div className="dz-mk" style={pctRectToVisual({ x: drawRect.xPct, y: drawRect.yPct, w: drawRect.wPct, h: drawRect.hPct })} />}
                    {screenComments.map((c, i) => <div className="dz-pin" key={c.id} style={pctPointToVisual(c.xp, c.yp)} onClick={(e) => { e.stopPropagation(); setRail("comments"); }}>{i + 1}</div>)}
                  </div>
                 </div>
                  {/* chrome — outside the scaled artboard, so it stays full UI size; logical anchors are *z into painted px */}
                  {ctxMenu && sel && selVisual && tool !== "preview" && multi.length <= 1 && (
                    <div className="dz-ctx" style={{ left: Math.max(6, selVisual.left * z), top: Math.max(4, selVisual.top * z - 40) }} onClick={(e) => e.stopPropagation()}>
                      <button className="ask" onClick={() => { if (sel) openGraceDm(undefined, sel); setCtxMenu(false); }}><Icon name="bot" size={13} /> {t("design.ctx.askFront")}</button>
                      <button onClick={() => setCtxMenu(false)}><Icon name="close" size={13} /></button>
                    </div>
                  )}
                  {/* pending comment popover */}
                  {openCmt && (
                    <div className="dz-cpop" style={clampPopover(openCmt.xpPct, openCmt.ypPct)} onClick={(e) => e.stopPropagation()}>
                      <textarea rows={3} autoFocus placeholder={openCmt.markup ? t("design.cmt.markupPlaceholder") : t("design.cmt.pointPlaceholder")} value={cmtText} onChange={(e) => setCmtText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void submitComment(); } }} />
                      {openCmt.markup ? (
                        <div className="row" style={{ flexDirection: "column", alignItems: "stretch" }}>
                          <button className="dz-mini-btn accent" style={{ justifyContent: "center" }} onClick={() => submitComment(true)}><Icon name="bot" size={12} /> {t("design.cmt.markAskGrace")}</button>
                          <button className="dz-mini-btn" style={{ justifyContent: "center" }} onClick={() => submitComment(false)}>{t("design.cmt.markRegion")}</button>
                          <button className="dz-mini-btn" style={{ justifyContent: "center" }} onClick={() => { setOpenCmt(null); setCmtText(""); setDrawRect(null); }}>{t("design.cmt.cancel")}</button>
                        </div>
                      ) : (
                        <div className="row">
                          <button className="dz-mini-btn" onClick={() => { setOpenCmt(null); setCmtText(""); setDrawRect(null); }}>{t("design.cmt.cancel")}</button>
                          <button className="dz-mini-btn accent" onClick={() => submitComment()}>{t("design.cmt.comment")}</button>
                        </div>
                      )}
                    </div>
                  )}
                  {building && <div className="dz-build-bar"><Icon name="skill" size={13} /> {t("design.canvas.working")} <span className="sh" /></div>}
                </div>
              ) : (
                <div className="dz-emptywrap">{screenErr ? (
                <div className="dz-empty"><div className="ic"><Icon name="error" size={22} /></div><div className="t">{t("design.empty.loadErrTitle")}</div><div className="s">{screenErr}</div></div>
              ) : allScreens.length === 0 && componentFiles.length > 0 ? (
                <div className="dz-empty">
                  <div className="ic"><Icon name="doc" size={22} /></div>
                  <div className="t">{t("design.empty.componentsTitle", { count: componentFiles.length, plural: componentFiles.length > 1 ? "s" : "" })}</div>
                  <div className="s">{t("design.empty.componentsBody")}</div>
                </div>
              ) : (
                <div className="dz-empty">
                  <div className="ic"><Icon name="grid" size={22} /></div>
                  <div className="t">{t("design.empty.noPrototypeTitle")}</div>
                  <div className="s">{t("design.empty.noPrototypePre")} <span className="mono">design-mock/</span>. {t("design.empty.noPrototypePost")}</div>
                </div>
              )}</div>
              )}
        </div>
      </div>

      {/* ── Right rail (collapsible) ── */}
      {railOpen ? (
      <div className="dz-rail">
        <div className="dz-rail-tabs">
          {railTabs.map(([k, label]) => (
            <div key={k} className={"dz-rt " + (railSel === k ? "active" : "")} onClick={() => setRail(k)}>{label}</div>
          ))}
          <button className="dz-collapse-btn" title={t("design.rail.collapse")} onClick={() => setRailOpen(false)}><Icon name="chevronRight" size={15} /></button>
        </div>
        <div className="dz-rail-body">
          {railSel === "layers" && <>
            <div className="dz-sec">{t("design.layers.title")}</div>
            {!hasScreen ? <div style={{ fontSize: 11.5, color: "var(--text-dim)", lineHeight: 1.5 }}>{t("design.layers.openScreen")}</div>
              : tree.length === 0 ? <div style={{ fontSize: 11.5, color: "var(--text-dim)", lineHeight: 1.5 }}>{t("design.layers.reading")}</div>
                : tree.map((n) => (
                  <div key={n.path} className={"dz-layer" + (sel?.nodePath === n.path ? " active" : "")} style={{ paddingLeft: 8 + n.depth * 11 }}
                    onClick={() => selectNode(n.path)} title={`<${n.tag}>`}>
                    <Icon name={n.kids > 0 ? "grid" : "dot"} size={10} />
                    <span className="lt">{n.label}</span>
                    <span className="lg">{n.tag}{n.kids > 0 ? ` · ${n.kids}` : ""}</span>
                  </div>
                ))}
          </>}

          {railSel === "screens" && <>
            <div className="dz-sec">{t("design.screens.title")}</div>
            {allScreens.length === 0
              ? <div style={{ fontSize: 11.5, color: "var(--text-dim)", lineHeight: 1.5 }}>{t("design.screens.empty")}</div>
              : allScreens.map((p) => (
                <div key={p} className={"dz-row " + (shownScreen === p ? "active" : "")} onClick={() => { setActiveScreen(p); setSel(null); setCtxMenu(false); }}>
                  <div className="dz-r-ic"><Icon name="grid" size={14} /></div>
                  <div style={{ minWidth: 0 }}><div className="dz-r-t">{screenName(p)}</div><div className="dz-r-s">{p.replace(/^design-mock\//, "")}</div></div>
                  {shownScreen === p && <span className="dz-r-meta">{t("design.screens.active")}</span>}
                </div>
              ))}
            <div className="dz-addrow" onClick={() => send("Build a new screen for the prototype.")}><Icon name="add" size={13} /> {t("design.screens.newScreen")}</div>
            {componentFiles.length > 0 && <>
              <div className="dz-sec" style={{ marginTop: 16 }}>{t("design.screens.components", { count: componentFiles.length })}</div>
              <div className="dz-comp-grid">
                {componentFiles.slice(0, 8).map((c, i) => (
                  <div className="dz-comp" key={c}>
                    <div style={{ height: 30, borderRadius: 7, background: i % 2 ? hexA(pt.accent, .16) : "var(--bg-app)", border: "1px solid var(--border)", display: "grid", placeItems: "center", color: "var(--accent)", fontSize: 12 }}>◧</div>
                    <div className="nm">{(c.split("/").pop() || c).replace(/\.[a-z]+$/i, "")}</div>
                  </div>
                ))}
              </div>
            </>}
          </>}

          {railSel === "docs" && <>
            <div className="dz-sec">{t("design.docs.title")}</div>
            {docs.length === 0
              ? <div style={{ fontSize: 11.5, color: "var(--text-dim)", lineHeight: 1.5 }}>{t("design.docs.empty")}</div>
              : <>
                <div className="dz-docnav">
                  {docs.map((d) => (
                    <div key={d.path} className={"dz-doctab " + (docPath === d.path ? "active" : "")} onClick={() => openDoc(d.path)} title={d.label}>
                      <Icon name={/APPROVED/i.test(d.path) ? "check" : "doc"} size={12} /><span>{d.label}</span>
                    </div>
                  ))}
                </div>
                <div className="dz-docbody md">
                  {docBody ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{docBody}</ReactMarkdown> : <div style={{ fontSize: 11.5, color: "var(--text-dim)" }}>{t("design.docs.reading")}</div>}
                </div>
              </>}
          </>}

          {railSel === "styles" && <>
            <div className="dz-sec">{t("design.styles.palette")}</div>
            <div className="dz-swatches">{PALETTES.map((p) => <span key={p.name} title={p.name} className={"dz-sw " + (pt.accent === p.c ? "on" : "")} style={{ background: p.c }} onClick={() => patchPt({ accent: p.c, accentName: p.name })} />)}</div>
            {tColor(t("design.styles.accentCustom"), "accent")}
            {tColor(t("design.styles.secondary"), "secondary")}
            {tColor(t("design.styles.surface"), "surface")}
            <details className="dz-adv"><summary>{t("design.styles.semanticColors")}</summary>
              {tColor(t("design.styles.success"), "success", "#10b981")}
              {tColor(t("design.styles.warning"), "warning", "#f59e0b")}
              {tColor(t("design.styles.danger"), "danger", "#ef4444")}
              {tColor(t("design.styles.accentText"), "accentFg")}
            </details>

            <div className="dz-sec" style={{ marginTop: 18 }}>{t("design.styles.typography")}</div>
            <div className="dz-sub">{t("design.styles.bodyFont")}</div>
            <div className="dz-opt">{FONTS.map((f) => <span key={f.n} className={"dz-pill2 " + (pt.fontName === f.n ? "on" : "")} onClick={() => patchPt({ font: f.s, fontName: f.n })}>{f.n}</span>)}</div>
            <div className="dz-sub">{t("design.styles.headingFont")}</div>
            <div className="dz-opt">{FONTS.map((f) => <span key={f.n} className={"dz-pill2 " + (pt.headingFontName === f.n ? "on" : "")} onClick={() => patchPt({ headingFont: f.s, headingFontName: f.n })}>{f.n}</span>)}</div>
            {tRange(t("design.styles.weight"), "fontWeight", 300, 800, 100)}
            {tRange(t("design.styles.lineHeight"), "lineHeight", 1, 2, 0.05)}
            {tRange(t("design.styles.letterSpacing"), "letterSpacing", -1, 4, 0.1, "px")}
            <div className="dz-sub">{t("design.styles.textSize")}</div>
            <div className="dz-opt">{([[t("design.styles.sizeSmall"), 0.9], [t("design.styles.sizeDefault"), 1], [t("design.styles.sizeLarge"), 1.15]] as [string, number][]).map(([n, f]) => <span key={n} className={"dz-pill2 " + (pt.fontScale === f ? "on" : "")} onClick={() => patchPt({ fontScale: f })}>{n}</span>)}</div>

            <div className="dz-sec" style={{ marginTop: 18 }}>{t("design.styles.shapeDepth")}</div>
            <div className="dz-opt">{RADII.map((r) => <span key={r.n} className={"dz-pill2 " + (pt.radius === r.r ? "on" : "")} onClick={() => patchPt({ radius: r.r })}>{t("design.styles.radius" + r.n)}</span>)}</div>
            {tRange(t("design.styles.radius"), "radius", 0, 32, 1, "px")}
            {tRange(t("design.styles.borderWidth"), "borderWidth", 0, 4, 1, "px")}
            {tColor(t("design.styles.borderColor"), "borderColor")}
            <div className="dz-sub">{t("design.styles.shadow")}</div>
            <div className="dz-opt">{(["none", "sm", "md", "lg"] as const).map((sh) => <span key={sh} className={"dz-pill2 " + (pt.shadow === sh ? "on" : "")} onClick={() => patchPt({ shadow: sh })}>{sh === "none" ? t("design.styles.shadowNone") : sh.toUpperCase()}</span>)}</div>

            <div className="dz-sec" style={{ marginTop: 18 }}>{t("design.styles.theme")}</div>
            <div className="dz-opt">
              <span className={"dz-pill2 " + (pt.theme === "dark" ? "on" : "")} onClick={() => patchPt({ theme: "dark" })}>{t("design.styles.dark")}</span>
              <span className={"dz-pill2 " + (pt.theme === "light" ? "on" : "")} onClick={() => patchPt({ theme: "light" })}>{t("design.styles.light")}</span>
            </div>

            <div className="dz-sec" style={{ marginTop: 18 }}>{t("design.styles.spacingLayoutMotion")}</div>
            <div className="dz-opt">{([[t("design.styles.densityCompact"), 8], [t("design.styles.densityCozy"), 12], [t("design.styles.densityComfy"), 16]] as [string, number][]).map(([n, d]) => <span key={n} className={"dz-pill2 " + (pt.density === d ? "on" : "")} onClick={() => patchPt({ density: d })}>{n}</span>)}</div>
            {tRange(t("design.styles.density"), "density", 4, 28, 1, "px")}
            {tRange(t("design.styles.containerWidth"), "containerWidth", 880, 1600, 20, "px")}
            {tRange(t("design.styles.motionSpeed"), "motionMs", 0, 600, 20, "ms")}
            <div className="dz-sub">{t("design.styles.easing")}</div>
            <div className="dz-opt">{([[t("design.styles.easeEase"), "ease"], [t("design.styles.easeInOut"), "ease-in-out"], [t("design.styles.easeLinear"), "linear"], [t("design.styles.easeSmooth"), "cubic-bezier(.4,0,.2,1)"]] as [string, string][]).map(([n, ez]) => <span key={n} className={"dz-pill2 " + (pt.ease === ez ? "on" : "")} onClick={() => patchPt({ ease: ez })}>{n}</span>)}</div>

            <div className="dz-sec" style={{ marginTop: 18 }}>{t("design.styles.spacingScale")}</div>
            <div style={{ display: "flex", gap: 5, alignItems: "flex-end" }}>{[0.5, 1, 1.5, 2, 3, 4].map((k) => { const n = Math.round(pt.density * k); return <div key={k} style={{ textAlign: "center" }}><div style={{ width: 20, height: Math.max(3, n), background: hexA(pt.accent, .5), borderRadius: 3 }} /><div style={{ fontSize: 9, color: "var(--text-faint)", marginTop: 3 }}>{n}</div></div>; })}</div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, gap: 8 }}>
              <span style={{ fontSize: 10.5, color: "var(--text-faint)" }}>{t("design.styles.restyleNote")}</span>
              <button className="dz-mini-btn" onClick={() => patchPt(DEFAULT_PT)}>{t("design.styles.reset")}</button>
            </div>
          </>}

          {railSel === "comments" && <>
            <div className="dz-sec">{t("design.comments.title")}</div>
            {screenComments.length === 0 && <div style={{ fontSize: 11.5, color: "var(--text-dim)", lineHeight: 1.5 }}>{t("design.comments.emptyPre")} <b>{t("design.comments.emptyTool")}</b> {t("design.comments.emptyPost")}</div>}
            {screenComments.map((c, i) => (
              <div className="dz-cmt" key={c.id}>
                <div className="h"><span className="pin">{i + 1}</span> {t("design.comments.comment")} <span className="x" onClick={() => { void deleteDesignComment(c.id).then(() => setReloadKey((k) => k + 1)); }}><Icon name="trash" size={12} /></span></div>
                <div className="bd">{c.body}</div>
                {c.reply
                  ? <div className="rep"><Icon name="bot" size={12} /> {c.reply}</div>
                  : <button className="dz-mini-btn" onClick={() => { const cs = (c.selection && typeof c.selection === "object" && (c.selection as CanvasSelection).componentName) ? (c.selection as CanvasSelection) : undefined; void askGrace(`Apply this canvas comment on screen ${shownScreen}${cs ? ` (it is pinned on the ${cs.componentName} element)` : ""}: "${c.body}"`, undefined, cs); }}><Icon name="bot" size={12} /> {t("design.comments.askGrace")}</button>}
              </div>
            ))}
            {screenMarkups.length > 0 && <div className="dz-sec" style={{ marginTop: 14 }}>{t("design.comments.markedRegions", { count: screenMarkups.length })}</div>}
            {screenMarkups.map((c, i) => {
              const note = markupNote(c);
              return (
                <div className="dz-cmt" key={c.id}>
                  <div className="h"><span className="pin">M{i + 1}</span> {t("design.comments.region")} <span className="x" onClick={() => { void deleteDesignComment(c.id).then(() => setReloadKey((k) => k + 1)); }}><Icon name="trash" size={12} /></span></div>
                  {note && <div className="bd">{note}</div>}
                  {c.reply
                    ? <div className="rep"><Icon name="bot" size={12} /> {c.reply}</div>
                    : <button className="dz-mini-btn" onClick={() => { const loc = describeRegion(markupRect(c)); void askGrace(`On screen ${shownScreen}, I marked a region for review (${loc}).${note ? ` My note: "${note}"` : " Please review and refine it."} Update the screen accordingly.`); }}><Icon name="bot" size={12} /> {t("design.comments.askGrace")}</button>}
                </div>
              );
            })}
          </>}

          {railSel === "history" && (() => {
            const e = histRef.current.get(shownScreen);
            const pos = e?.pos ?? -1;
            const items = e ? e.labels.map((lab, i) => ({ lab, i })) : [];
            return <>
              <div className="dz-sec">{e && e.stack.length > 1 ? t("design.history.pos", { pos: pos + 1, total: e.stack.length }) : t("design.history.title")}</div>
              {!hasScreen ? (
                <div style={{ fontSize: 11.5, color: "var(--text-dim)" }}>{t("design.history.openScreen")}</div>
              ) : items.length <= 1 ? (
                <div style={{ fontSize: 11.5, color: "var(--text-dim)", lineHeight: 1.5 }}>{t("design.history.noEdits")}</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {items.slice().reverse().map(({ lab, i }) => (
                    <div key={i} onClick={() => jumpHistory(i)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 9px", borderRadius: 8, cursor: "pointer", fontSize: 12, background: i === pos ? "rgba(224,164,78,.12)" : "transparent", color: i === pos ? "var(--accent)" : "var(--text-dim)", border: "1px solid " + (i === pos ? "var(--accent)" : "transparent") }}>
                      <span style={{ fontVariantNumeric: "tabular-nums", opacity: .6, minWidth: 16, textAlign: "right" }}>{i === 0 ? "•" : i}</span>
                      <span style={{ flex: 1, fontWeight: i === pos ? 700 : 500 }}>{lab || t("design.history.edited")}</span>
                      {i === pos && <span style={{ fontSize: 10, fontWeight: 700 }}>{t("design.history.current")}</span>}
                    </div>
                  ))}
                </div>
              )}
            </>;
          })()}
          {railSel === "versions" && <>
            <div className="dz-sec">{t("design.versions.title")}</div>
            {versions.length === 0
              ? <div style={{ fontSize: 11.5, color: "var(--text-dim)", lineHeight: 1.5 }}>{t("design.versions.empty")}</div>
              : versions.map((v) => (
                <div key={v.id} className={"dz-vnode" + (selVersion === v.id ? " active" : "")}
                  onClick={() => setSelVersion(selVersion === v.id ? null : v.id)} title={t("design.versions.revertHint")}>
                  <div className="vt">{v.label} <span className="dz-tag">{t("design.versions.files", { count: v.files.length, plural: v.files.length === 1 ? "" : "s" })}</span></div>
                  <div className="vs">{v.note}</div>
                  <div className="vtime">{ago(v.createdAt, t)}</div>
                  {selVersion === v.id && <div className="dz-addrow" style={{ marginTop: 8, padding: "6px" }} onClick={(e) => {
                    e.stopPropagation();
                    if (v.restorable) {
                      void restoreDesignCheckpoint(v.id).then(async (r) => {
                        if (!r.ok) { toast(r.error || t("design.toast.restoreFailed")); return; }
                        const path = shownScreenRef.current;
                        editingRef.current = false; editingScreenRef.current = "";
                        histRef.current.delete(path); setHistVer((x) => x + 1);   // re-seed baseline from the restored file
                        const g = await getDesignScreen(path);
                        if (g.ok && g.html != null) { setScreenHtml(g.html); setSel(null); }
                        toast(t("design.toast.restored", { label: v.label }));
                      });
                    } else { setPending(true); void restoreDesignVersion(v.label, v.note); }
                    setSelVersion(null);
                  }}><Icon name="refresh" size={12} /> {t("design.versions.revertTo", { label: v.label })}</div>}
                </div>
              ))}
          </>}
        </div>
      </div>
      ) : (
        <div className="dz-strip right" onClick={() => setRailOpen(true)} title={t("design.rail.expand")}>
          <Icon name="chevronLeft" size={16} />
          <Icon name="sidebarIcon" size={16} />
        </div>
      )}

      {showExport && (
        <div className="dz-modal-bg" onClick={() => setShowExport(false)}>
          <div className="dz-modal" onClick={(e) => e.stopPropagation()}>
            <div className="dz-modal-h">
              <div className="ic"><Icon name="arrowDown" size={17} /></div>
              <div><div className="t">{t("design.export.title")}</div><div className="s">{t("design.export.sub")}</div></div>
              <div className="x" onClick={() => setShowExport(false)}><Icon name="close" size={16} /></div>
            </div>
            <div className="dz-modal-b">
              {([[t("design.export.row.screens"), String(allScreens.length)], [t("design.export.row.comments"), String(comments.filter((c) => !isMarkup(c)).length)], [t("design.export.row.versions"), String(versions.length)], [t("design.export.row.tokens"), t("design.export.row.tokensVal")], [t("design.export.row.approvedMd"), ""], [t("design.export.row.kbRag"), ""], [t("design.export.row.adaNotified"), ""], [t("design.export.row.planner"), ""]] as [string, string][]).map((d) => (
                <div className="dz-dl" key={d[0]}><span className="ck"><Icon name="check" size={11} /></span>{d[0]}{d[1] && <span className="n">{d[1]}</span>}</div>
              ))}
            </div>
            <div className="dz-modal-f">
              <span className="note">{t("design.export.note")}</span>
              <div className="dz-spacer" />
              <button className="dz-mini-btn" disabled={busy} onClick={buildProduction}><Icon name="cpu" size={13} /> {t("design.export.buildProd")}</button>
              <button className="dz-mini-btn" onClick={() => setShowExport(false)}>{t("design.export.close")}</button>
              <button className="dz-mini-btn accent" disabled={busy || approved} onClick={() => { setShowExport(false); approve(); }}><Icon name="check" size={13} /> {t("design.export.approveDesign")}</button>
            </div>
          </div>
        </div>
      )}

      {flash && <div className="dz-flash">{flash}</div>}
    </div>
  );
}
