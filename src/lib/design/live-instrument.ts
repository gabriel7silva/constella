/* Phase 3b — the LIVE-app inspector instrument. Injected (by the inspect proxy, design/live-inspect-proxy.ts)
   into the project's REAL running dev server HTML, so a click in the Live canvas maps to a concrete element in
   the real app. Unlike the design-mock instrument, this runs in the actual app's page (any stack) and does NOT
   manipulate the DOM — it only INSPECTS: in "inspect" mode it highlights + captures the clicked element's
   context (tag, text, classes, a CSS selector path, nearest landmark) and posts it to the Constella host over
   postMessage. The host then asks Grace to change THAT element in the source; the dev server HMR repaints.

   Approach B (robust, any stack): click → element context → Grace edits the source. The precise file:line
   variant (a per-framework build-time source stamp) is Approach A, deferred. In "off" mode this script is fully
   inert so the real app behaves exactly as itself. Host ↔ page contract is `__cstlaLive` / `__cstlaLiveHost`. */

export const LIVE_INSTRUMENT = `(function(){
  if(window.__cstlaLiveLoaded) return; window.__cstlaLiveLoaded = true;
  var MODE = "off";                                  // "off" (inert) | "inspect" (highlight + click-to-select)
  function post(type, payload){ try{ parent.postMessage({ __cstlaLive:1, type:type, payload:payload }, "*"); }catch(e){} }

  // A single highlight overlay (fixed, non-interactive) we move over the hovered/selected element. Lives at the
  // very top z-index and never intercepts pointer events, so it can't change how the real app behaves.
  var hl=null;
  function ensureHl(){ if(hl) return hl; hl=document.createElement("div"); hl.setAttribute("data-cstla-live-ui","1");
    hl.style.cssText="position:fixed;z-index:2147483646;pointer-events:none;border:2px solid #6366f1;border-radius:3px;background:rgba(99,102,241,.12);box-shadow:0 0 0 1px rgba(255,255,255,.5);transition:all .04s linear;display:none;";
    (document.body||document.documentElement).appendChild(hl); return hl; }
  function showHl(el){ if(!el){ if(hl)hl.style.display="none"; return; } var r=el.getBoundingClientRect(); var h=ensureHl();
    h.style.display="block"; h.style.left=r.left+"px"; h.style.top=r.top+"px"; h.style.width=Math.max(0,r.width)+"px"; h.style.height=Math.max(0,r.height)+"px"; }
  function hideHl(){ if(hl) hl.style.display="none"; }

  function isOwnUi(el){ var n=el; while(n){ if(n.getAttribute && n.getAttribute("data-cstla-live-ui")!=null) return true; n=n.parentElement; } return false; }
  function txt(el){ return (el.textContent||"").replace(/\\s+/g," ").trim().slice(0,140); }
  function cls(el){ return (typeof el.className==="string" ? el.className : (el.getAttribute&&el.getAttribute("class")||"")).trim().slice(0,200); }

  // A best-effort CSS selector PATH so Grace can find the element in the source: id wins; else tag + 1-2 classes
  // + :nth-of-type among siblings, walked up to ~5 levels. Not guaranteed unique, but a strong locator hint.
  function seg(el){ var tag=el.tagName.toLowerCase();
    if(el.id) return tag+"#"+el.id;
    var c=cls(el).split(/\\s+/).filter(function(x){ return x && x.indexOf("cstla")<0; }).slice(0,2);
    var base=tag+(c.length?"."+c.join("."):"");
    var p=el.parentElement; if(p){ var same=0, idx=0, k=0; for(k=0;k<p.children.length;k++){ var s=p.children[k]; if(s.tagName===el.tagName){ same++; if(s===el) idx=same; } } if(same>1) base+=":nth-of-type("+idx+")"; }
    return base; }
  function selectorOf(el){ var parts=[], n=el, d=0; while(n && n.nodeType===1 && n!==document.body && n!==document.documentElement && d<6){ parts.unshift(seg(n)); if(n.id) break; n=n.parentElement; d++; } return parts.join(" > "); }
  function nearestLandmark(el){ var n=el, d=0; while(n && d<8){ if(n.getAttribute){ var a=n.getAttribute("aria-label"); if(a) return a; var ds=n.getAttribute("data-section")||n.getAttribute("data-testid"); if(ds) return ds; } var h=n.querySelector&&n.querySelector("h1,h2,h3"); if(h&&h.textContent) return (h.textContent||"").replace(/\\s+/g," ").trim().slice(0,60); n=n.parentElement; d++; } return ""; }

  function describe(el){ var r=el.getBoundingClientRect();
    return { tag: el.tagName.toLowerCase(), id: el.id||"", classes: cls(el), text: txt(el), selector: selectorOf(el),
      landmark: nearestLandmark(el), href: (el.getAttribute&&el.getAttribute("href"))||"", role: (el.getAttribute&&el.getAttribute("role"))||"",
      box: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) },
      path: (location.pathname||"/")+(location.search||"") }; }

  function target(e){ var el=e.target; if(!el||el.nodeType!==1||isOwnUi(el)) return null; return el; }

  document.addEventListener("mousemove", function(e){ if(MODE!=="inspect") return; var el=target(e); if(el) showHl(el); else hideHl(); }, true);
  document.addEventListener("mouseleave", function(){ if(MODE==="inspect") hideHl(); }, true);
  // In inspect mode swallow the click (so the real app doesn't navigate/submit) and report the element. In off
  // mode we never touch the event, so links/buttons/forms work exactly as the real app intends.
  document.addEventListener("click", function(e){ if(MODE!=="inspect") return; var el=target(e); if(!el) return; e.preventDefault(); e.stopPropagation(); post("live:select", describe(el)); }, true);

  window.addEventListener("message", function(e){ var m=e.data; if(!m||!m.__cstlaLiveHost) return;
    if(m.type==="live:setMode"){ MODE=(m.mode==="inspect")?"inspect":"off"; if(MODE!=="inspect") hideHl(); document.documentElement.style.cursor = MODE==="inspect" ? "crosshair" : ""; }
    else if(m.type==="live:clear"){ hideHl(); }
  });

  post("live:ready", { path: (location.pathname||"/")+(location.search||"") });
})();`;

/** Inject the live inspector into a served HTML document (before </body>, else append). */
export function injectLiveInstrument(html: string): string {
  const tag = `<script data-cstla-live-instrument>${LIVE_INSTRUMENT}</script>`;
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${tag}</body>`);
  return html + tag;
}
