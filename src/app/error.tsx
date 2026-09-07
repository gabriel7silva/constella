"use client";

import { useT } from "@/lib/i18n-context";

// Root-segment error boundary (auth pages, onboarding, etc.).
export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT();
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#0a0c14", color: "#e6e8f0", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 460, padding: 28, textAlign: "center" }}>
        <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 8 }}>{t("errors.pageTitle")}</div>
        <div style={{ fontSize: 13, color: "#9aa0b8", marginBottom: 16, wordBreak: "break-word" }}>{error.message || t("errors.unexpected")}</div>
        {error.digest && <div style={{ fontSize: 11, color: "#6b7290", marginBottom: 16, fontFamily: "monospace" }}>{t("errors.digest")}: {error.digest}</div>}
        <button onClick={() => reset()} style={{ padding: "9px 18px", borderRadius: 9, border: "1px solid #2a2f45", background: "#e0a44e", color: "#1a1206", fontWeight: 700, cursor: "pointer" }}>{t("errors.tryAgain")}</button>
      </div>
    </div>
  );
}
