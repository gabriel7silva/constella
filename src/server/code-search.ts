"use server";

import { requireWorkspace } from "@/lib/workspace";
import { listFiles, readWorkspaceFile } from "@/lib/fs-workspace";

/**
 * Project-wide search for the Code module: matches file/folder NAMES + line CONTENT across the
 * workspace (skipping HEAVY_DIRS via listFiles), bounded for big projects. One result per matching
 * line; the client highlights every occurrence in the line. Honors case / whole-word / regex —
 * same matcher as the global search-palette.
 */
export type GrepMatch = { line: number; col: number; text: string };
export type GrepFile = { path: string; nameMatch: boolean; matches: GrepMatch[] };

const MAX_FILES = 2000;
const MAX_FILE_BYTES = 512 * 1024;
const MAX_RESULTS = 1000;

function escapeRegex(s: string): string { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

export async function grepWorkspace(query: string, opts?: { caseSensitive?: boolean; wholeWord?: boolean; regex?: boolean }):
  Promise<{ ok: boolean; files: GrepFile[]; truncated: boolean; scanned: number; error?: string }> {
  const q = (query || "").trim();
  if (q.length < 2) return { ok: true, files: [], truncated: false, scanned: 0 };
  const { org } = await requireWorkspace();

  let re: RegExp;
  try {
    let pattern = opts?.regex ? q : escapeRegex(q);
    if (opts?.wholeWord) pattern = `\\b(?:${pattern})\\b`;
    re = new RegExp(pattern, opts?.caseSensitive ? "g" : "gi");
  } catch { return { ok: false, files: [], truncated: false, scanned: 0, error: "Invalid regular expression." }; }
  let nameRe: RegExp;
  try { nameRe = new RegExp(opts?.regex ? q : escapeRegex(q), opts?.caseSensitive ? "" : "i"); } catch { nameRe = re; }

  const all = listFiles(org.id).slice(0, MAX_FILES);
  const files: GrepFile[] = [];
  let total = 0, scanned = 0, truncated = false;

  for (const path of all) {
    if (total >= MAX_RESULTS) { truncated = true; break; }
    const base = path.split("/").pop() ?? path;
    const nameMatch = nameRe.test(base) || nameRe.test(path);
    const content = readWorkspaceFile(org.id, path);
    const matches: GrepMatch[] = [];
    if (content && content.length <= MAX_FILE_BYTES && !content.includes("\0")) {
      scanned++;
      const lines = content.split("\n");
      for (let i = 0; i < lines.length && total < MAX_RESULTS; i++) {
        const ln = lines[i];
        if (ln.length > 4000) continue;
        re.lastIndex = 0;
        const m = re.exec(ln);
        if (m && m[0].length > 0) { matches.push({ line: i + 1, col: m.index + 1, text: ln.slice(0, 400) }); total++; }
      }
    }
    if (nameMatch || matches.length) files.push({ path, nameMatch, matches });
  }
  return { ok: true, files, truncated, scanned };
}
