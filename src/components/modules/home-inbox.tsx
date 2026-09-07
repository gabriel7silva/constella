"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n-context";
import { Icon } from "@/components/ui/icon";
import { resolveInbox } from "@/server/actions/inbox-actions";
import { approvePlan, approveSpec, approveIssue, rejectSpec, rejectIssue } from "@/server/planner";
import { timeAgo } from "@/lib/timeago";
import type { DecisionItem } from "@/server/home";

// "Precisa da sua decisão" — the home's decision hub. Reuses the real approve/reject actions
// (plan/spec/issue) and resolves the inbox item once the action runs. Anything without a direct
// action falls back to opening the full Inbox.
const KIND_ICON: Record<string, string> = { approval: "check", budget: "coins", question: "chat", review: "doc", block: "close", validation: "pulse" };

export function HomeInbox({ items }: { items: DecisionItem[] }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busyId, setBusy] = useState<string | null>(null);

  function run(id: string, fn: () => Promise<unknown>) {
    setBusy(id);
    start(async () => {
      try { await fn(); } catch { /* surfaced elsewhere */ } finally { await resolveInbox(id, true); setBusy(null); router.refresh(); }
    });
  }
  function approve(i: DecisionItem) {
    if (i.refType === "plan") return run(i.id, () => approvePlan());
    if (i.refType === "spec" && i.refId) return run(i.id, () => approveSpec(i.refId!));
    if (i.refType === "issue" && i.refId) return run(i.id, () => approveIssue(i.refId!));
    router.push("/inbox");
  }
  function reject(i: DecisionItem) {
    if (i.refType === "spec" && i.refId) return run(i.id, () => rejectSpec(i.refId!));
    if (i.refType === "issue" && i.refId) return run(i.id, () => rejectIssue(i.refId!));
    return run(i.id, async () => {});
  }
  const canApprove = (i: DecisionItem) => i.refType === "plan" || ((i.refType === "spec" || i.refType === "issue") && !!i.refId);
  const canReject = (i: DecisionItem) => (i.refType === "spec" || i.refType === "issue") && !!i.refId;

  if (items.length === 0) return <div className="home-empty">{t("home.decisions.empty")}</div>;
  return (
    <div className="decide-list">
      {items.map((i) => {
        const busy = pending && busyId === i.id;
        return (
          <div className="decide-row" key={i.id}>
            <div className="dr-ico"><Icon name={KIND_ICON[i.kind] ?? "bell"} size={15} /></div>
            <div className="dr-main">
              <div className="dr-title">{i.title}</div>
              {i.detail ? <div className="dr-reason">{i.detail}</div> : null}
              <div className="dr-sub">
                {i.refType ? <span className="dr-ref">{i.refType}</span> : null}
                <span>{t("home.decisions.kind." + i.kind)}{i.fromName ? " · " + i.fromName : ""}{i.createdAt ? " · " + timeAgo(new Date(i.createdAt)) : ""}</span>
              </div>
            </div>
            <div className="dr-actions">
              {canApprove(i) && <button className="dr-approve" disabled={busy} onClick={() => approve(i)}>{t("home.decisions.approve")}</button>}
              {canReject(i) && <button className="dr-reject" disabled={busy} onClick={() => reject(i)}>{t("home.decisions.reject")}</button>}
              <button className="dr-ghost" onClick={() => router.push("/inbox")} title={t("home.decisions.details")}><Icon name="goto" size={13} /></button>
              <button className="dr-ghost" onClick={() => window.dispatchEvent(new CustomEvent("constella:focus-cmdbar"))} title={t("home.decisions.askKb")}><Icon name="branch" size={13} /></button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
