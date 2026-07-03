"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/ui/icon";
import { Avatar } from "@/components/ui/avatar";
import { timeAgo } from "@/lib/timeago";
import { markRead, markAllRead, clearAll } from "@/server/notifications";
import { useT } from "@/lib/i18n-context";

export type NotifItem = {
  id: string;
  kind: string;
  text: string;
  detail: string;
  read: boolean;
  createdAt: Date;
  agentName: string | null;
  agentColor: string | null;
  agentHealth: "alive" | "stale" | "down" | null;
};

const ic: Record<string, string> = {
  done: "check",
  deploy: "play",
  routine: "repeat",
  test: "debug",
  security: "shield",
  budget: "coins",
};

export function NotifFeed({ items }: { items: NotifItem[] }) {
  const t = useT();
  const [sel, setSel] = useState<NotifItem | null>(null);
  const [, start] = useTransition();
  const unread = items.filter((n) => !n.read).length;

  function open(n: NotifItem) {
    if (!n.read) start(() => { void markRead(n.id); });
    setSel(n);
  }
  function readAll() {
    setSel(null);
    start(() => { void markAllRead(); });
  }
  function clearAllFeed() {
    setSel(null);
    start(() => { void clearAll(); });
  }

  return (
    <div className="view" style={{ position: "relative" }}>
      <div className="view-head">
        <div className="vh-icon"><Icon name="bell" size={20} /></div>
        <div>
          <div className="view-title">{t("notif.title")}</div>
          <div className="view-sub">{t("notif.sub", { n: unread })}</div>
        </div>
        <div className="vh-right">
          <button className="btn-ghost" onClick={readAll} disabled={!unread}><Icon name="check" size={13} /> {t("notif.readAll")}</button>
          <button className="btn-ghost" onClick={clearAllFeed} disabled={!items.length}><Icon name="trash" size={13} /> {t("notif.clearAll")}</button>
        </div>
      </div>
      <div className="view-body scroll">
        {items.length === 0 && <div style={{ color: "var(--text-faint)", textAlign: "center", padding: 40 }}>{t("notif.empty")} 🔕</div>}
        {items.map((n) => (
          <div className={"lrow notif-row" + (n.read ? " read" : "")} key={n.id} style={{ cursor: "pointer" }} onClick={() => open(n)}>
            {!n.read && <span className="notif-unread" />}
            <div className="vh-icon" style={{ width: 32, height: 32, flex: "0 0 32px" }}><Icon name={ic[n.kind] || "dot"} size={14} /></div>
            <div className="lr-main">
              <div className="lr-title" style={{ fontWeight: n.read ? 400 : 600 }}>{n.text}</div>
              <div className="lr-sub">{t(`notif.kind.${n.kind}`)}{n.agentName ? " · " + n.agentName : ""}</div>
            </div>
            <span style={{ fontSize: 11, color: "var(--text-faint)", fontFamily: "var(--mono-font)" }}>{timeAgo(n.createdAt)}</span>
            <Icon name="chevronRight" size={14} style={{ color: "var(--text-faint)" }} />
          </div>
        ))}
      </div>
      {sel && (
        <div className="detail-overlay" onMouseDown={() => setSel(null)}>
          <div className="detail-panel" onMouseDown={(e) => e.stopPropagation()}>
            <div className="detail-head">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="pill" style={{ background: "var(--accent)22", color: "var(--accent)" }}>{t(`notif.kind.${sel.kind}`)}</span>
                <button className="dock-tool" onClick={() => setSel(null)}><Icon name="close" size={15} /></button>
              </div>
              <div className="view-title" style={{ fontSize: 16, marginTop: 8 }}>{sel.text}</div>
              <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 4 }}>{timeAgo(sel.createdAt)}</div>
            </div>
            <div className="detail-body">
              {sel.agentName && (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <Avatar name={sel.agentName} color={sel.agentColor || "#e0a44e"} size={24} health={sel.agentHealth} />
                  <span style={{ fontSize: 12.5 }}>{sel.agentName}</span>
                </div>
              )}
              <div style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.6 }}>{sel.detail || t("notif.noDetail")}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
