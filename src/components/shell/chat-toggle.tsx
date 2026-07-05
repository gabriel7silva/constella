"use client";

import { Icon } from "@/components/ui/icon";
import { useT } from "@/lib/i18n-context";

/** Topbar button that toggles the chat dock (ChatDock listens for the event). */
export function ChatToggle() {
  const t = useT();
  return (
    <button className="top-btn" title={`${t("chrome.chat.agentRoom")} (⌘J)`} type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("constella:toggle-chat"))}>
      <Icon name="chat" size={17} />
    </button>
  );
}
