"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { sendMessage } from "@/server/chat";
import { useT } from "@/lib/i18n-context";
import { Icon } from "@/components/ui/icon";

// The central command bar on the Welcome Home. It reuses the existing chat dispatch:
//   "/cmd …"   → runs the slash command in the Team Room
//   "@handle …"→ sends a DM to that agent and opens the DM
//   plain text → asks the Knowledge Base ("/kb …")
// In every case the chat dock is opened (window events) so the answer is visible immediately.
type Cmd = { cmd: string; key: string; arg?: string };
const CMDS: Cmd[] = [
  { cmd: "/kb", key: "kb", arg: "<question>" },
  { cmd: "/status", key: "status" },
  { cmd: "/new-goal", key: "newgoal", arg: "<brief>" },
  { cmd: "/agents", key: "agents" },
  { cmd: "/reindex", key: "reindex" },
  { cmd: "/curate", key: "curate" },
  { cmd: "/help", key: "help" },
];

export function HomeCommandBar() {
  const t = useT();
  const [val, setVal] = useState("");
  const [sel, setSel] = useState(0);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  // The hero "Ask the KB" button focuses this bar.
  useEffect(() => {
    function focus() { inputRef.current?.focus(); inputRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }); }
    window.addEventListener("constella:focus-cmdbar", focus);
    return () => window.removeEventListener("constella:focus-cmdbar", focus);
  }, []);

  const showMenu = val.startsWith("/");
  const menu = showMenu ? CMDS.filter((c) => c.cmd.startsWith(val.split(" ")[0].toLowerCase())) : [];

  function submit(text: string) {
    const v = text.trim();
    if (!v) return;
    start(async () => {
      try {
        if (v.startsWith("@")) {
          const m = v.match(/^@([a-z0-9-]+)\s*([\s\S]*)$/);
          const handle = m?.[1]; const rest = (m?.[2] || "").trim();
          if (handle) {
            if (rest) await sendMessage("dm:" + handle, rest);
            window.dispatchEvent(new CustomEvent("constella:open-dm", { detail: { handle } }));
          }
        } else if (v.startsWith("/")) {
          await sendMessage("room", v);
          window.dispatchEvent(new CustomEvent("constella:open-chat", { detail: { channel: "room" } }));
        } else {
          await sendMessage("room", "/kb " + v);
          window.dispatchEvent(new CustomEvent("constella:open-chat", { detail: { channel: "room" } }));
        }
      } catch { /* dock surfaces failures; never throw from the bar */ }
      setVal(""); setSel(0);
    });
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (showMenu && menu.length) {
      if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => (s + 1) % menu.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => (s - 1 + menu.length) % menu.length); return; }
      if (e.key === "Tab") { e.preventDefault(); setVal(menu[sel].cmd + " "); setSel(0); return; }
      if (e.key === "Enter" && val.trim() === menu[sel]?.cmd) { e.preventDefault(); setVal(menu[sel].cmd + " "); return; }
    }
    if (e.key === "Enter") { e.preventDefault(); submit(val); }
    if (e.key === "Escape") { setVal(""); }
  }

  return (
    <div className="cmdbar-wrap">
      <div className={"cmdbar" + (pending ? " busy" : "")}>
        <Icon name="search" size={17} />
        <input
          ref={inputRef}
          className="cmdbar-input"
          value={val}
          placeholder={t("home.cmd.placeholder")}
          onChange={(e) => { setVal(e.target.value); setSel(0); }}
          onKeyDown={onKey}
          disabled={pending}
        />
        <button className="cmdbar-go" onClick={() => submit(val)} disabled={pending || !val.trim()} title={t("home.cmd.run")}>
          <Icon name={pending ? "pulse" : "goto"} size={15} />
        </button>
        {showMenu && menu.length > 0 && (
          <div className="cmdbar-menu">
            {menu.map((c, i) => (
              <button
                key={c.cmd}
                className={"cmdbar-item" + (i === sel ? " active" : "")}
                onMouseEnter={() => setSel(i)}
                onClick={() => { setVal(c.cmd + " "); inputRef.current?.focus(); }}>
                <span className="ci-cmd">{c.cmd}{c.arg ? <span className="ci-arg"> {c.arg}</span> : null}</span>
                <span className="ci-desc">{t("home.cmd." + c.key)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="cmdbar-hint">{t("home.cmd.hint")}</div>
    </div>
  );
}
