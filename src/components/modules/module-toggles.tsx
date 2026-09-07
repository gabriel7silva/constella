"use client";

import { useTransition } from "react";
import { toggleRoutine, togglePlugin, resolveInbox, fixFinding, runReview } from "@/server/modules";
import { Icon } from "@/components/ui/icon";
import { useT } from "@/lib/i18n-context";

export function Toggle({ kind, id, on }: { kind: "routine" | "plugin"; id: string; on: boolean }) {
  const [pending, start] = useTransition();
  const fn = kind === "routine" ? toggleRoutine : togglePlugin;
  return <div className={"toggle" + (on ? " on" : "")} aria-disabled={pending} role="switch" aria-checked={on} onClick={() => !pending && start(() => fn(id, !on))} />;
}

export function ResolveButton({ id }: { id: string }) {
  const t = useT();
  const [pending, start] = useTransition();
  return <button className="btn-accent" disabled={pending} onClick={() => start(() => resolveInbox(id))}>{t("inbox.resolve")}</button>;
}

export function FixButton({ id }: { id: string }) {
  const t = useT();
  const [pending, start] = useTransition();
  return <button className="sc2-btn" disabled={pending} onClick={() => start(() => fixFinding(id))}><Icon name="bot" size={12} /> {t("security.letAgentFix")}</button>;
}

export function RunReviewButton() {
  const t = useT();
  const [pending, start] = useTransition();
  return (
    <button className="btn-accent" disabled={pending} onClick={() => {
      window.dispatchEvent(new CustomEvent("constella:agent-run", { detail: { channel: "security" } }));
      start(async () => { await runReview(); });
    }}>
      <Icon name="refresh" size={14} className={pending ? "sync-spin" : ""} /> {pending ? t("security.reviewing") : t("security.runReview")}
    </button>
  );
}
