"use client";

import { Fragment, useEffect, useMemo, useState, useTransition } from "react";
import { Icon } from "@/components/ui/icon";
import { Avatar } from "@/components/ui/avatar";
import { ProviderGlyph } from "@/components/ui/provider-glyph";
import { modelIconUrl } from "@/data/model-icons";
import { Dropdown } from "@/components/ui/dropdown";
import { ModelPicker } from "@/components/ui/model-picker";
import {
  connectProvider, syncProvider, testProvider, removeProvider, revokeProviderToken,
  listProviderModels, listCatalogModels, refreshProviderModels,
} from "@/server/providers";
import type { CachedModel } from "@/data/models-dev";
import { HIDDEN_CLI_ADAPTERS } from "@/data/model-options";
import { catalogById } from "@/data/providers-catalog";
import { pullModel, removeModel, removeGguf, downloadGguf, startLlamaServer, stopLlamaServer, downloadLlamaServer, embedStatus, startEmbeddings, reindexRag } from "@/server/local-models";
import { saveAgentModel } from "@/server/agents";
import { OLLAMA_CATALOG, GGUF_CATALOG } from "@/data/model-catalog";
import { PROVIDER_CATALOG } from "@/data/providers-catalog";
import { versionsFor, prettyModel } from "@/data/model-versions";
import { useT } from "@/lib/i18n-context";

export type Prov = { id: string; catalogId: string; displayName: string; adapter: string; kind: string; auth: string; status: string; modelCount: number; lastSync: string | null; cliVersion: string | null; defaultModel: string | null; authState: string | null };
export type LocalRow = { id: string; name: string; file: string; quant: string; params: string; sizeBytes: number; bind: string };
export type AgentRow = { id: string; handle: string; name: string; role: string; color: string; adapter: string; model: string };
export type Hardware = { cpu: string; cores: number; ram: string; gpu: string; vram: string; diskFree: string; backend: string; accel: string[]; recommendedQuant: string; maxParams: string };

// Label text is translated at the render site via t(`models.cat.${k}`) etc. — only the stable
// enum keys + colors live here; localized labels come from the i18n dict.
const STATUS_COLOR: Record<string, string> = { available: "var(--sx-string)", experimental: "#f0a35e", requires_setup: "#6cc7e0", planned: "var(--text-dim)", unsupported: "var(--sx-keyword)" };
const AUTH_COLOR: Record<string, string> = { ready: "var(--sx-string)", needs_login: "#f0a35e", needs_key: "#f0a35e", unknown: "var(--text-dim)" };
// Client-safe login hints (server LOGIN_HINTS lives in cli.ts; mirrored here keyed by adapter).
const LOGIN_HINTS: Record<string, string> = {
  cli_claude_code: "sign in to Claude Code", cli_codex: "codex login", cli_openclaw: "openclaw infer model auth login",
  cli_hermes: "hermes model", cli_aider: "set OPENAI_API_KEY / ANTHROPIC_API_KEY env", cli_opencode: "opencode auth login",
  cli_copilot: "copilot → /login", cli_cursor: "cursor-agent login", cli_cline: "configure cline providers", cli_kilo: "configure kilocode providers",
};
/** Connection type for the status panel — derived from the catalog (api / cli / local / hybrid).
 *  Returns a stable enum `key`; the visible label is resolved via t(`models.connType.${key}`). */
function connType(catalogId: string): { key: string; tone: string } {
  const cp = catalogById(catalogId);
  if (!cp) return { key: "none", tone: "var(--text-dim)" };
  if (cp.category === "cli") return { key: "cli", tone: "#a78bfa" };
  if (cp.category === "local_runtime") return { key: "local", tone: "#6cc7e0" };
  const hasLocal = cp.connectionTypes.includes("local");
  const hasApi = cp.connectionTypes.includes("api_key") || cp.connectionTypes.includes("openai_compatible");
  if (hasLocal && hasApi) return { key: "hybrid", tone: "#f0a35e" };
  return { key: "api", tone: "var(--sx-string)" };
}

const fmtSize = (b: number) => (b >= 1e9 ? (b / 1e9).toFixed(1) + " GB" : (b / 1e6).toFixed(0) + " MB");
const adapterShort = (a: string) => a.replace(/^http_|^local_|^cli_|^sdk_/, "");

/* ---------------------------------------------------------------- provider table */
function ProviderTable({ rows, kind, onViewModels }: { rows: Prov[]; kind: "cloud" | "cli"; onViewModels: (p: Prov, e: React.MouseEvent) => void }) {
  const t = useT();
  const [busy, setBusy] = useState<Record<string, string>>({});
  const [flash, setFlash] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [, start] = useTransition();
  const mark = (id: string, msg: string) => { setFlash((f) => ({ ...f, [id]: msg })); setTimeout(() => setFlash((f) => { const n = { ...f }; delete n[id]; return n; }), 2200); };
  const run = (id: string, label: string, fn: () => Promise<unknown>, done?: (r: unknown) => string) =>
    start(async () => { setBusy((b) => ({ ...b, [id]: label })); const r = await fn().catch(() => null); setBusy((b) => { const n = { ...b }; delete n[id]; return n; }); if (done) mark(id, done(r)); });

  return (
    <div className="tbl-wrap">
      <table className="tbl" style={{ marginBottom: 20 }}>
        <thead><tr><th>{t("models.col.provider")}</th><th>{t("models.col.adapter")}</th><th>{t("models.col.models")}</th><th>{kind === "cli" ? t("models.col.auth") : t("models.col.keyAuth")}</th><th>{t("models.col.lastSync")}</th><th>{t("common.status")}</th><th style={{ textAlign: "right" }}>{t("common.actions")}</th></tr></thead>
        <tbody>
          {rows.map((r) => {
            const connected = r.status === "connected";
            const b = busy[r.id];
            const hasKey = r.auth !== "none" && r.auth !== "local" && r.auth !== "cli";
            const isOpen = !!open[r.id];
            const auth = r.authState ?? (r.kind === "cli" ? "unknown" : r.auth === "none" ? "needs_key" : "ready");
            return (
              <Fragment key={r.id}>
              <tr>
                <td><div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button className="iact" title={isOpen ? t("models.title.hideStatus") : t("models.title.showStatus")} style={{ padding: "0 4px", fontSize: 11, color: "var(--text-dim)", lineHeight: 1 }} onClick={() => setOpen((o) => ({ ...o, [r.id]: !o[r.id] }))}>{isOpen ? "▾" : "▸"}</button>
                  <ProviderGlyph id={r.catalogId} size={26} /> {r.displayName}
                  {r.kind === "cli" && r.cliVersion && <span className="chip-sm" style={{ fontSize: 9.5, color: "var(--text-dim)" }}>v{r.cliVersion.replace(/^v/, "")}</span>}
                </div></td>
                <td><span className="chip-sm">{r.adapter}</span></td>
                <td>{r.modelCount > 0
                  ? <button className="link-btn" onClick={(e) => onViewModels(r, e)}>{t("models.modelCount", { n: r.modelCount })}</button>
                  : <span style={{ color: "var(--text-faint)" }}>{t("common.unsynced")}</span>}</td>
                <td><span className="pill" style={{ background: (AUTH_COLOR[auth] ?? "var(--text-dim)") + "22", color: AUTH_COLOR[auth] ?? "var(--text-dim)" }}>{t(`models.auth.${auth}`)}</span></td>
                <td style={{ color: "var(--text-dim)", fontSize: 12 }}>{r.lastSync ?? t("common.never")}</td>
                <td><span className="gstat-cell"><span className="status-dot" style={{ background: connected ? "var(--sx-string)" : r.status === "error" ? "var(--sx-keyword)" : "var(--text-dim)" }} />{connected ? t("models.status.connected") : r.status === "error" ? t("models.status.error") : t("models.status.needsSync")}</span></td>
                <td>
                  <div className="row-actions">
                    {flash[r.id] && <span style={{ fontSize: 10.5, color: "var(--sx-string)", alignSelf: "center" }}>{flash[r.id]}</span>}
                    <button className="iact" title={t("models.title.testConnection")} disabled={!!b} onClick={() => run(r.id, "testing", () => testProvider(r.id), (x) => (x as { ok?: boolean })?.ok ? t("models.flash.connectionOk") : t("models.flash.unreachable"))}>{b === "testing" ? <span className="sync-spin"><Icon name="refresh" size={15} /></span> : <Icon name="play" size={15} />}</button>
                    <button className="iact" title={t("models.title.syncRefresh")} disabled={!!b} onClick={() => run(r.id, "syncing", () => syncProvider(r.id), (x) => t("models.flash.synced", { n: (x as { count?: number })?.count ?? 0 }))}>{b === "syncing" ? <span className="sync-spin"><Icon name="refresh" size={15} /></span> : <Icon name="refresh" size={15} />}</button>
                    {r.modelCount > 0 && <button className="iact" title={t("models.title.viewModels")} onClick={(e) => onViewModels(r, e)}><Icon name="files" size={15} /></button>}
                    {hasKey && <button className="iact" title={t("models.title.revokeToken")} disabled={!!b} onClick={() => run(r.id, "revoke", () => revokeProviderToken(r.id), () => t("models.flash.tokenRevoked"))}><Icon name="shield" size={15} /></button>}
                    <button className="iact danger" title={t("models.title.removeProvider")} disabled={!!b} onClick={() => run(r.id, "remove", () => removeProvider(r.id))}><Icon name="trash" size={15} /></button>
                  </div>
                </td>
              </tr>
              {isOpen && <tr><td colSpan={7} style={{ padding: 0, background: "var(--bg-active)" }}><ProviderDetail row={r} /></td></tr>}
              </Fragment>
            );
          })}
          {rows.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--text-faint)", padding: 20 }}>{kind === "cli" ? t("models.empty.cli") : t("models.empty.cloud")}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------------------------------------------------------- rich per-provider status panel */
function PdField({ k, children }: { k: string; children: React.ReactNode }) {
  return <div style={{ minWidth: 0 }}><div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".4px", color: "var(--text-faint)", marginBottom: 3 }}>{k}</div><div style={{ fontSize: 12.5, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis" }}>{children}</div></div>;
}
function ProviderDetail({ row }: { row: Prov }) {
  const t = useT();
  const cp = catalogById(row.catalogId);
  const ct = connType(row.catalogId);
  const isCli = cp?.category === "cli";
  const [models, setModels] = useState<CachedModel[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [, start] = useTransition();
  useEffect(() => { let on = true; listCatalogModels(row.id).then((r) => on && setModels(r.models)).catch(() => on && setModels([])); return () => { on = false; }; }, [row.id]);
  const def = models?.find((m) => m.isDefault) ?? (row.defaultModel ? models?.find((m) => m.id === row.defaultModel) : undefined) ?? models?.[0];
  const maxCtx = models?.reduce((a, m) => Math.max(a, m.context), 0) ?? 0;
  const caps = { vision: !!models?.some((m) => m.caps?.vision), reasoning: !!models?.some((m) => m.caps?.reasoning), tools: !!models?.some((m) => m.caps?.tools) };
  const capList = [caps.vision && t("models.cap.vision"), caps.reasoning && t("models.cap.reasoning"), caps.tools && t("models.cap.tools")].filter(Boolean).join(" · ") || "—";
  const auth = row.authState ?? (isCli ? "unknown" : row.auth === "none" ? "needs_key" : "ready");
  const ready = auth === "ready" && row.status === "connected";
  function refresh() { setBusy(true); start(async () => { await refreshProviderModels(row.id).catch(() => {}); const r = await listCatalogModels(row.id).catch(() => ({ models: [] as CachedModel[] })); setModels(r.models); setBusy(false); }); }
  return (
    <div style={{ padding: "14px 18px 16px 40px", borderTop: "1px solid var(--border)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "12px 18px" }}>
        <PdField k={t("models.pd.connection")}><span className="pill" style={{ background: ct.tone + "22", color: ct.tone }}>{ct.key === "none" ? "—" : t(`models.connType.${ct.key}`)}</span></PdField>
        <PdField k={t("models.pd.install")}>{isCli ? (row.cliVersion ? <span style={{ color: "var(--sx-string)" }}>{t("models.install.installed")} · v{row.cliVersion.replace(/^v/, "")}</span> : <span style={{ color: "#f0a35e" }}>{t("models.install.notDetected")}</span>) : ct.key === "local" ? t("models.install.localRuntime") : t("models.install.cloudApi")}</PdField>
        <PdField k={t("models.pd.auth")}><span className="pill" style={{ background: (AUTH_COLOR[auth] ?? "var(--text-dim)") + "22", color: AUTH_COLOR[auth] ?? "var(--text-dim)" }}>{t(`models.auth.${auth}`)}</span>{auth !== "ready" && (isCli ? LOGIN_HINTS[row.adapter] : !row.auth || row.auth === "none") ? <span style={{ fontSize: 10.5, color: "var(--text-faint)", marginLeft: 6 }}>{isCli ? LOGIN_HINTS[row.adapter] : t("models.hint.addApiKey")}</span> : null}</PdField>
        <PdField k={t("models.pd.models")}>{models == null ? "…" : models.length || row.modelCount}</PdField>
        <PdField k={t("models.pd.defaultModel")}>{def ? def.name : row.defaultModel ?? "—"}</PdField>
        <PdField k={t("models.pd.maxContext")}>{maxCtx ? t("models.pd.tokens", { ctx: ctxLabel(maxCtx) }) : "—"}</PdField>
        <PdField k={t("models.pd.capabilities")}>{capList}</PdField>
        <PdField k={t("models.pd.costDefault")}>{def && (def.inputCost || def.outputCost) ? `$${def.inputCost} / $${def.outputCost} ${t("models.pd.per1M")}` : "—"}</PdField>
        <PdField k={t("models.pd.state")}><span className="pill" style={{ background: (ready ? "var(--sx-string)" : "#f0a35e") + "22", color: ready ? "var(--sx-string)" : "#f0a35e" }}>{ready ? t("models.state.ready") : t("models.state.needsConfig")}</span></PdField>
      </div>
      <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
        <button className="btn-ghost" disabled={busy} onClick={refresh}>{busy ? <span className="sync-spin"><Icon name="refresh" size={13} /></span> : <Icon name="refresh" size={13} />} {busy ? t("models.btn.refreshing") : t("models.btn.refreshModels")}</button>
        {cp?.notes && <span style={{ fontSize: 11, color: "var(--text-faint)" }}>{cp.notes}</span>}
      </div>
    </div>
  );
}

type PopModel = { id: string; label: string; version: string; note?: string; context?: number; inputCost?: number; outputCost?: number; caps?: { reasoning: boolean; tools: boolean; vision: boolean }; isDefault?: boolean };
const ctxLabel = (n?: number) => !n ? "" : n >= 1e6 ? `${(n / 1e6).toFixed(n % 1e6 ? 1 : 0)}M` : `${Math.round(n / 1000)}K`;
function ModelsPopover({ row, pos, onClose }: { row: Prov; pos: { x: number; y: number }; onClose: () => void }) {
  const t = useT();
  // CLI adapters don't expose a live /models endpoint yet — their accepted aliases + versions are known.
  // HTTP/router/local providers read the cached, enriched catalog (models.dev ∩ live /v1/models: context,
  // pricing, capabilities, recommended default), falling back to a bare live list if the cache is cold.
  const cli = versionsFor(row.adapter);
  const [models, setModels] = useState<PopModel[] | null>(cli ? cli.map((m) => ({ id: m.id, label: m.label, version: m.version, note: m.note })) : null);
  const [err, setErr] = useState("");
  const fromCached = (c: CachedModel): PopModel => { const p = prettyModel(c.id); return { id: c.id, label: c.name || p.label, version: p.version, context: c.context, inputCost: c.inputCost, outputCost: c.outputCost, caps: c.caps, isDefault: c.isDefault }; };
  useEffect(() => {
    if (cli) return;
    let on = true;
    listCatalogModels(row.id).then(async ({ models: cached }) => {
      if (!on) return;
      if (cached.length) { setModels(cached.map(fromCached)); return; }
      const r = await listProviderModels(row.id);
      if (!on) return;
      setModels(r.models.map((id) => { const p = prettyModel(id); return { id, label: p.label, version: p.version }; }));
      if (r.error) setErr(r.error);
    }).catch(() => { if (on) { setModels([]); setErr(t("models.pop.loadFailed")); } });
    return () => { on = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.id]);
  return (
    <div className="models-pop" style={{ left: Math.min(pos.x, (typeof window !== "undefined" ? window.innerWidth : 1280) - 380), top: pos.y }} onMouseLeave={onClose}>
      <div className="mp-head"><Icon name="cpu" size={13} style={{ color: "var(--accent)" }} /> {row.displayName} · {row.kind} · {t("models.modelCount", { n: models?.length ?? row.modelCount })}</div>
      {models === null && <div className="mp-row"><span className="sync-spin"><Icon name="refresh" size={11} /></span> {t("common.loading")}</div>}
      {models && models.length === 0 && <div className="mp-row" style={{ color: "var(--text-faint)" }}>{err || t("models.pop.noModels")}</div>}
      {models?.map((m) => (
        <div className="mp-row" key={m.id}>
          <Icon name="dot" size={7} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {m.label}{m.isDefault ? <span style={{ color: "var(--accent)" }}> · {t("models.pop.recommended")}</span> : null}{m.note ? <span style={{ color: "var(--text-faint)" }}> · {m.note}</span> : null}
            </span>
            {(m.context || m.inputCost || m.outputCost) ? (
              <span style={{ fontSize: 9.5, color: "var(--text-faint)", fontFamily: "var(--mono-font)" }}>
                {m.context ? `${ctxLabel(m.context)} ${t("models.pop.ctx")}` : ""}{(m.inputCost || m.outputCost) ? `  $${m.inputCost}/${m.outputCost}` : ""}
                {m.caps?.vision ? `  ${t("models.cap.vision")}` : ""}{m.caps?.reasoning ? `  ${t("models.cap.reasoning")}` : ""}{m.caps?.tools ? `  ${t("models.cap.tools")}` : ""}
              </span>
            ) : null}
          </span>
          {m.version && <span className="chip-sm" style={{ fontSize: 10 }}>v{m.version}</span>}
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- local runtime */
function LocalRuntime({ hw, ollamaUp, ollamaInstalled, installed, locals, llamaUp, llamaInstalled, llamaModel }: {
  hw: Hardware; ollamaUp: boolean; ollamaInstalled: boolean; installed: { name: string; size: number }[]; locals: LocalRow[];
  llamaUp: boolean; llamaInstalled: boolean; llamaModel: string | null;
}) {
  const t = useT();
  // llama.cpp is the PRIMARY local runtime (replaces Ollama). Ollama stays as a legacy card only
  // when it's actually installed, so existing pulls keep working.
  const [server, setServer] = useState<"running" | "stopped" | "booting" | "not-installed">(llamaUp ? "running" : !llamaInstalled ? "not-installed" : "stopped");
  const [served, setServed] = useState<string | null>(llamaModel);
  const [log, setLog] = useState<{ c: string; t: string }[]>([{ c: llamaUp ? "lg-ok" : !llamaInstalled ? "lg-warn" : "lg-dim", t: llamaUp ? t("models.log.serving", { model: llamaModel ?? t("models.log.aModel") }) : !llamaInstalled ? t("models.log.notInstalled") : t("models.log.stopped") }]);
  const [sel, setSel] = useState<string>(locals[0]?.id ?? "");
  const [inst, setInst] = useState(llamaInstalled);
  const [busy, setBusy] = useState("");
  // catalog browse (200+ GGUF): search + GPU-fit + kind filters
  const [dlQ, setDlQ] = useState("");
  const [fitsOnly, setFitsOnly] = useState(false);
  const [kindF, setKindF] = useState<string>("all");
  const [, start] = useTransition();

  const vramBytes = parseBytes(hw.vram);
  const ramBytes = parseBytes(hw.ram);
  const fitUnit = hw.backend === "Metal" ? "Metal" : "GPU";
  const ggufView = GGUF_CATALOG
    .map((g) => ({ g, fit: fitFor(g.sizeBytes, vramBytes, ramBytes, fitUnit) }))
    .filter(({ g }) => kindF === "all" || g.kind === kindF)
    .filter(({ g }) => !dlQ.trim() || g.name.toLowerCase().includes(dlQ.toLowerCase()))
    .filter(({ fit }) => !fitsOnly || fit.tone !== "no");

  const [instProg, setInstProg] = useState<{ received: number; total: number } | null>(null);
  function installLlama() {
    start(async () => {
      setBusy("install"); setInstProg(null);
      setLog((l) => [...l, { c: "lg-dim", t: t("models.log.installing") }]);
      // Poll the live byte progress so the install shows a %/bar, not just a spinner.
      const timer = setInterval(() => { fetch("/api/models/progress?id=llama-server").then((r) => r.json()).then((p) => { if (p) setInstProg({ received: p.received, total: p.total }); }).catch(() => {}); }, 600);
      try {
        const r = await downloadLlamaServer();
        setBusy(""); setInst(r.installed);
        if (r.installed && server === "not-installed") setServer("stopped");
        setLog((l) => [...l, ...r.log.map((t) => ({ c: r.ok ? "lg-ok" : "lg-warn", t })), ...(r.error ? [{ c: "lg-warn", t: r.error }] : [])]);
      } finally { clearInterval(timer); setInstProg(null); }
    });
  }
  function startServer(modelId?: string) {
    start(async () => {
      setServer("booting"); setLog((l) => [...l, { c: "lg-dim", t: "$ llama-server" }]);
      const r = await startLlamaServer(modelId || sel || undefined);
      setServer(r.up ? "running" : r.installed ? "stopped" : "not-installed");
      setLog((l) => [...l, ...r.log.map((t) => ({ c: r.up ? "lg-ok" : "lg-warn", t }))]);
    });
  }
  function stopServer() {
    start(async () => { setServer("booting"); const r = await stopLlamaServer(); setServer("stopped"); setServed(null); setLog((l) => [...l, ...r.log.map((t) => ({ c: "lg-warn", t }))]); });
  }
  const srvDot = server === "running" ? "run" : server === "booting" ? "boot" : "stop";
  const srvLabel = server === "running" ? t("models.srv.running") : server === "booting" ? t("models.srv.working") : server === "not-installed" ? t("models.srv.notInstalled") : t("models.srv.stopped");

  return (
    <>
      <div className="lr-grid">
        <div className="hw-card">
          <div className="hw-head">
            <span className="hw-ic"><Icon name="cpu" size={19} /></span>
            <div style={{ flex: 1 }}><div className="hw-t">{t("models.hw.detected")}</div><div className="hw-s">{t("models.hw.autoProbed")}</div></div>
            <span className="hw-badge">{hw.backend}</span>
          </div>
          <div className="hw-rows">
            <div className="hw-item"><div className="hi-k">CPU</div><div className="hi-v">{hw.cpu}</div></div>
            <div className="hw-item"><div className="hi-k">{t("models.hw.cores")}</div><div className="hi-v">{hw.cores}</div></div>
            <div className="hw-item"><div className="hi-k">{t("models.hw.memory")}</div><div className="hi-v">{hw.ram}</div></div>
            <div className="hw-item"><div className="hi-k">GPU</div><div className="hi-v">{hw.gpu}</div></div>
            <div className="hw-item"><div className="hi-k">VRAM</div><div className="hi-v">{hw.vram}</div></div>
            <div className="hw-item"><div className="hi-k">{t("models.hw.diskFree")}</div><div className="hi-v">{hw.diskFree}</div></div>
          </div>
          <div className="hw-badges">
            {hw.accel.map((a) => <span className="hw-badge" key={a} style={{ background: "var(--bg-active)", color: "var(--text-dim)" }}>{a}</span>)}
            <span className="hw-badge">{t("models.hw.recommended", { quant: hw.recommendedQuant })}</span>
            <span className="hw-badge">{t("models.hw.max", { params: hw.maxParams })}</span>
          </div>
        </div>

        <div className="hw-card">
          <div className="hw-head">
            <span className="hw-ic"><Icon name="terminal" size={19} /></span>
            <div style={{ flex: 1 }}><div className="hw-t">{t("models.llama.title")}</div><div className="hw-s">{t("models.llama.sub")}</div></div>
            <ProviderGlyph id="llamacpp" size={22} />
          </div>
          <div className="srv-status">
            <span className={"srv-dot " + srvDot} />
            <div className="srv-meta"><div className="sm-t">{srvLabel}</div><div className="sm-s">127.0.0.1:8082 · {served ? served : t("models.srv.noModel")}</div></div>
            <button className={server === "running" ? "btn-ghost" : "btn-accent"} onClick={() => server === "running" ? stopServer() : startServer()} disabled={server === "booting" || (server !== "running" && locals.length === 0)}>
              {server === "booting" ? <span className="sync-spin"><Icon name="refresh" size={13} /></span> : <Icon name={server === "running" ? "close" : "goto"} size={13} />}
              {server === "running" ? t("models.srv.stopBtn") : server === "booting" ? t("models.srv.working") : t("models.srv.startBtn")}
            </button>
          </div>
          {server !== "running" && locals.length > 0 && (
            <div style={{ marginBottom: 8 }}><Dropdown value={sel} options={locals.map((l) => ({ value: l.id, label: l.name }))} onChange={setSel} mono /></div>
          )}
          <div className="srv-stats">
            <div className="srv-stat"><div className="ss-v">{locals.length}</div><div className="ss-k">{t("models.srv.ggufModels")}</div></div>
            <div className="srv-stat"><div className="ss-v">{server === "running" ? t("common.on") : t("common.off")}</div><div className="ss-k">{t("models.srv.serverLabel")}</div></div>
            <div className="srv-stat"><div className="ss-v">{hw.backend}</div><div className="ss-k">{t("models.srv.backendLabel")}</div></div>
          </div>
          {!inst && (
            <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <button className="btn-accent" disabled={busy === "install"} onClick={installLlama}>
                {busy === "install" ? <span className="sync-spin"><Icon name="refresh" size={13} /></span> : <Icon name="goto" size={13} />} {busy === "install" ? ((() => { const p = instProg && instProg.total > 0 ? Math.round((instProg.received / instProg.total) * 100) : null; return p !== null ? t("models.install.installingPct", { pct: p }) : t("models.install.installingEllipsis"); })()) : t("models.install.installLlama")}
              </button>
              <a className="link-btn" style={{ fontSize: 11 }} href="https://github.com/ggml-org/llama.cpp/releases" target="_blank" rel="noreferrer">{t("models.install.manualInstall")}</a>
              {busy === "install" && (() => {
                const ipct = instProg && instProg.total > 0 ? Math.min(100, Math.round((instProg.received / instProg.total) * 100)) : null;
                return (
                  <div style={{ flex: "1 1 180px", minWidth: 150 }}>
                    <div style={{ height: 4, background: "var(--bg-active)", borderRadius: 3, overflow: "hidden" }}>
                      <div className={ipct === null ? "sync-spin" : ""} style={{ height: "100%", width: (ipct ?? 12) + "%", background: "var(--accent)", transition: "width .3s" }} />
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 3, fontFamily: "var(--mono-font)" }}>
                      {ipct !== null && instProg ? `${ipct}% · ${fmtSize(instProg.received)} / ${fmtSize(instProg.total)}` : instProg && instProg.received > 0 ? t("models.dl.downloaded", { size: fmtSize(instProg.received) }) : t("models.dl.startingDownload")}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
          <div className="srv-log scroll">{log.map((l, i) => <div key={i} className={l.c}>{l.t}</div>)}</div>
        </div>

        <EmbeddingsCard />
      </div>

      <div className="view-section-title">{t("models.installed.title")} <span style={{ fontWeight: 400, color: "var(--text-faint)" }}>· llama.cpp GGUF{ollamaInstalled ? " + Ollama" : ""} · {t("models.installed.boundTo")} 127.0.0.1</span></div>
      <div className="tbl-wrap">
        <table className="tbl" style={{ marginBottom: 24 }}>
          <thead><tr><th>{t("common.name")}</th><th>{t("models.col.source")}</th><th>{t("models.col.params")}</th><th>{t("models.col.size")}</th><th>{t("models.col.bind")}</th><th>{t("common.status")}</th><th style={{ textAlign: "right" }}>{t("common.actions")}</th></tr></thead>
          <tbody>
            {locals.map((l) => {
              const loaded = server === "running" && served && l.name.includes(served);
              return (
                <tr key={"g-" + l.id}>
                  <td><div style={{ display: "flex", alignItems: "center", gap: 8 }}><ModelGlyph name={l.name} size={24} /> {l.name}</div></td>
                  <td><span className="chip-sm">{l.quant || "gguf"}</span></td>
                  <td style={{ color: "var(--text-dim)", fontSize: 12 }}>{l.params || "—"}</td>
                  <td style={{ fontFamily: "var(--mono-font)", fontSize: 12, color: "var(--text-dim)" }}>{l.sizeBytes ? fmtSize(l.sizeBytes) : "—"}</td>
                  <td><span className="lr-mono">{l.bind}</span></td>
                  <td>{loaded ? <span className="pill" style={{ background: "var(--sx-string)22", color: "var(--sx-string)" }}>{t("models.pill.serving")}</span> : <span className="pill" style={{ background: "var(--sx-string)22", color: "var(--sx-string)" }}>✓ {t("models.pill.verified")}</span>}</td>
                  <td><div className="row-actions">
                    <button className="iact accent" title={t("models.title.serveModel")} disabled={busy === l.id} onClick={() => { setBusy(l.id); setSel(l.id); setServed(l.name); startServer(l.id); setTimeout(() => setBusy(""), 500); }}>{busy === l.id ? <span className="sync-spin"><Icon name="refresh" size={14} /></span> : <Icon name="goto" size={14} />}</button>
                    <button className="iact danger" title={t("common.uninstall")} onClick={() => start(() => removeGguf(l.id) as unknown as Promise<void>)}><Icon name="trash" size={14} /></button>
                  </div></td>
                </tr>
              );
            })}
            {installed.map((m) => (
              <tr key={"o-" + m.name}>
                <td><div style={{ display: "flex", alignItems: "center", gap: 8 }}><ProviderGlyph id="ollama" size={24} /> {m.name}</div></td>
                <td><span className="chip-sm">ollama</span></td>
                <td style={{ color: "var(--text-faint)", fontSize: 12 }}>—</td>
                <td style={{ fontFamily: "var(--mono-font)", fontSize: 12, color: "var(--text-dim)" }}>{m.size ? fmtSize(m.size) : "—"}</td>
                <td><span className="lr-mono">127.0.0.1:11434</span></td>
                <td><span className="pill" style={{ background: "var(--text-dim)22", color: "var(--text-dim)" }}>{t("models.pill.legacy")}</span></td>
                <td><div className="row-actions">
                  <button className="iact danger" title={t("common.remove")} onClick={() => start(() => removeModel(m.name) as unknown as Promise<void>)}><Icon name="trash" size={14} /></button>
                </div></td>
              </tr>
            ))}
            {installed.length === 0 && locals.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--text-faint)", padding: 18 }}>{t("models.empty.local")}</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="view-section-title" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span>{t("models.available.title")} <span style={{ fontWeight: 400, color: "var(--text-faint)" }}>· {ggufView.length}/{GGUF_CATALOG.length} GGUF (HuggingFace) · {t("models.available.fitChecked", { target: hw.gpu !== "—" && vramBytes ? `${hw.vram} VRAM` : "CPU" })}</span></span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div className="cs-bar" style={{ margin: 0, padding: "5px 9px", width: 200 }}>
            <Icon name="search" size={12} />
            <input placeholder={t("models.filterModels")} value={dlQ} onChange={(e) => setDlQ(e.target.value)} style={{ fontWeight: 400 }} />
          </div>
          <div className="seg" style={{ width: 280 }}>
            {["all", "chat", "code", "reasoning", "embed"].map((k) => (
              <button key={k} className={"seg-opt" + (kindF === k ? " on" : "")} onClick={() => setKindF(k)} style={{ fontSize: 11 }}>{t(`models.kind.${k}`)}</button>
            ))}
          </div>
          <button className={"cs-tog" + (fitsOnly ? " on" : "")} onClick={() => setFitsOnly((v) => !v)} title={t("models.title.hideTooBig")} style={{ fontFamily: "inherit", fontWeight: 600 }}>{t("models.fitsOnly")}</button>
        </div>
      </div>
      <div className="cards-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))", gap: 12 }}>
        {ggufView.map(({ g, fit }) => {
          const local = locals.find((l) => l.name === g.name);
          return <DownloadCard key={g.id} glyph="llamacpp" brandFromName name={g.name} repo={g.url.replace("https://huggingface.co/", "")} tags={[g.params, g.quant, fmtSize(g.sizeBytes)]} fit={fit}
            action={() => downloadGguf(g.id)} progressId={g.id} installed={!!local} onUninstall={local ? () => removeGguf(local.id) : undefined} />;
        })}
        {ggufView.length === 0 && <div className="muted" style={{ fontSize: 12, padding: 14 }}>{t("models.empty.noMatch")}</div>}
        {ollamaInstalled && OLLAMA_CATALOG.filter((m) => !installed.some((i) => i.name === m.name)).map((m) => (
          <DownloadCard key={m.name} glyph="ollama" name={m.label} repo={m.name} tags={[m.kind, m.size, t("models.pill.legacy")]} note={m.note} action={() => pullModel(m.name)} />
        ))}
      </div>

      {ollamaUp && (
        <div className="muted" style={{ fontSize: 11.5, marginTop: 10 }}><Icon name="terminal" size={12} /> {t("models.ollamaRunning")}</div>
      )}
    </>
  );
}

/* ----- Model brand glyph (LobeHub icon on a white chip; falls back to the llama.cpp glyph) ----- */
function ModelGlyph({ name, size = 36 }: { name: string; size?: number }) {
  const url = modelIconUrl(name);
  const [failed, setFailed] = useState(false);
  if (!url || failed) return <ProviderGlyph id="llamacpp" size={size} />;
  const br = Math.round(size * 0.28); const ic = Math.round(size * 0.66);
  return (
    <span style={{ width: size, height: size, flex: `0 0 ${size}px`, borderRadius: br, background: "#fff", display: "grid", placeItems: "center", overflow: "hidden", boxShadow: "inset 0 0 0 1px rgba(0,0,0,.08)" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" width={ic} height={ic} loading="lazy" onError={() => setFailed(true)} style={{ width: ic, height: ic, objectFit: "contain", display: "block" }} />
    </span>
  );
}

/* ----- Embeddings / RAG card ----- */
function EmbeddingsCard() {
  const t = useT();
  const [st, setSt] = useState<{ up: boolean; model: string | null; installed: boolean } | null>(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [, start] = useTransition();
  useEffect(() => { embedStatus().then(setSt).catch(() => {}); }, []);

  function startEmbed() {
    setBusy("start"); setMsg(t("models.embed.starting"));
    start(async () => { const r = await startEmbeddings(); setBusy(""); setMsg(r.up ? "" : r.reason ?? t("models.embed.startFailed")); setSt((s) => s ? { ...s, up: r.up, model: r.model ?? s.model } : s); });
  }
  function reindex() {
    setBusy("reindex"); setMsg(t("models.embed.indexing"));
    start(async () => { const r = await reindexRag(); setBusy(""); setMsg(r.ok ? t(r.embedded ? "models.embed.indexedSemantic" : "models.embed.indexedKeyword", { n: r.chunks }) : t("models.embed.indexFailed")); embedStatus().then(setSt).catch(() => {}); });
  }

  const dot = st?.up ? "run" : st?.installed ? "stop" : "stop";
  const label = !st ? t("models.embed.checking") : st.up ? t("models.embed.live") : st.installed ? t("models.embed.installedStopped") : t("models.embed.noModel");
  return (
    <div className="hw-card">
      <div className="hw-head">
        <span className="hw-ic"><Icon name="pulse" size={19} /></span>
        <div style={{ flex: 1 }}><div className="hw-t">{t("models.embed.title")}</div><div className="hw-s">{t("models.embed.sub")}</div></div>
        <ProviderGlyph id="llamacpp" size={22} />
      </div>
      <div className="srv-status">
        <span className={"srv-dot " + dot} />
        <div className="srv-meta"><div className="sm-t">{label}</div><div className="sm-s">127.0.0.1:8083 · {st?.model ?? "nomic-embed-text"}</div></div>
        {st && !st.up && st.installed && (
          <button className="btn-accent" disabled={busy === "start"} onClick={startEmbed}>
            {busy === "start" ? <span className="sync-spin"><Icon name="refresh" size={13} /></span> : <Icon name="goto" size={13} />} {t("common.start")}
          </button>
        )}
        {st?.up && (
          <button className="btn-ghost" disabled={busy === "reindex"} onClick={reindex}>
            {busy === "reindex" ? <span className="sync-spin"><Icon name="refresh" size={13} /></span> : <Icon name="refresh" size={13} />} {t("models.embed.reindex")}
          </button>
        )}
      </div>
      {st && !st.installed && (
        <div className="form-hint" style={{ marginTop: 8 }}><Icon name="add" size={12} /> {t("models.embed.downloadHintBefore")} <b style={{ color: "var(--text)" }}>nomic-embed-text-v1.5</b> {t("models.embed.downloadHintAfter")}</div>
      )}
      {msg && <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 8 }}>{msg}</div>}
    </div>
  );
}

/* ----- GPU fit detection ----- */
// `key` is a stable enum resolved to a label at the render site via t(`models.fit.${key}`, { unit });
// `unit` ("GPU"/"Metal") is interpolated where the key references it. `tone` drives the colour.
export type Fit = { key: string; unit?: string; tone: "ok" | "tight" | "no" };
function parseBytes(s: string): number {
  const m = /([\d.]+)\s*(TB|GB|MB|KB|B)?/i.exec(s || "");
  if (!m) return 0;
  const n = parseFloat(m[1]); const u = (m[2] || "B").toUpperCase();
  const mult = u === "TB" ? 1e12 : u === "GB" ? 1e9 : u === "MB" ? 1e6 : u === "KB" ? 1e3 : 1;
  return n * mult;
}
/** Does a model of `sizeBytes` fit the accelerator's VRAM (with KV-cache headroom)? On Apple Silicon
 *  `vramBytes` is the unified-memory budget and `unit` is "Metal". Falls back to RAM (CPU). */
function fitFor(sizeBytes: number, vramBytes: number, ramBytes: number, unit = "GPU"): Fit {
  if (vramBytes > 0) {
    if (sizeBytes * 1.2 <= vramBytes) return { key: "fitsUnit", unit, tone: "ok" };
    if (sizeBytes <= vramBytes) return { key: "tightUnit", unit, tone: "tight" };
    if (sizeBytes <= vramBytes * 2) return { key: "partialOffload", tone: "tight" };
    return { key: "cpuOnly", tone: "no" };
  }
  if (ramBytes > 0) return sizeBytes * 1.1 <= ramBytes ? { key: "runsOnCpu", tone: "tight" } : { key: "tooBig", tone: "no" };
  return { key: "", tone: "tight" };
}
const FIT_COLOR: Record<Fit["tone"], string> = { ok: "var(--sx-string)", tight: "var(--sx-number)", no: "#e8688f" };

function DownloadCard({ glyph, name, repo, tags, note, action, installed, onUninstall, fit, brandFromName, progressId }: { glyph: string; name: string; repo: string; tags: string[]; note?: string; action: () => Promise<{ ok: boolean; error?: string }>; installed?: boolean; onUninstall?: () => Promise<{ ok: boolean; error?: string }>; fit?: Fit; brandFromName?: boolean; progressId?: string }) {
  const t = useT();
  const [state, setState] = useState<"idle" | "working" | "done" | "error">("idle");
  const [removed, setRemoved] = useState(false);
  const [msg, setMsg] = useState("");
  const [prog, setProg] = useState<{ received: number; total: number } | null>(null);
  const [, start] = useTransition();
  const isInstalled = (installed && !removed) || state === "done";
  const pct = prog && prog.total > 0 ? Math.min(100, Math.round((prog.received / prog.total) * 100)) : null;
  // Download with a live byte poll (downloadProgress) so the UI shows a %/bar, not just a spinner.
  async function doDownload() {
    setState("working"); setMsg(""); setProg(null);
    let timer: ReturnType<typeof setInterval> | undefined;
    if (progressId) timer = setInterval(() => { fetch(`/api/models/progress?id=${encodeURIComponent(progressId)}`).then((r) => r.json()).then((p) => { if (p) setProg({ received: p.received, total: p.total }); }).catch(() => {}); }, 600);
    try {
      const r = await action();
      setState(r.ok ? "done" : "error"); setMsg(r.ok ? "" : r.error ?? t("models.dl.failed"));
    } finally { if (timer) clearInterval(timer); setProg(null); }
  }
  return (
    <div className="dl-card">
      {brandFromName ? <ModelGlyph name={name} size={36} /> : <ProviderGlyph id={glyph} size={36} />}
      <div className="dl-main">
        <div className="dl-name">{name}</div>
        <div className="dl-repo" title={repo}>{repo.length > 46 ? repo.slice(0, 46) + "…" : repo}</div>
        <div className="dl-tags">
          {tags.map((t) => <span className="dl-tag" key={t}>{t}</span>)}
          {fit && fit.key && <span className="dl-tag" style={{ color: FIT_COLOR[fit.tone], borderColor: FIT_COLOR[fit.tone] }}>{t(`models.fit.${fit.key}`, { unit: fit.unit ?? "" })}</span>}
        </div>
        {note && <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 4 }}>{note}</div>}
        {msg && <div style={{ fontSize: 11, color: state === "error" ? "var(--sx-keyword)" : "var(--sx-string)", marginTop: 4 }}>{msg}</div>}
        {state === "working" && progressId && (
          <div style={{ marginTop: 6 }}>
            <div style={{ height: 4, background: "var(--bg-active)", borderRadius: 3, overflow: "hidden" }}>
              <div className={pct === null ? "sync-spin" : ""} style={{ height: "100%", width: (pct ?? 12) + "%", background: "var(--accent)", transition: "width .3s" }} />
            </div>
            <div style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 3, fontFamily: "var(--mono-font)" }}>
              {pct !== null && prog ? `${pct}% · ${fmtSize(prog.received)} / ${fmtSize(prog.total)}` : prog && prog.received > 0 ? t("models.dl.downloaded", { size: fmtSize(prog.received) }) : t("models.dl.starting")}
            </div>
          </div>
        )}
      </div>
      <div className="dl-right">
        {isInstalled
          ? (onUninstall
              ? <button className="act-btn" disabled={state === "working"} onClick={() => start(async () => { setState("working"); setMsg(t("models.dl.removing")); const r = await onUninstall(); if (r.ok) { setRemoved(true); setState("idle"); setMsg(""); } else { setState("error"); setMsg(r.error ?? t("models.dl.failed")); } })}>
                  {state === "working" ? <span className="sync-spin"><Icon name="refresh" size={11} /></span> : <Icon name="trash" size={11} />} {state === "working" ? t("models.dl.removingBtn") : t("common.uninstall")}
                </button>
              : <span className="act-btn" style={{ color: "var(--sx-string)" }}><Icon name="check" size={11} /> {t("models.dl.installed")}</span>)
          : <button className="act-btn accent" disabled={state === "working"} onClick={doDownload}>
              {state === "working" ? <span className="sync-spin"><Icon name="refresh" size={11} /></span> : <Icon name="add" size={11} />} {state === "working" ? (pct !== null ? pct + "%" : t("models.dl.pulling")) : t("common.download")}
            </button>}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- per-agent */
function PerAgentModels({ agents, providers }: { agents: AgentRow[]; providers: { id: string; adapter: string; catalogId: string; displayName: string; kind: string }[] }) {
  const t = useT();
  const [rows, setRows] = useState(agents);
  const [saved, setSaved] = useState(false);
  const [, start] = useTransition();
  // Only providers actually connected/configured in this workspace (deduped by adapter) — not the
  // whole catalog. An agent keeps any current assignment selectable even if that provider was removed.
  const connectedOpts = useMemo(() => {
    const seen = new Set<string>(); const opts: { value: string; label: string; glyphId: string }[] = [];
    for (const p of providers) { if (!seen.has(p.adapter) && !HIDDEN_CLI_ADAPTERS.has(p.adapter)) { seen.add(p.adapter); opts.push({ value: p.adapter, label: p.displayName, glyphId: p.catalogId }); } }
    return opts;
  }, [providers]);
  const optsFor = (adapter: string) => connectedOpts.some((o) => o.value === adapter)
    ? connectedOpts
    : [{ value: adapter, label: adapterShort(adapter) + " · " + t("models.notConnected"), glyphId: adapter }, ...connectedOpts];
  function setField(id: string, patch: Partial<AgentRow>) { setRows((rs) => rs.map((r) => r.id === id ? { ...r, ...patch } : r)); setSaved(false); }
  function save() { start(async () => { for (const r of rows) await saveAgentModel(r.id, { adapter: r.adapter, model: r.model }); setSaved(true); setTimeout(() => setSaved(false), 1600); }); }
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
        <div className="view-sub" style={{ fontSize: 13 }}>{t("models.perAgent.intro")}</div>
        <div style={{ marginLeft: "auto" }}>{saved ? <span className="oauth-ok" style={{ padding: "6px 11px" }}><Icon name="check" size={13} /> {t("common.saved")}</span> : <button className="btn-accent" onClick={save}><Icon name="check" size={13} /> {t("models.perAgent.saveAssignments")}</button>}</div>
      </div>
      <div className="pa-grid">
        {rows.map((a) => (
          <div className="pa-card" key={a.id}>
            <div className="pa-head"><Avatar name={a.name} color={a.color} size={36} /><div style={{ flex: 1 }}><div className="pa-n">{a.name}</div><div className="pa-r">{a.role} · @{a.handle}</div></div></div>
            <div className="pa-field"><div className="pa-flabel">{t("models.field.provider")}</div><Dropdown glyph searchable value={a.adapter} options={optsFor(a.adapter)} onChange={(v) => setField(a.id, { adapter: v })} /></div>
            <div className="pa-field"><div className="pa-flabel">{t("models.field.model")}</div><ModelPicker adapter={a.adapter} value={a.model} onChange={(v) => setField(a.id, { model: v })} providers={providers} /></div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- catalog modal */
function ProviderCatalog({ connectedIds, onClose }: { connectedIds: string[]; onClose: () => void }) {
  const t = useT();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [conn, setConn] = useState("all");
  const [stat, setStat] = useState("all");
  const [keyFor, setKeyFor] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [, start] = useTransition();
  const cats = useMemo(() => Array.from(new Set(PROVIDER_CATALOG.map((p) => p.category))), []);
  const conns = useMemo(() => Array.from(new Set(PROVIDER_CATALOG.flatMap((p) => p.connectionTypes))), []);
  const stats = useMemo(() => Array.from(new Set(PROVIDER_CATALOG.map((p) => p.status))), []);
  const f = q.trim().toLowerCase();
  const list = PROVIDER_CATALOG.filter((p) => {
    if (cat !== "all" && p.category !== cat) return false;
    if (conn !== "all" && !p.connectionTypes.includes(conn as never)) return false;
    if (stat !== "all" && p.status !== stat) return false;
    if (f && !(p.displayName.toLowerCase().includes(f) || p.id.includes(f) || (p.notes ?? "").toLowerCase().includes(f) || p.defaultAdapter.includes(f))) return false;
    return true;
  });
  function doConnect(id: string, key?: string) { start(async () => { await connectProvider(id, key); setKeyFor(null); setApiKey(""); onClose(); }); }

  return (
    <div className="cat-overlay" onMouseDown={onClose}>
      <div className="cat-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="cat-head">
          <div className="cat-head-row">
            <div className="cat-ico" style={{ width: 40, height: 40, flexBasis: 40 }}><Icon name="cpu" size={20} /></div>
            <div style={{ flex: 1 }}><div className="cat-title">{t("models.catalog.title")}</div><div className="cat-sub">{t("models.catalog.sub", { n: PROVIDER_CATALOG.length })}</div></div>
            <button className="dock-tool" onClick={onClose}><Icon name="close" size={16} /></button>
          </div>
          <div className="cat-search"><Icon name="search" size={15} /><input placeholder={t("models.catalog.searchPlaceholder")} value={q} autoFocus onChange={(e) => setQ(e.target.value)} /></div>
        </div>

        <div className="cat-filters">
          <div className="cat-fgroup"><span className="fg-label">{t("models.filter.category")}</span>
            <button className={"cat-chip" + (cat === "all" ? " on" : "")} onClick={() => setCat("all")}>{t("common.all")}</button>
            {cats.map((c) => <button key={c} className={"cat-chip" + (cat === c ? " on" : "")} onClick={() => setCat(c)}>{t(`models.cat.${c}`)}</button>)}
          </div>
        </div>
        <div className="cat-filters" style={{ paddingTop: 8, paddingBottom: 8 }}>
          <div className="cat-fgroup"><span className="fg-label">{t("models.filter.connection")}</span>
            <button className={"cat-chip" + (conn === "all" ? " on" : "")} onClick={() => setConn("all")}>{t("common.all")}</button>
            {conns.map((c) => <button key={c} className={"cat-chip" + (conn === c ? " on" : "")} onClick={() => setConn(c)}>{t(`models.conn.${c}`)}</button>)}
          </div>
          <div className="cat-fgroup"><span className="fg-label">{t("common.status")}</span>
            <button className={"cat-chip" + (stat === "all" ? " on" : "")} onClick={() => setStat("all")}>{t("common.all")}</button>
            {stats.map((s) => <button key={s} className={"cat-chip" + (stat === s ? " on" : "")} onClick={() => setStat(s)}>{t(`models.catStatus.${s}`)}</button>)}
          </div>
          <span className="cat-count">{t("models.catalog.shown", { n: list.length })}</span>
        </div>

        <div className="cat-grid">
          {list.length === 0 && <div className="cat-empty">{t("models.catalog.noMatch")}</div>}
          {list.map((p) => {
            const isConn = connectedIds.includes(p.id);
            const usable = p.status === "available" || p.status === "experimental" || p.status === "requires_setup";
            return (
              <div className="cat-card" key={p.id}>
                <div className="cat-card-top">
                  <ProviderGlyph id={p.id} size={34} />
                  <div style={{ flex: 1, minWidth: 0 }}><div className="cat-name">{p.displayName}</div><div className="cat-meta">{t(`models.cat.${p.category}`)} · <span style={{ fontFamily: "var(--mono-font)" }}>{p.defaultAdapter}</span></div></div>
                  <span className="cat-stat" style={{ background: STATUS_COLOR[p.status] + "22", color: STATUS_COLOR[p.status] }}>{t(`models.catStatus.${p.status}`)}</span>
                </div>
                {p.notes && <div className="cat-notes">{p.notes}</div>}
                <div className="cat-caps">
                  {p.supportsModelSync && <span className="cap-tag sync">{t("models.cap.sync")}</span>}
                  {p.supportsVision && <span className="cap-tag">{t("models.cap.vision")}</span>}
                  {p.supportsTools && <span className="cap-tag">{t("models.cap.tools")}</span>}
                </div>
                {keyFor === p.id ? (
                  <div className="cat-card-foot" style={{ gap: 6 }}>
                    <input className="form-input mono" style={{ flex: 1, height: 30 }} placeholder={t("models.apiKeyPlaceholder")} value={apiKey} autoFocus onChange={(e) => setApiKey(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") doConnect(p.id, apiKey); }} />
                    <button className="act-btn accent" onClick={() => doConnect(p.id, apiKey)}>{t("common.save")}</button>
                  </div>
                ) : (
                  <div className="cat-card-foot">
                    <div className="cat-conn">{p.connectionTypes.map((c) => <span className="conn-tag" key={c}>{t(`models.conn.${c}`)}</span>)}</div>
                    {isConn
                      ? <span className="act-btn" style={{ color: "var(--sx-string)", borderColor: "color-mix(in srgb, var(--sx-string) 40%, var(--border))" }}><Icon name="check" size={11} /> {t("common.connected")}</span>
                      : usable
                        ? <button className="act-btn accent" onClick={() => p.supportsApiKey && !p.connectionTypes.includes("local") && !p.connectionTypes.includes("cli") ? setKeyFor(p.id) : doConnect(p.id)}><Icon name="add" size={11} /> {t("common.connect")}</button>
                        : <button className="act-btn" disabled>{p.status === "planned" ? t("models.catStatus.planned") : t("models.catStatus.unsupported")}</button>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- screen */
export function ModelsScreen({ providers, locals, agents, hardware, ollamaUp, ollamaInstalled, installed, llamaUp, llamaInstalled, llamaModel }: {
  providers: Prov[]; locals: LocalRow[]; agents: AgentRow[]; hardware: Hardware; ollamaUp: boolean; ollamaInstalled: boolean; installed: { name: string; size: number }[];
  llamaUp: boolean; llamaInstalled: boolean; llamaModel: string | null;
}) {
  const t = useT();
  const [tab, setTab] = useState<"connected" | "local" | "agents">("connected");
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [pop, setPop] = useState<{ row: Prov; pos: { x: number; y: number } } | null>(null);
  const cloud = providers.filter((p) => p.kind === "cloud");
  const cli = providers.filter((p) => p.kind === "cli");
  const connectedIds = providers.map((p) => p.catalogId);
  const counts = useMemo(() => PROVIDER_CATALOG.reduce<Record<string, number>>((a, p) => { a[p.status] = (a[p.status] ?? 0) + 1; return a; }, {}), []);

  useEffect(() => {
    const open = () => setCatalogOpen(true);
    window.addEventListener("constella:models-catalog", open);
    return () => window.removeEventListener("constella:models-catalog", open);
  }, []);

  const TABS = [
    { id: "connected" as const, label: t("models.tab.connected"), icon: "grid" as const, badge: cloud.length + cli.length },
    { id: "local" as const, label: t("models.tab.local"), icon: "cpu" as const },
    { id: "agents" as const, label: t("models.tab.perAgent"), icon: "agents" as const },
  ];

  return (
    <div style={{ position: "relative" }}>
      <div className="dash-grid" style={{ marginBottom: 20 }}>
        <div className="dash-card" style={{ gridColumn: "span 3" }}><h3>{t("models.kpi.catalog")}</h3><div className="kpi">{PROVIDER_CATALOG.length}</div><div className="kpi-sub">{t("models.kpi.providers")}</div></div>
        <div className="dash-card" style={{ gridColumn: "span 3" }}><h3>{t("models.kpi.available")}</h3><div className="kpi" style={{ color: "var(--sx-string)" }}>{counts.available ?? 0}</div><div className="kpi-sub">{t("models.kpi.adaptersReady")}</div></div>
        <div className="dash-card" style={{ gridColumn: "span 3" }}><h3>{t("models.kpi.planned")}</h3><div className="kpi" style={{ color: "#f0a35e" }}>{(counts.planned ?? 0) + (counts.experimental ?? 0)}</div><div className="kpi-sub">{t("models.kpi.plannedExperimental")}</div></div>
        <div className="dash-card" style={{ gridColumn: "span 3" }}><h3>{t("models.kpi.connected")}</h3><div className="kpi" style={{ color: "var(--accent)" }}>{providers.length}</div><div className="kpi-sub">{t("models.kpi.inWorkspace")}</div></div>
      </div>

      <div className="seg-nav">
        {TABS.map((tb) => (
          <button key={tb.id} className={"seg-nav-btn" + (tab === tb.id ? " on" : "")} onClick={() => setTab(tb.id)}>
            <Icon name={tb.icon} size={14} /> {tb.label}{tb.badge != null && <span className="sn-badge">{tb.badge}</span>}
          </button>
        ))}
      </div>

      {tab === "connected" && <>
        <div className="view-section-title">☁ {t("models.section.cloud")}</div>
        <ProviderTable rows={cloud} kind="cloud" onViewModels={(r, e) => { const rect = (e.currentTarget as HTMLElement).getBoundingClientRect(); setPop({ row: r, pos: { x: rect.left, y: rect.bottom + 6 } }); }} />
        <div className="view-section-title">⌘ {t("models.section.cli")}</div>
        <ProviderTable rows={cli} kind="cli" onViewModels={(r, e) => { const rect = (e.currentTarget as HTMLElement).getBoundingClientRect(); setPop({ row: r, pos: { x: rect.left, y: rect.bottom + 6 } }); }} />
      </>}
      {tab === "local" && <LocalRuntime hw={hardware} ollamaUp={ollamaUp} ollamaInstalled={ollamaInstalled} installed={installed} locals={locals} llamaUp={llamaUp} llamaInstalled={llamaInstalled} llamaModel={llamaModel} />}
      {tab === "agents" && <PerAgentModels agents={agents} providers={providers.map((p) => ({ id: p.id, adapter: p.adapter, catalogId: p.catalogId, displayName: p.displayName, kind: p.kind }))} />}

      {catalogOpen && <ProviderCatalog connectedIds={connectedIds} onClose={() => setCatalogOpen(false)} />}
      {pop && <ModelsPopover row={pop.row} pos={pop.pos} onClose={() => setPop(null)} />}
    </div>
  );
}

export function OpenCatalogButton() {
  const t = useT();
  return <button className="btn-accent" onClick={() => window.dispatchEvent(new CustomEvent("constella:models-catalog"))}><Icon name="grid" size={14} /> {t("models.catalog.title")}</button>;
}
