"use client";

import { useState, useEffect } from "react";
import { Icon } from "@/components/ui/icon";

/* Collapse the global left nav into an icon-only rail (and back), so a module like Design can take the full
   width. State persists in localStorage (`bx.sideCollapsed`, mirroring the chat-dock pattern). The rail CSS is
   injected here as a one-time <style> so globals.css stays untouched — it keys off `body.side-collapsed`. */

const RAIL_CSS = `
body.side-collapsed .side{width:58px!important;flex:0 0 58px!important;}
body.side-collapsed .side .nav-item{justify-content:center;padding-left:0;padding-right:0;position:relative;}
body.side-collapsed .side .nav-item>span:not(.nv-badge),
body.side-collapsed .side .nav-group-label,
body.side-collapsed .side .nav-search input,
body.side-collapsed .side .side-foot .pf{display:none!important;}
body.side-collapsed .side .nav-search{justify-content:center;}
body.side-collapsed .side .side-brand-wrap{overflow:hidden;}
body.side-collapsed .side .side-foot{justify-content:center;flex-wrap:wrap;gap:6px;}
body.side-collapsed .side .nv-badge{position:absolute;top:2px;right:6px;}
`;

export function SidebarToggle() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!document.getElementById("side-rail-style")) {
      const el = document.createElement("style");
      el.id = "side-rail-style"; el.textContent = RAIL_CSS;
      document.head.appendChild(el);
    }
    let init = false;
    try { init = localStorage.getItem("bx.sideCollapsed") === "1"; } catch { /* ignore */ }
    setCollapsed(init);
    document.body.classList.toggle("side-collapsed", init);
  }, []);

  function toggle() {
    setCollapsed((c) => {
      const next = !c;
      document.body.classList.toggle("side-collapsed", next);
      try { localStorage.setItem("bx.sideCollapsed", next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  }

  return (
    <button className={"top-btn" + (collapsed ? " on" : "")} onClick={toggle} title={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-label="Toggle sidebar">
      <Icon name="sidebarIcon" size={17} />
    </button>
  );
}
