"use client";

import { Icon } from "@/components/ui/icon";
import { useT } from "@/lib/i18n-context";

/** In-app confirmation modal (styled — never the native browser `confirm()`), for a destructive action.
 *  `error`, if set, shows inline above the actions instead of a separate `alert()`. */
export function ConfirmDialog({ title, body, confirmLabel, error, pending, onConfirm, onCancel }: {
  title: string; body: string; confirmLabel: string; error?: string; pending?: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  const t = useT();
  return (
    <div className="modal-overlay" onMouseDown={() => !pending && onCancel()}>
      <div className="modal" style={{ width: 380 }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head"><div className="modal-title"><Icon name="trash" size={15} style={{ color: "var(--sx-keyword)" }} /> {title}</div></div>
        <div className="modal-body">
          <div style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.55 }}>{body}</div>
          {error && <div className="form-hint" style={{ color: "var(--sx-keyword)", marginTop: 8 }}><Icon name="close" size={12} /> {error}</div>}
        </div>
        <div className="modal-foot">
          <button className="btn-ghost" onClick={onCancel} disabled={pending}>{t("common.cancel")}</button>
          <button className="btn-accent" style={{ background: "var(--sx-keyword)", borderColor: "var(--sx-keyword)", color: "#fff" }} disabled={pending} onClick={onConfirm}>{pending ? t("common.saving") : confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
