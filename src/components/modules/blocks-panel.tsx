"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Icon } from "@/components/ui/icon";
import { useT } from "@/lib/i18n-context";
import { saveBlockAction, deleteBlockAction, mergeProposalAction, rejectProposalAction } from "@/server/actions/blocks-actions";

type Block = { slug: string; kind: string; title: string; body: string; version: number; updatedBy: string };
type Proposal = { id: string; slug: string; kind: string; title: string; body: string; byAgentHandle: string };

/** Manage the canonical synced blocks + the pending agent-proposed edits (merge / reject). */
export function BlocksPanel({ blocks, proposals }: { blocks: Block[]; proposals: Proposal[] }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [edit, setEdit] = useState<{ slug: string; title: string; kind: string; body: string } | null>(null);
  const refresh = () => router.refresh();
  const save = () => { if (!edit) return; start(async () => { await saveBlockAction(edit); setEdit(null); refresh(); }); };

  return (
    <>
      {proposals.length > 0 && (
        <div className="card" style={{ marginTop: 12, borderColor: "#e8a14e" }}>
          <div className="lr-title" style={{ marginBottom: 8 }}><Icon name="inbox" size={14} style={{ color: "#e8a14e" }} /> {t("block.proposals")} ({proposals.length})</div>
          {proposals.map((p) => (
            <div key={p.id} className="lrow" style={{ alignItems: "flex-start" }}>
              <div className="lr-main">
                <div className="lr-title">{p.slug} <span className="muted" style={{ fontWeight: 400 }}>· @{p.byAgentHandle}</span></div>
                <div className="md" style={{ fontSize: 12, maxHeight: 120, overflow: "hidden" }}><ReactMarkdown remarkPlugins={[remarkGfm]}>{p.body.slice(0, 600)}</ReactMarkdown></div>
              </div>
              <div style={{ display: "flex", gap: 6, flex: "0 0 auto" }}>
                <button className="btn-accent" disabled={pending} onClick={() => start(async () => { await mergeProposalAction(p.id); refresh(); })}><Icon name="check" size={12} /> {t("block.merge")}</button>
                <button className="btn-ghost" disabled={pending} onClick={() => start(async () => { await rejectProposalAction(p.id); refresh(); })}>{t("block.reject")}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div className="lr-title"><Icon name="grid" size={14} style={{ color: "var(--accent)" }} /> {t("block.title")}</div>
          <button className="btn-ghost" onClick={() => setEdit({ slug: "", title: "", kind: "note", body: "" })}><Icon name="add" size={13} /> {t("block.new")}</button>
        </div>

        {edit && (
          <div className="card" style={{ marginBottom: 12, background: "var(--bg-panel)" }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
              <input className="form-input" style={{ width: 200 }} placeholder={t("block.slugPlaceholder")} value={edit.slug} onChange={(e) => setEdit({ ...edit, slug: e.target.value })} />
              <input className="form-input" style={{ width: 200 }} placeholder={t("block.titlePlaceholder")} value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
              <input className="form-input" style={{ width: 160 }} placeholder={t("block.kindPlaceholder")} value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value })} />
            </div>
            <textarea className="persona-ta mono" style={{ minHeight: 200, width: "100%" }} placeholder={t("block.bodyPlaceholder")} value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} />
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button className="btn-accent" disabled={pending || !edit.slug.trim() || !edit.body.trim()} onClick={save}><Icon name="check" size={13} /> {pending ? t("block.saving") : t("block.save")}</button>
              <button className="btn-ghost" onClick={() => setEdit(null)}>{t("block.cancel")}</button>
            </div>
          </div>
        )}

        {blocks.length === 0 && !edit && <div className="muted">{t("block.empty")}</div>}
        {blocks.map((b) => (
          <div key={b.slug} className="lrow" style={{ alignItems: "flex-start" }}>
            <div className="lr-main">
              <div className="lr-title">{b.title || b.slug} <span className="muted" style={{ fontWeight: 400 }}>· {b.slug} · {b.kind} · v{b.version} · {b.updatedBy}</span></div>
              <div className="md" style={{ fontSize: 12.5, maxHeight: 100, overflow: "hidden" }}><ReactMarkdown remarkPlugins={[remarkGfm]}>{b.body.slice(0, 400) || `_(${t("block.bodyEmpty")})_`}</ReactMarkdown></div>
            </div>
            <div style={{ display: "flex", gap: 6, flex: "0 0 auto" }}>
              <button className="btn-ghost" onClick={() => setEdit({ slug: b.slug, title: b.title, kind: b.kind, body: b.body })}><Icon name="command" size={12} /> {t("block.edit")}</button>
              <button className="btn-ghost" disabled={pending} title={t("block.delete")} onClick={() => start(async () => { await deleteBlockAction(b.slug); refresh(); })}><Icon name="trash" size={12} /></button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
