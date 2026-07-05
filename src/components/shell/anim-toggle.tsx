"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { useT } from "@/lib/i18n-context";
import { toggleAnim } from "@/server/session";

/**
 * Quick toggle for the animated background (starfield / black hole / constellations). Off = a static
 * background + no requestAnimationFrame loop → real GPU savings on weaker machines. Self-contained:
 * reads the `cn-anim` cookie client-side so it can sit anywhere (topbar, login, settings) without
 * prop-threading. The actual on/off is applied server-side in layout.tsx (the `anim-off` html class
 * + Starfield `enabled`).
 */
export function AnimToggle({ labeled }: { labeled?: boolean }) {
  const t = useT();
  const router = useRouter();
  const [on, setOn] = useState(true);
  const [pending, start] = useTransition();
  useEffect(() => { setOn(!/(?:^|;\s*)cn-anim=off/.test(document.cookie)); }, []);
  const flip = () => start(async () => { await toggleAnim(); setOn((v) => !v); router.refresh(); });

  if (labeled) {
    return (
      <button className="btn-ghost" onClick={flip} disabled={pending} type="button" style={{ gap: 8 }}>
        <Icon name="pulse" size={14} style={{ opacity: on ? 1 : 0.4 }} /> {t("chrome.anim.label", { state: on ? t("common.on") : t("common.off") })}
      </button>
    );
  }
  return (
    <button className="top-btn" onClick={flip} disabled={pending} type="button" title={on ? t("chrome.anim.titleOn") : t("chrome.anim.titleOff")}>
      <Icon name="pulse" size={17} style={{ opacity: on ? 1 : 0.4 }} />
    </button>
  );
}
