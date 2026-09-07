"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { useT } from "@/lib/i18n-context";
import { Icon } from "@/components/ui/icon";
import { startNewWork } from "@/server/planner";

// Hero call-to-actions. Most need the browser (focus the command bar), so they live in a small client
// island; the rest of the hero is server-rendered. "New work" opens the same title/brief modal as the
// CEO Planner (→ startNewWork), not a chat DM.
export function HomeHeroActions({ adaHandle, continueHref }: { adaHandle: string | null; continueHref: string | null }) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  function submitWork() {
    setErr("");
    start(async () => {
      const r = await startNewWork({ title: title.trim() || undefined, brief });
      if (!r.ok) { setErr(r.error ?? t("planner.newWork.failed")); return; }
      setOpen(false); setTitle(""); setBrief(""); router.push("/planner");
    });
  }

  return (
    <div className="home-actions">
      <button className="ha-primary" onClick={() => window.dispatchEvent(new CustomEvent("constella:focus-cmdbar"))}>
        <Icon name="branch" size={15} /> {t("home.act.askKb")}
      </button>
      {adaHandle && (
        <button className="ha-ghost" onClick={() => setOpen(true)}>
          <Icon name="command" size={15} /> {t("home.act.newWork")}
        </button>
      )}
      {continueHref && (
        <button className="ha-ghost" onClick={() => router.push(continueHref as Route)}>
          <Icon name="goto" size={15} /> {t("home.act.continue")}
        </button>
      )}
      <button className="ha-ghost" onClick={() => router.push("/inbox")}>
        <Icon name="inbox" size={15} /> {t("home.act.pending")}
      </button>

      {open && (
        <div className="modal-overlay" onMouseDown={() => !pending && setOpen(false)}>
          <div className="modal" style={{ padding: "20px 22px", width: 480, maxWidth: "94vw" }} onMouseDown={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>{t("planner.newWork.title")}</div>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 12 }}>{t("planner.newWork.desc")}</div>
            <label className="form-label">{t("planner.newWork.titleLabel")}</label>
            <input className="form-input" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("planner.newWork.titlePh")} />
            <label className="form-label">{t("planner.newWork.briefLabel")}</label>
            <textarea className="form-input" rows={5} value={brief} onChange={(e) => setBrief(e.target.value)} placeholder={t("planner.newWork.briefPh")} />
            {err && <div style={{ color: "#e8688f", fontSize: 12, marginTop: 8 }}>{err}</div>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button className="btn-ghost" disabled={pending} onClick={() => setOpen(false)}>{t("common.cancel")}</button>
              <button className="btn-accent" disabled={pending || !brief.trim()} onClick={submitWork}>{pending ? t("planner.newWork.planning") : t("planner.newWork.create")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
