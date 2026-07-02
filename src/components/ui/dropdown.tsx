"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./icon";
import { ProviderGlyph } from "./provider-glyph";
import { useT } from "@/lib/i18n-context";

export type DropdownOption = { value: string; label: string; sub?: string; tag?: string; glyphId?: string };

/** Themed dropdown replacing native <select>. Ported 1:1 from the mock.
 *  Long lists (or `searchable`) get a type-to-filter box at the top of the menu. */
export function Dropdown({ value, options, onChange, placeholder, mono, glyph, disabled, searchable }: {
  value: string;
  options: (string | DropdownOption)[];
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  glyph?: boolean;
  disabled?: boolean;
  /** Force the search box on/off. Defaults to auto (on when there are more than 8 options). */
  searchable?: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const norm: DropdownOption[] = useMemo(() => (options || []).map((o) => (typeof o === "string" ? { value: o, label: o } : o)), [options]);
  const cur = norm.find((o) => o.value === value);
  const canSearch = (searchable ?? norm.length > 8) && !disabled;
  const ql = q.trim().toLowerCase();
  const filtered = !canSearch || !ql ? norm : norm.filter((o) => (o.label + " " + o.value + " " + (o.sub || "")).toLowerCase().includes(ql));

  useEffect(() => {
    if (!open) { setQ(""); return; }
    function onDoc(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    function esc(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", esc);
    if (canSearch) requestAnimationFrame(() => inputRef.current?.focus());
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", esc); };
  }, [open, canSearch]);

  return (
    <div className={"dd" + (open ? " open" : "") + (disabled ? " disabled" : "")} ref={ref}>
      <button type="button" className={"dd-btn" + (mono ? " mono" : "")} onClick={() => !disabled && setOpen((o) => !o)}>
        {glyph && cur && <ProviderGlyph id={cur.glyphId || cur.value} size={20} />}
        <span className="dd-val">{cur ? cur.label : <span className="dd-ph">{placeholder || t("common.selectEllipsis")}</span>}</span>
        <Icon name="chevronDown" size={14} />
      </button>
      {open && (
        <div className="dd-menu scroll">
          {canSearch && (
            <div style={{ position: "sticky", top: 0, zIndex: 1, display: "flex", alignItems: "center", gap: 6, padding: "6px 8px", margin: "-4px -4px 4px", background: "var(--bg-elev, var(--bg-active))", borderBottom: "1px solid var(--border)" }}>
              <Icon name="search" size={13} />
              <input
                ref={inputRef}
                value={q}
                placeholder={t("common.searchEllipsis")}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && filtered[0]) { onChange(filtered[0].value); setOpen(false); }
                  else if (e.key === "Escape") { if (q) { e.stopPropagation(); setQ(""); } }
                }}
                className={mono ? "mono" : undefined}
                style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", color: "var(--text)", fontSize: 12.5, fontFamily: mono ? "var(--mono-font)" : "inherit" }}
              />
              {q && <button type="button" title={t("common.clear")} onClick={() => { setQ(""); inputRef.current?.focus(); }} style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", display: "flex", padding: 0 }}><Icon name="close" size={12} /></button>}
            </div>
          )}
          {norm.length === 0 && <div className="dd-empty">{t("common.noOptions")}</div>}
          {norm.length > 0 && filtered.length === 0 && <div className="dd-empty">{t("dropdown.noMatch", { q })}</div>}
          {filtered.map((o) => (
            <button type="button" key={o.value} className={"dd-opt" + (o.value === value ? " on" : "")}
                    onClick={() => { onChange(o.value); setOpen(false); }}>
              {glyph && <ProviderGlyph id={o.glyphId || o.value} size={22} />}
              <span className="dd-opt-main">
                <span className={"dd-opt-label" + (mono ? " mono" : "")}>{o.label}</span>
                {o.sub && <span className="dd-opt-sub">{o.sub}</span>}
              </span>
              {o.tag && <span className="dd-opt-tag">{o.tag}</span>}
              {o.value === value && <Icon name="check" size={13} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
