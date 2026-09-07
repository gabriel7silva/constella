"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n-context";
import { setRunMode } from "@/server/actions/runner-actions";
import { Icon } from "@/components/ui/icon";

// The hero status chip. When agents are working it's a plain badge; when idle it's a real button that
// actually starts the autonomous loop (setRunMode("start")) — no more dead "start the loop in Config".
export function HomeStatusChip({ running, activeAgents }: { running: boolean; activeAgents: number }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();

  if (running) {
    return <span className="home-status-chip running"><span className="hsc-dot" /> {t("home.statusRunning", { n: activeAgents })}</span>;
  }
  function startAgents() { start(async () => { await setRunMode("start"); router.refresh(); }); }
  return (
    <button className="home-status-chip idle" onClick={startAgents} disabled={pending} title={t("home.startHint")}>
      <span className="hsc-dot off" /> <Icon name="play" size={12} /> {pending ? t("home.starting") : t("home.startAgents")}
    </button>
  );
}
