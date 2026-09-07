/* Instrumentation injected into the design canvas iframe. Grace writes ARBITRARY self-contained HTML, so
   the canvas runs it in a sandboxed iframe (sandbox="allow-scripts", NO allow-same-origin → isolated). This
   script runs INSIDE that iframe and is the only thing that touches the screen DOM; it talks to the host
   ONLY via postMessage — the canvas ↔ agent contract (design-module/02-CONTRACT.md §5). Coordinates are
   reported in logical document px; the iframe applies one transient visual page scale and the host maps
   those coordinates back onto the fixed preview frame for overlays. */

import type { CanvasSelection } from "@/lib/design/selection";

/** iframe → host messages (all tagged `__cstla`). */
export type CanvasInMsg =
  | { type: "canvas:ready"; payload?: { interactive: boolean } }
  | { type: "canvas:size"; payload: { height: number } }
  | { type: "canvas:viewport"; payload: { scrollX: number; scrollY: number; viewportW: number; viewportH: number; docW: number; docH: number } }
  | { type: "canvas:hover"; payload: { x: number; y: number; w: number; h: number; label: string } | null }
  | { type: "canvas:select"; payload: CanvasSelection }
  | { type: "canvas:comment"; payload: { xpPct: number; ypPct: number; selection: CanvasSelection | null } }
  | { type: "canvas:markup"; payload: { xPct: number; yPct: number; wPct: number; hPct: number } }
  | { type: "canvas:markupDraw"; payload: { xPct: number; yPct: number; wPct: number; hPct: number } | null }
  | { type: "canvas:edit"; payload: { oldText: string; newText: string } }
  | { type: "canvas:editEnd" }                                         // inline text edit blurred with no net change → host clears the "Saving…" indicator
  // Visual-editor backbone: the operator's direct manipulation in the canvas.
  | { type: "canvas:dirty" }                                          // an edit started — host shows "Saving…", suppresses reloads
  | { type: "canvas:commit"; payload: { html: string } }             // debounced serialize of <body> (minus the instrument) → persist
  | { type: "canvas:history"; payload: { html: string; label?: string } } // ONE discrete undo state (gesture/cmd/field commit) → host stack + persist; label names the action in the History panel
  | { type: "canvas:baseline"; payload: { html: string } }           // initial body on ready → host seeds the per-screen undo baseline
  | { type: "canvas:reselect"; payload: CanvasSelection }            // re-emit the selected element's fresh box/styles after an edit
  | { type: "canvas:selectToggle"; payload: CanvasSelection }        // shift/ctrl-click → host toggles this element in the multi-set
  | { type: "canvas:reselectMany"; payload: CanvasSelection[] }      // fresh boxes for the whole multi-set after a group move/align
  | { type: "canvas:removed"; payload: { cstlaId: string } }         // the selected element was deleted
  | { type: "canvas:extracted"; payload: { cstlaId: string; html: string } } // clean outerHTML of the selection (save as preset)
  | { type: "canvas:tree"; payload: { items: { path: string; tag: string; label: string; depth: number; kids: number }[] } } // layers list
  | { type: "canvas:nav"; payload: { href: string } }                // a prototype nav link was clicked in Preview → host switches screens
  | { type: "canvas:guides"; payload: { v: number[]; h: number[] } | null }; // alignment guide lines (px, frame-local)

/** host → iframe messages (all tagged `__cstlaHost`). Text-only editor: only mode, live token restyle, the layers
 *  tree queries and undo/redo body swaps. (Structural/style/insert/resize/align/image messages were removed.) */
export type CanvasHostMsg =
  | { type: "canvas:setMode"; mode: CanvasMode }
  | { type: "canvas:applyTokens"; tokens: Record<string, unknown> } // live token restyle (Styles panel)
  | { type: "canvas:requestTree" }                                  // ask for the layers tree
  | { type: "canvas:selectByPath"; path: string }                   // select a node from the layers list
  | { type: "canvas:setBody"; html: string };                       // host pushes a snapshot back for undo/redo

export type CanvasMode = "select" | "edit" | "markup" | "comments" | "inspect" | "preview";

/** The instrumentation source, embedded verbatim into the iframe. Plain ES5-ish JS (runs in the sandbox). */
const INSTRUMENT = `(function(){
  var MODE = "select";
  var ZOOM = 1, ZOX = 0, ZOY = 0;

  // ── Stable element identity ──────────────────────────────────────────────────────────────────────
  // Every element the operator touches gets a persistent data-cstla-id ("c7") so the host can target live
  // edits by id and ids survive a commit→reload round-trip. Seed the counter from any ids already in the
  // (previously committed) body so we never reissue one.
  var CIDN = 0;
  (function(){ var a=document.querySelectorAll("[data-cstla-id]"); for(var i=0;i<a.length;i++){ var n=parseInt(((a[i].getAttribute("data-cstla-id")||"").replace(/^c/,"")),10); if(n>CIDN)CIDN=n; } })();
  function cid(el){ var id=el.getAttribute&&el.getAttribute("data-cstla-id"); if(id)return id; CIDN++; id="c"+CIDN; el.setAttribute("data-cstla-id",id); return id; }
  function byId(id){ try{ return document.querySelector('[data-cstla-id="'+id+'"]'); }catch(e){ return null; } }
  function isInstrumentNode(n){ return n && n.nodeType===1 && n.getAttribute && n.getAttribute("data-cstla-instrument")!=null; }
  function isZoomRoot(n){ return n && n.nodeType===1 && n.getAttribute && n.getAttribute("data-cstla-zoom-root")!=null; }
  // Zoom is applied HOST-SIDE now (the host scales the iframe wrapper); inside the iframe everything stays 1:1, so
  // coordinates/drag/resize are plain px and the body gets NO transform (a transform on <body> would re-anchor
  // position:fixed children and break the screen). ZOOM stays 1 → logicalX/logicalY/unzoomRect below are kept as
  // identity helpers (call sites unchanged) and applyZoom just re-reports content size + the layers tree.
  function applyZoom(){ sz(); emitTree(); }
  function logicalX(x){ return (x-ZOX)/ZOOM; }
  function logicalY(y){ return (y-ZOY)/ZOOM; }
  function unzoomRect(r){ var sx=window.scrollX||0, sy=window.scrollY||0; return { x:logicalX(r.left+sx), y:logicalY(r.top+sy), w:r.width/ZOOM, h:r.height/ZOOM }; }

  // ── Persist backbone ─────────────────────────────────────────────────────────────────────────────
  // After any direct-manipulation edit, debounce a "commit": serialize <body> (minus the instrument script
  // + transient editing attrs) back to the host, which writes it into the screen file. "dirty" fires first
  // so the host can suppress reload races + show a Saving indicator while the operator is editing.
  var ctimer=null;
  function touch(){ post("canvas:dirty", null); if(ctimer)clearTimeout(ctimer); ctimer=setTimeout(commitNow,450); }
  // Serialize <body> minus the instrument script + transient editing attrs → the clean source we persist.
  function serializeBody(){
    var clone=document.body.cloneNode(true);
    var mk=clone.querySelectorAll("[data-cstla-instrument]"); for(var i=0;i<mk.length;i++){ if(mk[i].parentNode)mk[i].parentNode.removeChild(mk[i]); }
    var ce=clone.querySelectorAll("[contenteditable]"); for(var j=0;j<ce.length;j++){ ce[j].removeAttribute("contenteditable"); ce[j].style.outline=""; }
    return clone.innerHTML;
  }
  function commitNow(){ ctimer=null; post("canvas:commit", { html: serializeBody() }); }
  // History is HOST-owned (per screen, survives reload + screen-switch). The iframe only reports snapshots:
  //  - emitHistory(): one discrete undo state (after a finished gesture / structural cmd / field commit).
  //  - canvas:baseline (on ready): seeds the host's per-screen baseline.
  //  - setBody(html): the host sends a snapshot back for undo/redo; swap the body, preserving the instrument
  //    script + its document-level listeners (no history/commit emit — the host already persisted it).
  function emitHistory(label){ post("canvas:history", { html: serializeBody(), label: label||"" }); emitTree(); }
  function setBody(html){
    var sc=document.querySelector("[data-cstla-instrument]"); if(sc&&sc.parentNode)sc.parentNode.removeChild(sc);
    document.body.innerHTML=html; if(sc) document.body.appendChild(sc);
    applyZoom(ZOOM); post("canvas:removed", { cstlaId:"" }); sz();
  }

  function lbl(el){
    var ed = el.getAttribute && el.getAttribute("data-ed"); if(ed) return ed;
    var aria = el.getAttribute && el.getAttribute("aria-label"); if(aria) return aria;
    var tag = el.tagName.toLowerCase();
    if(tag==="button"||tag==="a"){ var tx=(el.textContent||"").replace(/\\s+/g," ").trim().slice(0,24); return tx||tag; }
    if(el.id) return tag+"#"+el.id;
    if(typeof el.className==="string" && el.className.trim()){ var c=el.className.trim().split(/\\s+/)[0]; if(c) return tag+"."+c; }
    return tag;
  }
  function docSize(){ var d=document.documentElement, b=document.body; return { w: Math.max(d.scrollWidth,b?b.scrollWidth:0,d.clientWidth), h: Math.max(d.scrollHeight,b?b.scrollHeight:0,d.clientHeight) }; }
  function boxOf(el){ var b=unzoomRect(el.getBoundingClientRect()); return { x:b.x, y:b.y, w:b.w, h:b.h, label: lbl(el) }; }
  function describe(el){
    var r=el.getBoundingClientRect(), cs=getComputedStyle(el);
    var b=unzoomRect(r);
    var path=[], n=el, d=0;
    while(n && n!==document.documentElement && d<6){ var p=n.tagName.toLowerCase(); var ed=n.getAttribute&&n.getAttribute("data-ed"); if(ed)p+="\\u00b7"+ed.split(" ")[0]; path.unshift(p); n=n.parentElement; d++; }
    var sec = el.closest ? el.closest("[data-section]") : null;
    return {
      selectionId: "sel_"+Math.random().toString(36).slice(2,8),
      cstlaId: cid(el),
      elementType: el.tagName.toLowerCase(),
      componentName: (el.getAttribute&&(el.getAttribute("data-comp")||el.getAttribute("data-ed")))||lbl(el),
      domPath: path.join(" \\u203a "),
      boundingBox: { x:b.x, y:b.y, w:b.w, h:b.h },
      tx: txOf(el).x, ty: txOf(el).y, nodePath: pathOf(el),
      computedStyles: {
        display:cs.display, position:cs.position,
        width:Math.round(b.w)+"px", height:Math.round(b.h)+"px",
        margin:cs.margin, marginTop:cs.marginTop, marginRight:cs.marginRight, marginBottom:cs.marginBottom, marginLeft:cs.marginLeft,
        padding:cs.padding, paddingTop:cs.paddingTop, paddingRight:cs.paddingRight, paddingBottom:cs.paddingBottom, paddingLeft:cs.paddingLeft,
        gap:(cs.gap&&cs.gap!=="normal")?cs.gap:(cs.columnGap&&cs.columnGap!=="normal"?cs.columnGap:""),
        color:cs.color, fontSize:cs.fontSize, fontWeight:cs.fontWeight, lineHeight:cs.lineHeight, letterSpacing:cs.letterSpacing, textAlign:cs.textAlign,
        background:cs.backgroundColor, border:cs.borderTopWidth+" "+cs.borderTopStyle+" "+cs.borderTopColor, borderRadius:cs.borderTopLeftRadius,
        boxShadow:cs.boxShadow, opacity:cs.opacity, zIndex:(cs.zIndex==="auto"?"":cs.zIndex)
      },
      textContent: (el.textContent||"").replace(/\\s+/g," ").trim().slice(0,120),
      parentContainer: el.parentElement ? ((el.parentElement.getAttribute&&el.parentElement.getAttribute("data-ed"))||el.parentElement.tagName.toLowerCase()) : "\\u2014",
      children: el.children.length,
      pageId: "",
      sectionId: (sec&&sec.getAttribute("data-section"))||"",
      locked: el.getAttribute("data-cstla-lock")!=null,
      isGroup: el.getAttribute("data-cstla-group")!=null
    };
  }
  // Re-describe + re-emit the element after a live edit so the host's selection box + panel reflect the new box/styles.
  function reselect(el){ if(valid(el)) post("canvas:reselect", describe(el)); }
  function post(type, payload){ try{ parent.postMessage({ __cstla:1, type:type, payload:payload }, "*"); }catch(e){} }
  function valid(el){ return el && el.nodeType===1 && el!==document.documentElement && el!==document.body && !isZoomRoot(el); }

  // ── Pointer gestures (capture-based, leak-proof) ─────────────────────────────────────────────────
  // EVERY canvas gesture uses Pointer Events + setPointerCapture so move/up always land here even when the
  // pointer is released OUTSIDE the iframe or over a host overlay (handles/menu). A single finishGesture()/
  // clearGesture() ends every gesture on pointerup / pointercancel / lostpointercapture / window blur → the
  // "stuck button" can't happen. Move = transform:translate (non-destructive), 8px grid + alignment guides.
  var drawing=null, suppressClick=false, gpid=null;
  function txOf(el){ var t=el.getAttribute("data-cstla-tx"); if(!t)return{x:0,y:0}; var p=t.split(","); return{x:parseFloat(p[0])||0,y:parseFloat(p[1])||0}; }
  function captureNow(pid){ gpid=pid; try{ document.documentElement.setPointerCapture(pid); }catch(e){} }
  function releaseCap(){ if(gpid!=null){ try{ document.documentElement.releasePointerCapture(gpid); }catch(e){} gpid=null; } }
  function noSelect(on){ var s=document.documentElement.style; s.userSelect=on?"none":""; s.webkitUserSelect=on?"none":""; }
  function resetCursor(){ noSelect(false); document.documentElement.style.cursor = MODE==="preview"?"":(MODE==="comments"?"copy":"crosshair"); }
  function draw(e){ if(!drawing)return; var d=docSize(), ex=logicalX(e.pageX), ey=logicalY(e.pageY); var x=Math.min(drawing.x,ex),y=Math.min(drawing.y,ey),w=Math.abs(ex-drawing.x),h=Math.abs(ey-drawing.y); post("canvas:markupDraw", { xPct:x/d.w*100, yPct:y/d.h*100, wPct:w/d.w*100, hPct:h/d.h*100 }); }
  function finishGesture(e){
    if(drawing){ var dd=docSize(), ex=logicalX(e.pageX), ey=logicalY(e.pageY); var x=Math.min(drawing.x,ex),y=Math.min(drawing.y,ey),w=Math.abs(ex-drawing.x),h=Math.abs(ey-drawing.y); drawing=null; releaseCap(); post("canvas:markupDraw", null); resetCursor(); if(w>6&&h>6) post("canvas:markup", { xPct:x/dd.w*100, yPct:y/dd.h*100, wPct:w/dd.w*100, hPct:h/dd.h*100 }); return; }
    releaseCap(); resetCursor();
  }
  function clearGesture(){
    if(drawing){ drawing=null; post("canvas:markupDraw", null); }
    releaseCap(); resetCursor();
  }

  document.addEventListener("pointermove", function(e){
    if(drawing){ draw(e); return; }
    if(MODE==="preview"||MODE==="comments"||MODE==="markup") return;
    if(!valid(e.target)){ post("canvas:hover", null); return; }
    post("canvas:hover", boxOf(e.target));
  }, true);
  document.addEventListener("pointerleave", function(){ if(!drawing) post("canvas:hover", null); });
  document.addEventListener("pointerdown", function(e){
    if(e.button!==0) return;                                            // left button only (middle/right → host pan)
    if(MODE==="markup"){ e.preventDefault(); drawing={ x:logicalX(e.pageX), y:logicalY(e.pageY) }; captureNow(e.pointerId); return; }
    if(MODE==="edit"){
      // Edit mode is TEXT-ONLY (the design must stay faithful to the approved mock): click selects, double-click
      // edits text inline. No move/resize/add/structural manipulation — those were intentionally removed.
      if(e.target && e.target.isContentEditable) return;               // editing text inline → leave native selection alone
      if(!valid(e.target)) return;
      e.preventDefault();                                              // suppress text-selection on the press; the click selects
      return;
    }
    if(MODE==="select"){ if(valid(e.target)) e.preventDefault(); return; } // click still selects; just suppress text-selection on drag
  }, true);
  document.addEventListener("pointerup", function(e){ finishGesture(e); }, true);
  document.addEventListener("pointercancel", function(){ clearGesture(); }, true);
  document.documentElement.addEventListener("lostpointercapture", function(){ if(drawing) clearGesture(); });
  window.addEventListener("blur", function(){ clearGesture(); });

  document.addEventListener("click", function(e){
    if(suppressClick){ suppressClick=false; e.preventDefault(); e.stopPropagation(); return; } // swallow the click that ends a gesture
    // Anchor guard: this prototype lives in an opaque-origin srcdoc iframe whose relative/absolute hrefs resolve
    // against the HOST page, so a real click would navigate the frame OUT to the app (e.g. the login). Intercept
    // link clicks so they NEVER break out of the sandbox; in Preview, ask the host to switch prototype screens.
    var lnk = e.target && e.target.closest ? e.target.closest("a[href]") : null;
    if(lnk){ var href = lnk.getAttribute("href") || "";
      if(href && href.charAt(0)!=="#"){            // in-page #anchors scroll natively; everything else is cross-doc
        e.preventDefault();                        // block the breakout in EVERY mode
        if(MODE==="preview"){ e.stopPropagation(); post("canvas:nav", { href: href }); return; }
        // select/edit/etc.: nav blocked; fall through so the click still SELECTS the link element
      }
    }
    if(MODE==="preview") return;
    if(MODE==="comments"){ e.preventDefault(); e.stopPropagation(); var d=docSize(); var ce=document.elementFromPoint(e.clientX,e.clientY); var cs=valid(ce)?describe(ce):null; post("canvas:comment", { xpPct:(logicalX(e.pageX)/d.w)*100, ypPct:(logicalY(e.pageY)/d.h)*100, selection:cs }); return; }
    if(MODE==="markup") { e.preventDefault(); return; }
    if(!valid(e.target)) return;
    if(e.target.isContentEditable) return;                              // already editing this element → let the native caret/selection work
    e.preventDefault(); e.stopPropagation();
    if(e.shiftKey||e.metaKey||e.ctrlKey){ post("canvas:selectToggle", describe(e.target)); return; } // add/remove from the multi-set
    post("canvas:select", describe(e.target));   // SELECT (select + edit modes)
    if(MODE==="edit") edit(e.target, e.clientX, e.clientY);             // text-only mode: a single click drops straight into inline text edit (caret at the click)
  }, true);
  // Edit mode: double-click also edits (with a word-select once inside an active edit).
  document.addEventListener("dblclick", function(e){
    if(MODE!=="edit") return;
    if(e.target && e.target.isContentEditable) return;                  // double-click inside an active edit → native word-select
    if(!valid(e.target)) return;
    e.preventDefault(); e.stopPropagation();
    edit(e.target, e.clientX, e.clientY);
  }, true);
  // A prototype is a mock — it never really submits. Block form submission so a <form action> can't navigate the
  // sandbox frame out to the host app (same breakout class as the anchor guard above).
  document.addEventListener("submit", function(e){ e.preventDefault(); }, true);

  // Drop a visible caret at the click point (pointerdown preventDefault suppressed the native one), falling back
  // to the end of the element's text when the point isn't inside it.
  function placeCaret(el, cx, cy){ try{ var range=null;
    if(cx!=null){ if(document.caretRangeFromPoint) range=document.caretRangeFromPoint(cx,cy);
      else if(document.caretPositionFromPoint){ var cp=document.caretPositionFromPoint(cx,cy); if(cp){ range=document.createRange(); range.setStart(cp.offsetNode,cp.offset); range.collapse(true); } } }
    if(!range || !el.contains(range.startContainer)){ range=document.createRange(); range.selectNodeContents(el); range.collapse(false); }
    var s=window.getSelection(); if(s){ s.removeAllRanges(); s.addRange(range); }
  }catch(e){} }
  // Inline TEXT edit (the only edit in text-only mode): contentEditable + a caret at the click, "Saving…" live as
  // the operator types (canvas:dirty), and on blur persist the change (→ "Saved") or clear the indicator if the
  // text ended up unchanged (canvas:editEnd).
  function edit(el, cx, cy){
    if(!el || el.nodeType!==1) return;
    if(el.children.length>0 && !(el.textContent||"").trim()) return;    // a container with no own text isn't editable
    if(el.getAttribute("contenteditable")==="true") return;            // already editing this element
    cid(el); var old=el.textContent, touched=false;
    el.setAttribute("contenteditable","true"); el.style.outline="2px solid #6366f1"; el.style.cursor="text"; el.style.caretColor="#6366f1";
    try{ el.focus(); }catch(e){}
    placeCaret(el, cx, cy);
    function onInput(){ touched=true; post("canvas:dirty", null); }     // live "Saving…" while typing
    function done(){ el.removeEventListener("blur",done); el.removeEventListener("input",onInput);
      el.removeAttribute("contenteditable"); el.style.outline=""; el.style.cursor=""; el.style.caretColor="";
      var nw=el.textContent;
      if(nw!==old){ reselect(el); emitHistory("Edited text"); }         // persist + "Saved"
      else if(touched){ post("canvas:editEnd", null); }                 // typed then reverted → clear "Saving…"
    }
    el.addEventListener("input", onInput); el.addEventListener("blur", done);
  }

  // Live restyle from the Styles panel: write the operator's tokens onto :root CSS variables (several common
  // aliases for hit-rate) + set [data-theme]. Screens built to the token contract re-skin instantly.
  function applyTokens(t){
    if(!t) return; var de=document.documentElement, st=de.style;
    function setv(names,val){ for(var i=0;i<names.length;i++) st.setProperty(names[i],val); }
    if(t.accent) setv(["--accent","--accent-color","--primary","--color-primary","--color-accent","--brand","--btn-accent"], t.accent);
    if(t.accentFg) setv(["--accent-fg","--on-accent","--accent-contrast","--accent-foreground"], t.accentFg);
    if(t.font){ setv(["--font","--font-family","--font-sans","--ff"], t.font); st.setProperty("font-family", t.font); }
    if(t.radius!=null) setv(["--radius","--border-radius","--radius-card","--radius-btn","--rounded"], t.radius+"px");
    if(t.space!=null) setv(["--space","--gap","--spacing","--space-unit"], t.space+"px");
    if(t.fontScale!=null){ setv(["--font-scale","--text-scale"], String(t.fontScale)); st.setProperty("font-size", Math.round(16*t.fontScale)+"px"); }
    if(t.theme){ de.setAttribute("data-theme", t.theme); st.setProperty("color-scheme", t.theme); }
    // ── Expanded tokens (each restyles screens that adopt the var; Grace's builds follow the extended contract) ──
    if(t.secondary) setv(["--secondary","--color-secondary","--accent-2","--accent-secondary"], t.secondary);
    if(t.surface) setv(["--surface","--bg-surface","--card-bg","--surface-1","--panel"], t.surface);
    if(t.success) setv(["--success","--color-success","--positive"], t.success);
    if(t.warning) setv(["--warning","--color-warning"], t.warning);
    if(t.danger) setv(["--danger","--color-danger","--error","--negative"], t.danger);
    if(t.headingFont) setv(["--font-heading","--heading-font","--font-display","--font-title"], t.headingFont);
    if(t.fontWeight!=null) setv(["--font-weight","--weight","--fw"], String(t.fontWeight));
    if(t.lineHeight!=null) setv(["--line-height","--leading","--lh"], String(t.lineHeight));
    if(t.letterSpacing!=null) setv(["--letter-spacing","--tracking","--ls"], t.letterSpacing+"px");
    if(t.borderWidth!=null) setv(["--border-width","--bw","--hairline-w"], t.borderWidth+"px");
    if(t.borderColor) setv(["--border-color","--hairline","--border-c","--stroke"], t.borderColor);
    if(t.shadow){ var SH={none:"none",sm:"0 1px 2px rgba(0,0,0,.08)",md:"0 6px 18px -6px rgba(0,0,0,.18)",lg:"0 18px 48px -12px rgba(0,0,0,.30)"}; setv(["--shadow","--elevation","--box-shadow","--shadow-card"], SH[t.shadow]||SH.md); }
    if(t.containerWidth!=null) setv(["--container","--max-width","--content-width","--wrap"], t.containerWidth+"px");
    if(t.motionMs!=null) setv(["--transition","--duration","--motion","--speed"], t.motionMs+"ms");
    if(t.ease) setv(["--ease","--easing","--ease-fn"], t.ease);
  }
  // ── Layers tree (select from a list instead of clicking the canvas) ──────────────────────────────
  // Identify elements by a stable child-index PATH (e.g. "0/2/1") so the panel can select any node without
  // stamping ids on the whole document just by opening the tab.
  function pathOf(el){ var p=[], n=el; while(n && n.parentElement && n!==document.body){ p.unshift(Array.prototype.indexOf.call(n.parentElement.children, n)); n=n.parentElement; } return p.join("/"); }
  function elByPath(path){ var idx=(path===""?[]:String(path).split("/").map(Number)), n=document.body; for(var i=0;i<idx.length;i++){ n=n.children[idx[i]]; if(!n)return null; } return n; }
  function buildTree(){
    var out=[], MAXN=600;
    function walk(el, depth){
      for(var i=0;i<el.children.length;i++){
        if(out.length>=MAXN) return;
        var c=el.children[i], tg=c.tagName;
        if(tg==="SCRIPT"||tg==="STYLE") continue;
        if(c.getAttribute && c.getAttribute("data-cstla-instrument")!=null) continue;
        if(isZoomRoot(c)){ walk(c, depth); continue; }
        out.push({ path:pathOf(c), tag:tg.toLowerCase(), label:lbl(c), depth:depth, kids:c.children.length });
        if(depth<12) walk(c, depth+1);
      }
    }
    walk(document.body, 0);
    return out;
  }
  function emitTree(){ post("canvas:tree", { items: buildTree() }); }
  function selectByPath(path){ var el=elByPath(path); if(valid(el)) post("canvas:select", describe(el)); }

  // Host → iframe. The editor is text-only now: the canvas only takes mode, live token restyle, the layers tree
  // queries and undo/redo body swaps. (Structural/style/insert/resize/align/image messages were removed with the
  // direct-manipulation UI — the design is a faithful reference; structural changes go through Grace.)
  window.addEventListener("message", function(e){ var m=e.data; if(!m||!m.__cstlaHost)return;
    if(m.type==="canvas:setMode"){ MODE=m.mode; document.documentElement.style.cursor=(MODE==="preview"||MODE==="comments")?"":"crosshair"; if(MODE==="comments")document.documentElement.style.cursor="copy"; }
    else if(m.type==="canvas:applyTokens"){ applyTokens(m.tokens); }
    else if(m.type==="canvas:requestTree"){ emitTree(); }
    else if(m.type==="canvas:selectByPath"){ selectByPath(m.path); }
    else if(m.type==="canvas:setBody"){ setBody(m.html); }
  });

  function viewport(){
    var d=docSize(), de=document.documentElement;
    post("canvas:viewport", {
      scrollX: window.scrollX||0,
      scrollY: window.scrollY||0,
      viewportW: window.innerWidth||de.clientWidth||1,
      viewportH: window.innerHeight||de.clientHeight||1,
      docW: d.w,
      docH: d.h
    });
  }
  function sz(){ var d=docSize(); post("canvas:size", { height: d.h }); viewport(); }
  window.addEventListener("load", function(){ applyZoom(ZOOM); });
  window.addEventListener("resize", function(){ applyZoom(ZOOM); });
  window.addEventListener("scroll", viewport, true);
  setTimeout(function(){ applyZoom(ZOOM); },60); setTimeout(function(){ applyZoom(ZOOM); },400); setTimeout(function(){ applyZoom(ZOOM); },1200);
  document.documentElement.style.cursor="crosshair";
  // INTERACTIVE = the screen ships its OWN <script> (it builds/changes its DOM at runtime). Serializing the
  // post-execution DOM back to the file would bake generated nodes in AND the script re-runs on reload →
  // duplication. So the host treats edits on interactive screens as preview-only (persist via Grace instead).
  var INTERACTIVE=false; (function(){ var ss=document.getElementsByTagName("script"); for(var i=0;i<ss.length;i++){ if(!ss[i].hasAttribute("data-cstla-instrument")){ INTERACTIVE=true; break; } } })();
  applyZoom(ZOOM);
  // Themed scrollbar INSIDE the prototype iframe (the screen scrolls itself, so the host CSS can't reach
  // it — this replaces the native Windows/browser bar). Injected into <head> so it's never serialized into
  // the saved screen; also tagged data-cstla-instrument as a belt-and-braces strip. Neutral semi-transparent
  // so it reads on any prototype background (dark hero, light page, etc.).
  (function(){ try{ if(!document.getElementById("cstla-scrollbar")){ var st=document.createElement("style"); st.id="cstla-scrollbar"; st.setAttribute("data-cstla-instrument",""); st.textContent="::-webkit-scrollbar{width:11px;height:11px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(128,128,128,.45);border-radius:6px;border:3px solid transparent;background-clip:padding-box}::-webkit-scrollbar-thumb:hover{background:rgba(128,128,128,.78);background-clip:padding-box}::-webkit-scrollbar-corner{background:transparent}"; (document.head||document.documentElement).appendChild(st); } }catch(e){} })();
  post("canvas:ready", { interactive: INTERACTIVE });
  if(!INTERACTIVE) post("canvas:baseline", { html: serializeBody() }); // history/persist only for static screens
  setTimeout(emitTree, 80);
})();`;

/** Append the instrumentation to a screen's HTML (before </body> when present). The `data-cstla-instrument`
 *  marker lets the in-iframe commit strip this script when it serializes <body> back to the file. */
export function instrumentScreen(html: string): string {
  const tag = `<script data-cstla-instrument>${INSTRUMENT}</script>`;
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${tag}</body>`);
  return html + tag;
}
