"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/icon";
import { useT } from "@/lib/i18n-context";
import { recentNotifications, type ToastNotif } from "@/server/actions/toast-actions";

/** In-app toast notifications: polls for NEW notifications (those created after mount) and pops a
 *  toast per one. Click a chat-channel toast → opens the chat dock on that channel; otherwise →
 *  /notifications. Auto-dismisses. Pairs with the bell badge (Topbar) + Telegram delivery. */
export function Toaster() {
  const tr = useT();
  const [toasts, setToasts] = useState<ToastNotif[]>([]);
  const since = useRef<number>(0);
  const seen = useRef<Set<string>>(new Set());
  const router = useRouter();

  useEffect(() => {
    since.current = Date.now(); // only surface notifications created AFTER this tab loaded
    let on = true;
    const tick = async () => {
      try {
        const rows = await recentNotifications(since.current);
        if (!on || !rows.length) return;
        since.current = Math.max(since.current, ...rows.map((r) => r.at));
        const fresh = rows.filter((r) => !seen.current.has(r.id));
        if (!fresh.length) return;
        fresh.forEach((r) => seen.current.add(r.id));
        setToasts((prev) => [...fresh, ...prev].slice(0, 4));
      } catch { /* ignore poll errors */ }
    };
    const iv = setInterval(tick, 8000);
    return () => { on = false; clearInterval(iv); };
  }, []);

  // Auto-dismiss: each toast disappears 7s after IT appears (one timer per id). The old single shared timer
  // reset on every new toast, so a steady stream kept resurrecting the oldest toast's countdown and toasts
  // lingered well past 7s.
  const scheduled = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const toast of toasts) {
      if (scheduled.current.has(toast.id)) continue;
      scheduled.current.add(toast.id);
      setTimeout(() => setToasts((p) => p.filter((x) => x.id !== toast.id)), 7000);
    }
  }, [toasts]);

  function dismiss(id: string) { setToasts((p) => p.filter((t) => t.id !== id)); }
  function isChat(ch: string) { return ch === "room" || ch === "telegram" || ch.startsWith("dm:"); }
  function act(t: ToastNotif) {
    dismiss(t.id);
    if (t.channel && isChat(t.channel)) window.dispatchEvent(new CustomEvent("constella:open-chat", { detail: { channel: t.channel } }));
    else router.push("/notifications");
  }

  if (!toasts.length) return null;
  return (
    <div className="toaster">
      {toasts.map((t) => (
        <div key={t.id} className={"toast toast-" + t.kind} role="status" onClick={() => act(t)}>
          <span className="toast-ic"><Icon name={iconFor(t.kind)} size={15} /></span>
          <div className="toast-body">
            <div className="toast-title">{t.text}</div>
            {t.detail && <div className="toast-detail">{t.detail}</div>}
          </div>
          <button className="toast-x" title={tr("common.dismiss")} onClick={(e) => { e.stopPropagation(); dismiss(t.id); }}><Icon name="close" size={12} /></button>
        </div>
      ))}
    </div>
  );
}

function iconFor(kind: string): IconName {
  if (kind === "approval" || kind === "needs-approval") return "inbox";
  if (kind === "security" || kind === "block" || kind === "blocked") return "shield";
  if (kind === "deploy") return "goto";
  if (kind === "error" || kind === "warn" || kind === "warning") return "warn";
  if (kind.startsWith("dm") || kind === "mention" || kind === "message") return "chat";
  return "bell";
}
