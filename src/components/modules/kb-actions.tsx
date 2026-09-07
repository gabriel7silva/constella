"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { useT } from "@/lib/i18n-context";
import { curateKbAction, reindexKbAction } from "@/server/actions/kb-actions";

/** Operator controls for the Knowledge module: run Vannevar's curation pass + full reindex.
 *  Each action surfaces its real result inline (no more silent fire-and-forget). */
export function KbActions() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();
  const t = useT();
  function reindex() { start(async () => { setMsg(null); const r = await reindexKbAction(); setMsg(t("kb.reindexResult", { n: r.chunks })); router.refresh(); }); }
  function curate() { start(async () => { setMsg(null); const r = await curateKbAction(); setMsg(r.merged + r.retired + r.summarized + r.gaps > 0 ? t("kb.curateResult", { m: r.merged, r: r.retired, s: r.summarized, g: r.gaps }) : t("kb.curateNone")); router.refresh(); }); }
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      {msg && <span className="kb-actions-msg">{msg}</span>}
      <button className="btn-accent" disabled={pending} onClick={reindex}>
        <Icon name="sync" size={14} className={pending ? "sync-spin" : ""} /> {t("kb.reindex")}
      </button>
      <button className="btn-accent" disabled={pending} onClick={curate}>
        <Icon name="skill" size={14} className={pending ? "sync-spin" : ""} /> {pending ? t("kb.curating") : t("kb.curate")}
      </button>
    </div>
  );
}
