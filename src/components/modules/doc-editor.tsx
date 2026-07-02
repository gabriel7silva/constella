"use client";

import { useState, useTransition } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Icon } from "@/components/ui/icon";
import { saveDoc } from "@/server/docs";
import { useT } from "@/lib/i18n-context";

/** Read/edit a DOCS or PO markdown file. Saving writes through to disk (the source of truth). */
export function DocEditor({ docId, path, initial }: { docId: string; path: string; initial: string }) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(initial);
  const [pending, start] = useTransition();

  return (
    <div className="card" style={{ maxWidth: 880 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
        {editing ? (
          <>
            <button className="btn-accent" disabled={pending} onClick={() => start(async () => { await saveDoc(docId, text); setEditing(false); })}>
              <Icon name="check" size={13} /> {pending ? t("common.saving") : t("docsedit.saveMd")}
            </button>
            <button className="btn-ghost" onClick={() => { setText(initial); setEditing(false); }}>{t("common.cancel")}</button>
          </>
        ) : (
          <button className="btn-ghost" onClick={() => setEditing(true)}><Icon name="command" size={13} /> {t("common.edit")}</button>
        )}
        <span className="mono" style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-faint)" }}>{path}</span>
      </div>
      {editing ? (
        <textarea className="persona-ta mono" style={{ minHeight: 460, width: "100%" }} value={text} onChange={(e) => setText(e.target.value)} />
      ) : (
        <div className="md">{text.trim() ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown> : <div className="muted">{t("docsedit.emptyFile")}</div>}</div>
      )}
    </div>
  );
}
