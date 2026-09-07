"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLang } from "@/server/session";
import type { Lang } from "@/lib/i18n";

/** EN | PT language switcher. Self-contained (reads the cn-lang cookie client-side) so it sits in the
 *  topbar, the login screen and the profile without prop-threading. The active language is applied
 *  server-side in layout.tsx (the LangProvider + <html lang>). */
export function LangSwitch() {
  const router = useRouter();
  const [lang, setL] = useState<Lang>("en");
  const [pending, start] = useTransition();
  useEffect(() => { setL(/(?:^|;\s*)cn-lang=pt/.test(document.cookie) ? "pt" : "en"); }, []);
  const pick = (l: Lang) => { if (l === lang || pending) return; start(async () => { await setLang(l); setL(l); router.refresh(); }); };
  return (
    <div style={{ display: "inline-flex", border: "1px solid var(--border)", borderRadius: 7, overflow: "hidden" }}>
      {(["en", "pt"] as const).map((l) => (
        <button key={l} type="button" disabled={pending} onClick={() => pick(l)} title={l === "en" ? "English" : "Português (BR)"}
          style={{
            padding: "3px 8px", fontSize: 11, fontWeight: 600, cursor: "pointer", border: "none",
            background: lang === l ? "var(--accent)" : "transparent",
            color: lang === l ? "var(--accent-fg)" : "var(--text-dim)",
          }}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
