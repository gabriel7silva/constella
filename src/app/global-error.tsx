"use client";

import { useEffect } from "react";
import { t as translate, normalizeLang } from "@/lib/i18n";
import { isRecoverableClientCrash, reloadOnceForSkew } from "@/lib/deployment-skew";

// Catches errors thrown in the ROOT layout itself (the last-resort boundary). Must render
// its own <html>/<body> because the root layout failed. Kept dependency-free (inline styles)
// so it works even if globals.css / the theme is what broke.
// This renders OUTSIDE LangProvider, so it reads the language from the cn-lang cookie directly.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const lang = normalizeLang(typeof document !== "undefined" ? document.cookie.match(/(?:^|;\s*)cn-lang=([^;]+)/)?.[1] : null);
  const t = (key: string) => translate(lang, key);
  // Most root crashes here are recoverable: version skew after a self-update (stale bundle), or the App Router
  // "layout router" invariant from a refresh landing on a mismatched payload. A hard reload onto the fresh
  // bundle clears them — loop-guarded, so a genuinely persistent failure still falls through to the button.
  useEffect(() => { if (isRecoverableClientCrash(error)) reloadOnceForSkew(); }, [error]);
  return (
    <html lang={lang}>
      <body style={{ margin: 0, background: "#0a0c14", color: "#e6e8f0", fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh" }}>
        <div style={{ maxWidth: 460, padding: 28, textAlign: "center" }}>
          <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 8 }}>{t("errors.rootTitle")}</div>
          <div style={{ fontSize: 13, color: "#9aa0b8", marginBottom: 16, wordBreak: "break-word" }}>{error.message || t("errors.unexpected")}</div>
          {error.digest && <div style={{ fontSize: 11, color: "#6b7290", marginBottom: 16, fontFamily: "monospace" }}>{t("errors.digest")}: {error.digest}</div>}
          <button onClick={() => reset()} style={{ padding: "9px 18px", borderRadius: 9, border: "1px solid #2a2f45", background: "#e0a44e", color: "#1a1206", fontWeight: 700, cursor: "pointer" }}>{t("errors.reload")}</button>
        </div>
      </body>
    </html>
  );
}
