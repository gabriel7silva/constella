"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { useT } from "@/lib/i18n-context";
import { Icon } from "@/components/ui/icon";
import { FileGlyph } from "@/components/ui/file-glyph";
import { createFile, createFolder, saveFileContent, deleteFile } from "@/server/files";
import { fileDiff } from "@/server/github";
import { grepWorkspace, type GrepFile } from "@/server/code-search";

export type FileRow = { id: string; path: string; lang: string; content: string; gitStatus: string };

/** Build a client-side matcher (same rules as grepWorkspace) for in-editor highlight. */
function buildRe(q: string, o: { caseSensitive?: boolean; wholeWord?: boolean; regex?: boolean }): RegExp | null {
  if (!q || q.trim().length < 1) return null;
  try {
    let p = o.regex ? q : q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (o.wholeWord) p = `\\b(?:${p})\\b`;
    return new RegExp(p, o.caseSensitive ? "g" : "gi");
  } catch { return null; }
}
/** Wrap every occurrence of the matcher in <mark> (all-occurrence highlight). */
function markText(text: string, re: RegExp | null): ReactNode {
  if (!re) return text || "​";
  const out: ReactNode[] = []; let last = 0; let k = 0; re.lastIndex = 0; let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m[0].length === 0) { re.lastIndex++; continue; }
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(<mark key={k++}>{m[0]}</mark>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out.length ? out : (text || "​");
}

/** Inline unified-diff overlay for a changed file (real `git diff`). */
function DiffOverlay({ path, onClose }: { path: string; onClose: () => void }) {
  const t = useT();
  const [diff, setDiff] = useState<string | null>(null);
  useEffect(() => { let on = true; fileDiff(path).then((r) => { if (on) setDiff(r.diff || t("codeedit.noDiff")); }); return () => { on = false; }; }, [path, t]);
  return (
    <div className="detail-overlay" onMouseDown={onClose}>
      <div className="detail-panel" style={{ width: 720, maxWidth: "94vw" }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="detail-head">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="view-title" style={{ fontSize: 14, fontFamily: "var(--mono-font)" }}>{path}</span>
            <button className="dock-tool" onClick={onClose}><Icon name="close" size={15} /></button>
          </div>
        </div>
        <div className="detail-body">
          {diff === null ? <div className="muted"><span className="spin"><Icon name="refresh" size={13} /></span> {t("codeedit.loadingDiff")}</div> : (
            <pre className="scroll" style={{ maxHeight: "60vh", overflow: "auto", fontFamily: "var(--mono-font)", fontSize: 12, lineHeight: 1.5, margin: 0 }}>
              {diff.split("\n").map((l, i) => (
                <div key={i} style={{ color: l.startsWith("+") && !l.startsWith("+++") ? "var(--sx-string)" : l.startsWith("-") && !l.startsWith("---") ? "#e8688f" : l.startsWith("@@") ? "var(--accent)" : "var(--text-dim)", whiteSpace: "pre-wrap" }}>{l || "​"}</div>
              ))}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

type TreeNodeData =
  | { type: "dir"; name: string; path: string; children: TreeNodeData[] }
  | { type: "file"; name: string; path: string };

/** Build a nested dir/file tree from flat workspace paths (disk is truth). */
function buildTree(files: FileRow[]): TreeNodeData[] {
  const root: TreeNodeData[] = [];
  for (const f of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
    const parts = f.path.split("/");
    let level = root;
    let acc = "";
    parts.forEach((seg, i) => {
      acc = acc ? acc + "/" + seg : seg;
      if (i === parts.length - 1) {
        level.push({ type: "file", name: seg, path: f.path });
      } else {
        let dir = level.find((n) => n.type === "dir" && n.path === acc) as
          | (TreeNodeData & { type: "dir" })
          | undefined;
        if (!dir) {
          dir = { type: "dir", name: seg, path: acc, children: [] };
          level.push(dir);
        }
        level = dir.children;
      }
    });
  }
  const sort = (ns: TreeNodeData[]): TreeNodeData[] =>
    ns
      .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1))
      .map((n) => (n.type === "dir" ? { ...n, children: sort(n.children) } : n));
  return sort(root);
}

// ---- syntax highlight (small, linear, never throws) ----
const KW = new Set([
  "import", "from", "export", "const", "let", "var", "function", "return", "if", "else", "for", "while",
  "async", "await", "type", "interface", "class", "extends", "implements", "new", "try", "catch", "finally",
  "throw", "switch", "case", "break", "continue", "default", "of", "in", "typeof", "instanceof", "void",
  "null", "undefined", "true", "false", "this", "super", "public", "private", "protected", "readonly",
  "static", "enum", "as", "yield", "do", "then", "def", "lambda", "with", "pass", "elif", "None", "True", "False",
]);
type Tok = { t: string; c: string };
function tokenize(line: string, lang: string): Tok[] {
  const out: Tok[] = [];
  const hashComment = lang === "py" || lang === "yaml";
  let i = 0;
  const W = /[A-Za-z0-9_$]/;
  while (i < line.length) {
    const ch = line[i];
    if (ch === "/" && line[i + 1] === "/") { out.push({ t: line.slice(i), c: "comment" }); break; }
    if (ch === "#" && hashComment) { out.push({ t: line.slice(i), c: "comment" }); break; }
    if (ch === '"' || ch === "'" || ch === "`") {
      let j = i + 1;
      while (j < line.length && line[j] !== ch) { if (line[j] === "\\") j++; j++; }
      const end = Math.min(j + 1, line.length);
      out.push({ t: line.slice(i, end), c: "string" });
      i = end; continue;
    }
    if (ch >= "0" && ch <= "9" && !W.test(line[i - 1] ?? " ")) {
      let j = i; while (j < line.length && /[0-9.xXa-fA-F_]/.test(line[j])) j++;
      out.push({ t: line.slice(i, j), c: "number" }); i = j; continue;
    }
    if (/[A-Za-z_$]/.test(ch)) {
      let j = i; while (j < line.length && W.test(line[j])) j++;
      const w = line.slice(i, j);
      out.push({ t: w, c: KW.has(w) ? "keyword" : /^[A-Z]/.test(w) ? "type" : "plain" });
      i = j; continue;
    }
    out.push({ t: ch, c: /[{}()[\].,;]/.test(ch) ? "punct" : /\s/.test(ch) ? "plain" : "operator" });
    i++;
  }
  return out;
}

function TreeNode({
  node, depth, expanded, selected, onToggle, onOpen, onDelete, gitStatus,
}: {
  node: TreeNodeData;
  depth: number;
  expanded: Set<string>;
  selected: string | null;
  onToggle: (p: string) => void;
  onOpen: (p: string) => void;
  onDelete: (p: string, type: "file" | "dir") => void;
  gitStatus: Record<string, string>;
}) {
  const t = useT();
  const pad = 8 + depth * 14;
  if (node.type === "dir") {
    const isOpen = expanded.has(node.path);
    return (
      <>
        <div className="row dir" style={{ paddingLeft: pad }} onClick={() => onToggle(node.path)}>
          <span className="chev"><Icon name={isOpen ? "chevronDown" : "chevronRight"} size={12} /></span>
          <span className="name">{node.name}</span>
          <button className="row-del" title={t("codeedit.deleteFolderNamed", { name: node.name })}
            onClick={(e) => { e.stopPropagation(); onDelete(node.path, "dir"); }}>
            <Icon name="close" size={12} />
          </button>
        </div>
        {isOpen && node.children.map((c) => (
          <TreeNode key={c.path} node={c} depth={depth + 1} expanded={expanded} selected={selected}
            onToggle={onToggle} onOpen={onOpen} onDelete={onDelete} gitStatus={gitStatus} />
        ))}
      </>
    );
  }
  const st = gitStatus[node.path];
  return (
    <div className={"row file" + (selected === node.path ? " selected" : "")}
      style={{ paddingLeft: pad }} onClick={() => onOpen(node.path)}>
      <span className="chev" />
      <span className="fi"><FileGlyph name={node.name} /></span>
      <span className="name" style={st ? { color: st === "U" ? "var(--sx-number)" : "var(--sx-type)" } : undefined}>
        {node.name}
      </span>
      {st && <span className={"git-badge gstat " + st}>{st}</span>}
      <button className="row-del" title={t("codeedit.deleteNamed", { name: node.name })}
        onClick={(e) => { e.stopPropagation(); onDelete(node.path, "file"); }}>
        <Icon name="close" size={12} />
      </button>
    </div>
  );
}

export function CodeEditor({ files, repo, branch = "workspace" }: { files: FileRow[]; repo: string; branch?: string }) {
  const t = useT();
  const tree = useMemo(() => buildTree(files), [files]);
  const gitStatus = useMemo(
    () => Object.fromEntries(files.filter((f) => f.gitStatus).map((f) => [f.path, f.gitStatus])),
    [files],
  );

  const [tabs, setTabs] = useState<string[]>(() => (files[0] ? [files[0].path] : []));
  const [active, setActive] = useState<string | null>(files[0]?.path ?? null);
  const [side, setSide] = useState<"workspace" | "git" | "search">("workspace");
  // project-wide search
  const [sq, setSq] = useState("");
  const [sCase, setSCase] = useState(false); const [sWhole, setSWhole] = useState(false); const [sRegex, setSRegex] = useState(false);
  const [results, setResults] = useState<GrepFile[]>([]);
  const [searching, setSearching] = useState(false); const [truncated, setTruncated] = useState(false);
  const [scrollLine, setScrollLine] = useState<number | null>(null);
  const codeRef = useRef<HTMLDivElement>(null);
  const searchRe = useMemo(() => (side === "search" ? buildRe(sq, { caseSensitive: sCase, wholeWord: sWhole, regex: sRegex }) : null), [side, sq, sCase, sWhole, sRegex]);

  // Debounced project search.
  useEffect(() => {
    if (side !== "search" || sq.trim().length < 2) { setResults([]); setTruncated(false); return; }
    setSearching(true);
    const id = setTimeout(async () => {
      try {
        const r = await grepWorkspace(sq, { caseSensitive: sCase, wholeWord: sWhole, regex: sRegex });
        setResults(r.files); setTruncated(r.truncated);
      } finally { setSearching(false); }
    }, 250);
    return () => clearTimeout(id);
  }, [side, sq, sCase, sWhole, sRegex]);

  // Scroll the editor to a clicked match line.
  useEffect(() => {
    if (scrollLine == null) return;
    const el = codeRef.current?.querySelector(`[data-line="${scrollLine}"]`);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [scrollLine, active]);
  const [oeOpen, setOeOpen] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const s = new Set<string>();
    tree.forEach((n) => n.type === "dir" && s.add(n.path));
    return s;
  });
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [modal, setModal] = useState(false);
  const [modalKind, setModalKind] = useState<"file" | "folder">("file");
  const [name, setName] = useState("");
  const [confirm, setConfirm] = useState<{ path: string; type: "file" | "dir" } | null>(null);
  const [diffPath, setDiffPath] = useState<string | null>(null);
  const [, start] = useTransition();

  const cur = files.find((f) => f.path === active) ?? null;

  function toggle(p: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p); else next.add(p);
      return next;
    });
  }
  function open(p: string) {
    setTabs((prev) => (prev.includes(p) ? prev : [...prev, p]));
    setActive(p);
    setEditing(false);
  }
  function closeTab(p: string) {
    setTabs((prev) => {
      const next = prev.filter((t) => t !== p);
      if (active === p) setActive(next[next.length - 1] ?? null);
      return next;
    });
  }

  // Real git changes straight from the DB git status mirrored to disk paths.
  const entries = Object.entries(gitStatus).map(([path, st]) => ({
    path, st, name: path.split("/").pop() ?? path, dir: path.split("/").slice(0, -1).join("/"),
  }));
  const staged = entries.filter((e) => e.st === "A");
  const changes = entries.filter((e) => e.st !== "A");

  const lines = cur ? cur.content.split("\n") : [];

  return (
    <div>
      {/* code sub-toolbar: repo · branch · workspace/source-control toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <Icon name="git" size={15} style={{ color: "var(--accent)" }} />
        <span className="mono" style={{ fontWeight: 700, fontSize: 13 }}>{repo}</span>
        <span className="mono" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--text-dim)" }}>
          <Icon name="branch" size={11} /> {branch}
        </span>
        <div className="seg" style={{ marginLeft: "auto", width: 380 }}>
          <button className={"seg-opt" + (side === "workspace" ? " on" : "")} onClick={() => setSide("workspace")}>
            <Icon name="grid" size={12} /> {t("codeedit.workspace")}
          </button>
          <button className={"seg-opt" + (side === "search" ? " on" : "")} onClick={() => setSide("search")}>
            <Icon name="search" size={12} /> {t("common.search")}
          </button>
          <button className={"seg-opt" + (side === "git" ? " on" : "")} onClick={() => setSide("git")}>
            <Icon name="git" size={12} /> {t("codeedit.sourceControl")}{entries.length > 0 ? ` · ${entries.length}` : ""}
          </button>
        </div>
      </div>

      <div className="code-mod">
        {/* left column */}
        <div className="code-tree">
          {side === "workspace" ? (
            <>
              {/* open editors */}
              {tabs.length > 0 && (
                <div className="open-editors">
                  <div className="oe-head">
                    <span className="tree-section-label" style={{ padding: 0, cursor: "pointer" }} onClick={() => setOeOpen((v) => !v)}>
                      <Icon name={oeOpen ? "chevronDown" : "chevronRight"} size={12} /> {t("codeedit.openEditors")}
                    </span>
                    <span className="oe-count">{tabs.length}</span>
                    <button className="side-act" title={t("codeedit.closeAll")} onClick={() => { setTabs([]); setActive(null); }}>
                      <Icon name="close" size={13} />
                    </button>
                  </div>
                  {oeOpen && tabs.map((p) => (
                    <div key={p} className={"oe-row" + (p === active ? " active" : "")} onClick={() => open(p)} title={p}>
                      <FileGlyph name={p.split("/").pop() ?? p} />
                      <span className="oe-name">{p.split("/").pop()}</span>
                      <button className="oe-close" onClick={(e) => { e.stopPropagation(); closeTab(p); }}>
                        <Icon name="close" size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* explorer */}
              <div className="tree-section-label">
                <Icon name="chevronDown" size={12} />
                <span style={{ flex: 1 }}>{repo}</span>
                <button className="side-act" title={t("codeedit.newFile")} onClick={() => { setModalKind("file"); setModal(true); setName(""); }}>
                  <Icon name="newFile" size={14} />
                </button>
                <button className="side-act" title={t("codeedit.newFolder")} onClick={() => { setModalKind("folder"); setModal(true); setName(""); }}>
                  <Icon name="newFolder" size={14} />
                </button>
              </div>

              {files.length === 0 && (
                <div className="muted" style={{ padding: 12, fontSize: 12 }}>{t("codeedit.noFilesYet")}</div>
              )}

              {tree.map((n) => (
                <TreeNode key={n.path} node={n} depth={0} expanded={expanded} selected={active}
                  onToggle={toggle} onOpen={open} onDelete={(p, type) => setConfirm({ path: p, type })} gitStatus={gitStatus} />
              ))}
            </>
          ) : side === "search" ? (
            /* project-wide search — names + content, all-occurrence highlight */
            <div className="code-search">
              <div className="cs-bar">
                <Icon name="search" size={13} />
                <input autoFocus placeholder={t("codeedit.searchFilesCode")} value={sq} onChange={(e) => setSq(e.target.value)} />
                {sq && <button className="ss-clear" onClick={() => setSq("")}><Icon name="close" size={12} /></button>}
              </div>
              <div className="cs-toggles">
                <button className={"cs-tog" + (sCase ? " on" : "")} title={t("codeedit.matchCase")} onClick={() => setSCase((v) => !v)}>Aa</button>
                <button className={"cs-tog" + (sWhole ? " on" : "")} title={t("codeedit.wholeWord")} onClick={() => setSWhole((v) => !v)}>ab</button>
                <button className={"cs-tog" + (sRegex ? " on" : "")} title={t("codeedit.regex")} onClick={() => setSRegex((v) => !v)}>.*</button>
                <span className="cs-count">{searching ? "…" : results.length ? t("codeedit.matchesInFiles", { matches: results.reduce((a, f) => a + f.matches.length, 0), files: results.length }) : ""}</span>
              </div>
              <div className="cs-results scroll">
                {!searching && sq.trim().length >= 2 && results.length === 0 && <div className="muted" style={{ fontSize: 12, padding: 10 }}>{t("codeedit.noMatches")}</div>}
                {results.map((f) => (
                  <div key={f.path} className="cs-file">
                    <div className="cs-file-head" onClick={() => open(f.path)} title={f.path}>
                      <FileGlyph name={f.path.split("/").pop() ?? f.path} />
                      <span className={"cs-file-name" + (f.nameMatch ? " name-hit" : "")}>{f.path}</span>
                      <span className="cs-file-n">{f.matches.length || (f.nameMatch ? t("codeedit.nameMatch") : "")}</span>
                    </div>
                    {f.matches.slice(0, 50).map((m, i) => (
                      <div key={i} className="cs-hit" onClick={() => { open(f.path); setScrollLine(m.line); }}>
                        <span className="cs-ln">{m.line}</span>
                        <span className="cs-line">{markText(m.text, searchRe)}</span>
                      </div>
                    ))}
                  </div>
                ))}
                {truncated && <div className="muted" style={{ fontSize: 11, padding: 8 }}>{t("codeedit.truncatedHint")}</div>}
              </div>
            </div>
          ) : (
            /* source control — real git status from the DB, no fakes */
            <div className="git-panel">
              <div className="gh-repo">
                <Icon name="git" size={14} style={{ color: "var(--accent)" }} />
                <div className="gh-repo-main">
                  <div className="gh-repo-name">{repo}</div>
                  <div className="gh-repo-branch"><Icon name="branch" size={11} /> {branch}</div>
                </div>
              </div>

              {entries.length === 0 ? (
                <div className="muted" style={{ fontSize: 12, padding: "10px 2px" }}>{t("codeedit.noChanges")}</div>
              ) : (
                <>
                  {staged.length > 0 && (
                    <>
                      <div className="git-group-label">{t("codeedit.stagedChanges", { n: staged.length })}</div>
                      {staged.map((e) => (
                        <div className="git-row" key={e.path} title={e.path} onClick={() => open(e.path)}>
                          <FileGlyph name={e.name} />
                          <span className="gname">{e.name}</span>
                          <span className="gpath">{e.dir}</span>
                          <button className="iact" title={t("codeedit.viewDiff")} onClick={(ev) => { ev.stopPropagation(); setDiffPath(e.path); }}><Icon name="git" size={12} /></button>
                          <span className={"gstat " + e.st}>{e.st}</span>
                        </div>
                      ))}
                    </>
                  )}
                  <div className="git-group-label">{t("codeedit.changes", { n: changes.length })}</div>
                  {changes.map((e) => (
                    <div className="git-row" key={e.path} title={e.path} onClick={() => open(e.path)}>
                      <FileGlyph name={e.name} />
                      <span className="gname">{e.name}</span>
                      <span className="gpath">{e.dir}</span>
                      <button className="iact" title={t("codeedit.viewDiff")} onClick={(ev) => { ev.stopPropagation(); setDiffPath(e.path); }}><Icon name="git" size={12} /></button>
                      <span className={"gstat " + e.st}>{e.st}</span>
                    </div>
                  ))}
                  <a href="/github" className="btn-ghost" style={{ display: "inline-flex", gap: 6, margin: "12px 8px" }}>
                    <Icon name="arrowUp" size={13} /> {t("codeedit.commitPush")}
                  </a>
                </>
              )}
            </div>
          )}
        </div>

        {/* right column: tabs + editor */}
        <div className="editor-wrap">
          <div className="tabbar">
            {tabs.map((p) => (
              <div key={p} className={"tab" + (p === active ? " active" : "")} onClick={() => open(p)} title={p}>
                <FileGlyph name={p.split("/").pop() ?? p} />
                <span className="tname">{p.split("/").pop()}</span>
                <span className="tclose" onClick={(e) => { e.stopPropagation(); closeTab(p); }}>
                  <Icon name="close" size={12} />
                </span>
              </div>
            ))}
          </div>

          {cur ? (
            <>
              <div className="breadcrumb">
                {cur.path.split("/").map((seg, i, arr) => (
                  <span className="crumb" key={i}>
                    {i > 0 && <Icon name="chevronRight" size={11} />}
                    {i === arr.length - 1 ? <FileGlyph name={seg} /> : null} {seg}
                  </span>
                ))}
              </div>

              <div className="editor-toolbar">
                <span className="et-lang"><FileGlyph name={cur.path.split("/").pop() ?? ""} /> {cur.lang.toUpperCase()}</span>
                <span className="et-spacer" />
                <span className="et-diag ok"><Icon name="check" size={12} /> {t("codeedit.noProblems")}</span>
                {editing ? (
                  <>
                    <button className="et-edit" onClick={() => setEditing(false)}>{t("common.cancel")}</button>
                    <button className="et-edit on" onClick={() => start(async () => { await saveFileContent(cur.path, draft); setEditing(false); })}>
                      <Icon name="check" size={12} /> {t("common.save")}
                    </button>
                  </>
                ) : (
                  <button className="et-edit" onClick={() => { setEditing(true); setDraft(cur.content); }}>
                    <Icon name="command" size={12} /> {t("common.edit")}
                  </button>
                )}
              </div>

              {editing ? (
                <textarea className="code-area" value={draft} onChange={(e) => setDraft(e.target.value)} spellCheck={false} />
              ) : (
                <div className="editor-body">
                  <div className="editor-scroll">
                    <div className="code" ref={codeRef}>
                      {lines.map((ln, i) => (
                        <div className={"code-line" + (scrollLine === i + 1 ? " search-hit" : "")} data-line={i + 1} key={i}>
                          <span className="gutter">{i + 1}</span>
                          <span className="line-content">
                            {searchRe
                              ? markText(ln, searchRe)
                              : ln === "" ? "​" : tokenize(ln, cur.lang).map((tk, k) => (
                                <span className={"tok-" + tk.c} key={k}>{tk.t}</span>
                              ))}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="minimap">
                    <div className="minimap-inner">
                      {lines.map((ln, i) => <div className="mini-line" key={i}>{ln || " "}</div>)}
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="welcome">
              <div className="welcome-inner">
                <div className="welcome-logo">⌘</div>
                <div className="welcome-sub">{t("codeedit.welcomeSub")}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onMouseDown={() => setModal(false)}>
          <div className="modal" style={{ padding: "20px 22px", width: 440, maxWidth: "94vw" }} onMouseDown={(e) => e.stopPropagation()}>
            {(() => {
              const submit = () => start(async () => {
                const v = name.trim();
                if (modalKind === "folder") { await createFolder(v); }
                else { await createFile(v); open(v.replace(/^\/+/, "")); }
                setModal(false);
              });
              return (
                <>
                  <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>{modalKind === "folder" ? t("codeedit.newFolder") : t("codeedit.newFile")}</div>
                  <input className="form-input mono" autoFocus placeholder={modalKind === "folder" ? t("codeedit.folderPathHint") : t("codeedit.filePathHint")} value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) submit(); }} />
                  <div className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>
                    {modalKind === "folder" ? t("codeedit.folderCreateHint") : t("codeedit.fileCreateHint")}
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
                    <button className="btn-ghost" onClick={() => setModal(false)}>{t("common.cancel")}</button>
                    <button className="btn-accent" disabled={!name.trim()} onClick={submit}>{t("common.create")}</button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {confirm && (
        <div className="modal-overlay" onMouseDown={() => setConfirm(null)}>
          <div className="modal" style={{ padding: "20px 22px", width: 440, maxWidth: "94vw" }} onMouseDown={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>
              {confirm.type === "dir" ? t("codeedit.deleteFolder") : t("codeedit.deleteFile")}
            </div>
            <div style={{ fontSize: 13 }}>
              {t("codeedit.deleteConfirmPrefix")} <b className="mono" style={{ color: "var(--sx-keyword)" }}>{confirm.path}</b>{t("codeedit.deleteConfirmSuffix")}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button className="btn-ghost" onClick={() => setConfirm(null)}>{t("common.cancel")}</button>
              <button className="btn-accent"
                onClick={() => start(async () => {
                  await deleteFile(confirm.path);
                  if (cur && (cur.path === confirm.path || cur.path.startsWith(confirm.path + "/"))) { closeTab(cur.path); }
                  setConfirm(null);
                })}>
                {t("common.delete")}
              </button>
            </div>
          </div>
        </div>
      )}

      {diffPath && <DiffOverlay path={diffPath} onClose={() => setDiffPath(null)} />}
    </div>
  );
}
