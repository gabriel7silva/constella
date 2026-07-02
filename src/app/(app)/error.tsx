"use client";

// Error boundary for pages inside the app shell — keeps the sidebar/chat usable and lets the
// operator retry or navigate away instead of the whole app going blank. (A throw in the
// (app) LAYOUT itself bubbles to src/app/error.tsx.)
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n-context";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  const t = useT();
  return (
    <div style={{ height: "100%", display: "grid", placeItems: "center", padding: 40 }}>
      <div style={{ maxWidth: 480, textAlign: "center" }}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8, color: "var(--text)" }}>{t("errors.screenTitle")}</div>
        <div style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 14, wordBreak: "break-word" }}>{error.message || t("errors.unexpected")}</div>
        {error.digest && <div style={{ fontSize: 11, color: "var(--text-faint)", marginBottom: 16, fontFamily: "var(--mono-font, monospace)" }}>{t("errors.digest")}: {error.digest}</div>}
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          <button className="btn-accent" onClick={() => reset()}>{t("errors.tryAgain")}</button>
          <button className="btn-ghost" onClick={() => router.push("/")}>{t("errors.goDashboard")}</button>
        </div>
      </div>
    </div>
  );
}
