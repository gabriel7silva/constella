"use client";

import { useState, useTransition } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { Avatar } from "@/components/ui/avatar";
import { resolveInbox } from "@/server/actions/inbox-actions";
import { approvePlan, approveSpec, approveIssue } from "@/server/planner";
import { formatWhen } from "@/lib/when";
import { useT } from "@/lib/i18n-context";

type Kind = "approval" | "budget" | "question" | "review" | "block" | "validation";

export type InboxItem = {
  id: string;
  kind: Kind;
  title: string;
  detail: string;
  resolved: boolean;
  fromName: string | null;
  fromColor: string | null;
  fromHealth: "alive" | "stale" | "down" | null;
  refType: string | null;
  refId: string | null;
  channel: string | null;
  createdAt: Date | string | null;
};

const KIND_ICON: Record<Kind, string> = { approval: "check", budget: "coins", question: "chat", review: "doc", block: "close", validation: "pulse" };

const faint: CSSProperties = { color: "var(--text-faint)" };
const accentPill: CSSProperties = { background: "var(--accent)22", color: "var(--accent)" };

/** The real primary action for an item: actually approve the plan/spec/issue, or open the
 *  relevant screen — not just mark it resolved. Returns the button label key + the work to run. */
function primaryFor(i: InboxItem, router: ReturnType<typeof useRouter>): { labelKey: string; run: () => Promise<void> } | null {
  if (i.refType === "plan") return { labelKey: "inbox.action.approvePlan", run: () => approvePlan() };
  if (i.refType === "spec" && i.refId) return { labelKey: "inbox.action.approveSpec", run: () => approveSpec(i.refId!) };
  if (i.refType === "issue" && i.refId) return { labelKey: "inbox.action.approveIssue", run: () => approveIssue(i.refId!) };
  if (i.refType === "task") return { labelKey: "inbox.action.openTasks", run: async () => { router.push("/tasks"); } };
  if (i.refType === "validation") return { labelKey: "inbox.action.openTestDev", run: async () => { window.location.href = "/test-dev"; } };
  if (i.refType === "question") return {
    labelKey: "inbox.action.openChat",
    run: async () => {
      if (i.channel?.startsWith("dm:")) window.dispatchEvent(new CustomEvent("constella:open-dm", { detail: { handle: i.channel.slice(3) } }));
      else window.dispatchEvent(new Event("constella:toggle-chat"));
    },
  };
  return null;
}

/** Interactive inbox list + detail overlay — the central decision hub. The primary button runs
 *  the actual decision (approve the plan/spec/issue, open the channel/screen), then resolves. */
export function InboxList({ items }: { items: InboxItem[] }) {
  const t = useT();
  const [sel, setSel] = useState<InboxItem | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function setResolved(id: string, resolved: boolean) {
    start(async () => { await resolveInbox(id, resolved); router.refresh(); });
    setSel(null);
  }
  function act(i: InboxItem) {
    const p = primaryFor(i, router);
    start(async () => {
      try { if (p) await p.run(); } finally { await resolveInbox(i.id, true); router.refresh(); }
    });
    setSel(null);
  }

  return (
    <>
      <div className="view-body scroll">
        {items.length === 0 && (
          <div style={{ color: "var(--text-faint)", textAlign: "center", padding: 40 }}>{t("inbox.empty")} 🎉</div>
        )}
        {items.map((i) => (
          <div className="lrow" key={i.id} style={{ cursor: "pointer", opacity: i.resolved ? 0.5 : 1 }} onClick={() => setSel(i)}>
            <div className="vh-icon" style={{ width: 34, height: 34, flex: "0 0 34px" }}><Icon name={KIND_ICON[i.kind]} size={15} /></div>
            <div className="lr-main">
              <div className="lr-title" style={{ textDecoration: i.resolved ? "line-through" : "none" }}>{i.title}</div>
              <div className="lr-sub">{t(`inbox.kind.${i.kind}`)}{i.fromName ? ` · ${t("inbox.from", { name: i.fromName })}` : ""}{i.createdAt ? ` · ${formatWhen(i.createdAt)}` : ""}</div>
            </div>
            {i.fromName && <Avatar name={i.fromName} color={i.fromColor ?? "#e0a44e"} size={22} health={i.fromHealth} />}
            <Icon name="chevronRight" size={14} style={faint} />
          </div>
        ))}
      </div>

      {sel && (() => {
        const p = primaryFor(sel, router);
        return (
          <div className="detail-overlay" onMouseDown={() => setSel(null)}>
            <div className="detail-panel" onMouseDown={(e) => e.stopPropagation()}>
              <div className="detail-head">
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="pill" style={accentPill}>{t(`inbox.kind.${sel.kind}`)}</span>
                  <button className="dock-tool" onClick={() => setSel(null)}><Icon name="close" size={15} /></button>
                </div>
                <div className="view-title" style={{ fontSize: 16, marginTop: 8 }}>{sel.title}</div>
                {sel.createdAt && <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>{formatWhen(sel.createdAt)}</div>}
              </div>
              <div className="detail-body">
                {sel.fromName && (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <Avatar name={sel.fromName} color={sel.fromColor ?? "#e0a44e"} size={24} health={sel.fromHealth} />
                    <span style={{ fontSize: 12.5 }}>{sel.fromName}</span>
                  </div>
                )}
                {sel.detail
                  ? <div style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{sel.detail}</div>
                  : <div style={{ fontSize: 13, color: "var(--text-faint)", lineHeight: 1.6 }}>{t("inbox.noDetail")}</div>}
                <div style={{ display: "flex", gap: 8 }}>
                  {sel.resolved ? (
                    <button className="btn-ghost" disabled={pending} onClick={() => setResolved(sel.id, false)}>{t("inbox.action.reopen")}</button>
                  ) : (
                    <>
                      {p && <button className="btn-accent" disabled={pending} onClick={() => act(sel)}>{t(p.labelKey)}</button>}
                      <button className="btn-ghost" disabled={pending} onClick={() => setResolved(sel.id, true)}>{t("common.dismiss")}</button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
