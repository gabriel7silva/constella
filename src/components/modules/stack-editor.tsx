"use client";

import { useState, useTransition } from "react";
import { STACK_CATS } from "@/data/stack-catalog";
import { setWorkspaceStack } from "@/server/actions/org-actions";
import { incompat, reconcileStack } from "@/lib/stack-compat";
import { toggleStack, hasStack, splitStack } from "@/lib/stack-multi";
import { Icon } from "@/components/ui/icon";

/** Project Stacks editor (Config). Each category accepts ONE OR MORE picks (toggle chips) and saves the
 *  whole stack; the server action re-links every agent to the skills its new stack + role needs and
 *  re-indexes the KB. Incompatible options (wrong language family, etc.) are disabled — and any pick that
 *  BECOMES incompatible after a later choice is auto-deselected (never left blocked-but-selected). */
export function StackEditor({ stack }: { stack: Record<string, string> }) {
  const [sel, setSel] = useState<Record<string, string>>(() => reconcileStack(stack).stack);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [removed, setRemoved] = useState("");

  function toggle(key: string, opt: string) {
    const r = reconcileStack({ ...sel, [key]: toggleStack(sel[key], opt) });
    setSel(r.stack);
    setRemoved(r.removed.map((x) => `${x.opt} was unselected automatically — ${x.reason}.`).join("  "));
    setSaved(false);
  }
  function save() { start(async () => { await setWorkspaceStack(sel); setSaved(true); }); }

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "12px 16px" }}>
        {STACK_CATS.map((cat) => {
          const opts = cat.opts.includes("None") ? cat.opts : [...cat.opts, "None"];
          const picks = splitStack(sel[cat.key]).filter((p) => p !== "None");
          return (
            <div key={cat.key} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 11.5, color: "var(--text-dim)", fontWeight: 600 }}>
                {cat.label}{picks.length > 1 && <span style={{ color: "var(--text-faint)", fontWeight: 400 }}> · {picks.length}</span>}
              </span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {opts.map((o) => {
                  const bad = incompat(sel, cat.key, o);
                  const on = o === "None" ? picks.length === 0 : hasStack(sel[cat.key], o);
                  return (
                    <button key={o} type="button" disabled={!!bad && !on} onClick={() => { if (!bad || on) toggle(cat.key, o); }}
                      title={bad ? bad : o}
                      style={{
                        fontSize: 12, padding: "4px 9px", borderRadius: 999, cursor: bad && !on ? "not-allowed" : "pointer",
                        border: "1px solid " + (on ? "var(--accent)" : "var(--border)"),
                        background: on ? "var(--accent)" : "transparent",
                        color: on ? "#1a1206" : bad ? "var(--text-faint)" : "var(--text-dim)",
                        opacity: bad && !on ? 0.5 : 1,
                      }}>
                      {o}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {removed && <div style={{ fontSize: 12, color: "var(--sx-number)", marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}><Icon name="warn" size={12} /> {removed}</div>}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
        <button className="btn-accent" disabled={pending} onClick={save}>{pending ? "Saving…" : "Save stack & reload skills"}</button>
        {saved && <span style={{ fontSize: 12, color: "var(--sx-string)", display: "inline-flex", alignItems: "center", gap: 5 }}><Icon name="check" size={12} /> Saved — agents re-linked to the new stack.</span>}
      </div>
    </div>
  );
}
