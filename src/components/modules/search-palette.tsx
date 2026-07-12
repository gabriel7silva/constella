"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { FileGlyph } from "@/components/ui/file-glyph";
import { useT } from "@/lib/i18n-context";

/** A searchable workspace row, rendered 1:1 with the mock's per-file search result. */
export type SearchEntry = {
  group: string;
  name: string;
  path: string;
  ext: string;
  href: string;
  lines: string[];
};

type Match = { line: number; text: string; idx: number; len: number };
type ResultFile = SearchEntry & { matches: Match[] };

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function SearchPalette({ index, empty }: { index: SearchEntry[]; empty: boolean }) {
  const router = useRouter();
  const t = useT();
  const [q, setQ] = useState("");
  const [caseSens, setCaseSens] = useState(false);
  const [whole, setWhole] = useState(false);
  const [regex, setRegex] = useState(false);

  const results = useMemo<ResultFile[]>(() => {
    if (!q.trim()) return [];

    // Build a matcher honoring the three real toolbar toggles.
    let re: RegExp | null = null;
    try {
      let pattern = regex ? q : escapeRegex(q);
      if (whole) pattern = `\\b(?:${pattern})\\b`;
      re = new RegExp(pattern, caseSens ? "g" : "gi");
    } catch {
      re = null; // invalid user regex → no matches, never crash
    }
    if (!re) return [];

    const out: ResultFile[] = [];
    for (const entry of index) {
      const matches: Match[] = [];
      entry.lines.forEach((line, i) => {
        re!.lastIndex = 0;
        const m = re!.exec(line);
        if (m && m[0].length > 0) {
          matches.push({ line: i, text: line, idx: m.index, len: m[0].length });
        }
      });
      if (matches.length) out.push({ ...entry, matches });
    }
    return out;
  }, [q, caseSens, whole, regex, index]);

  const totalMatches = results.reduce((a, r) => a + r.matches.length, 0);
  const invalidRegex = regex && q.trim() !== "" && (() => {
    try { new RegExp(q); return false; } catch { return true; }
  })();

  function open(href: string) {
    router.push(href as Route);
  }

  function renderMatch(m: Match) {
    const before = m.text.slice(0, m.idx);
    const hit = m.text.slice(m.idx, m.idx + m.len);
    const after = m.text.slice(m.idx + m.len);
    return <>{before}<mark>{hit}</mark>{after}</>;
  }

  return (
    <div className="search-panel">
      <div className="search-input-wrap">
        <input className="search-input" placeholder={t("common.search")} value={q}
               autoFocus onChange={(e) => setQ(e.target.value)} />
      </div>
      <input className="replace-input" placeholder={t("search.replace")} disabled />
      <div className="search-toolbar">
        <button className={"search-toggle" + (caseSens ? " on" : "")} title={t("search.matchCase")}
                onClick={() => setCaseSens((v) => !v)}>Aa</button>
        <button className={"search-toggle" + (whole ? " on" : "")} title={t("search.matchWholeWord")}
                onClick={() => setWhole((v) => !v)}>ab</button>
        <button className={"search-toggle" + (regex ? " on" : "")} title={t("search.useRegex")}
                onClick={() => setRegex((v) => !v)}>.*</button>
      </div>
      {q.trim() && !invalidRegex && (
        <div className="search-summary">
          {t("search.summary", { results: totalMatches, files: results.length })}
        </div>
      )}
      {q.trim() && invalidRegex && (
        <div className="search-summary">{t("search.invalidRegex")}</div>
      )}
      {!q.trim() && empty && (
        <div className="search-summary">{t("search.emptyWorkspace")}</div>
      )}
      {q.trim() && !invalidRegex && results.length === 0 && (
        <div className="search-summary">{t("search.noResultsFor", { q })}</div>
      )}
      <div>
        {results.map((r) => (
          <div className="search-result-file" key={r.group + "/" + r.path}>
            <div className="search-file-row" onClick={() => open(r.href)}>
              <FileGlyph name={`x.${r.ext}`} />
              <span>{r.name}</span>
              <span style={{ color: "var(--text-faint)", fontSize: 11 }}>{r.path}</span>
              <span className="count">{r.matches.length}</span>
            </div>
            {r.matches.slice(0, 6).map((m, i) => (
              <div className="search-match" key={i} onClick={() => open(r.href)}>
                {renderMatch(m)}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
