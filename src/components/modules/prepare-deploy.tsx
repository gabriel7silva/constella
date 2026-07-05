"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { Dropdown } from "@/components/ui/dropdown";
import { AgentRunLive } from "@/components/modules/agent-run-live";
import { useT } from "@/lib/i18n-context";
import {
  runDeployPipeline, getDeployRun, previewCleanExport, exportCleanSource,
  runBuildOnly, runTestsOnly, generateReadme, generateDeployDocs, getDeployEnv,
  type ExportResult, type CleanPreview, type DeployEnv, type TreeNode,
} from "@/server/prepare-deploy";
import type { DeployRunRow, PipelineStep, ChecklistItem } from "@/server/deploy-store";

type Repo = { full: string; private: boolean; branch: string };

const PIPE_KEYS = ["analyze", "deps", "env", "tests", "secrets", "build", "validateBuild", "agent", "package"];

const STATUS_STYLE: Record<string, { bg: string; c: string }> = {
  idle: { bg: "var(--bg-active)", c: "var(--text-dim)" },
  running: { bg: "color-mix(in srgb, var(--accent) 18%, transparent)", c: "var(--accent)" },
  done: { bg: "rgba(179,217,122,.16)", c: "var(--sx-string)" },
  failed: { bg: "rgba(232,104,143,.16)", c: "#e8688f" },
  blocked: { bg: "rgba(232,104,143,.16)", c: "#e8688f" },
};
const CHK: Record<string, { icon: string; c: string }> = {
  ok: { icon: "check", c: "var(--sx-string)" },
  warn: { icon: "warn", c: "var(--sx-number)" },
  fail: { icon: "close", c: "#e8688f" },
  todo: { icon: "dot", c: "var(--text-faint)" },
};

function stageClass(status: string): string {
  switch (status) {
    case "done": return "done";
    case "running": return "active";
    case "error": case "blocked": return "fail";
    case "needs-action": return "wait";
    default: return "todo";
  }
}
function humanBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
function ago(ms: number | null): string {
  if (!ms) return "";
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function PrepareDeploy({ hasToken, repos, project, env: env0, run: run0, checklist: checklist0 }: {
  hasToken: boolean;
  repos: Repo[];
  project: { name: string; kind: string; label: string } | null;
  env: DeployEnv;
  run: DeployRunRow;
  checklist: ChecklistItem[];
}) {
  const t = useT();
  const [, start] = useTransition();
  const [busy, setBusy] = useState("");

  const [run, setRun] = useState<DeployRunRow>(run0);
  const [env, setEnv] = useState<DeployEnv>(env0);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(checklist0);
  const [preview, setPreview] = useState<CleanPreview | null>(null);
  const [showLogs, setShowLogs] = useState(false);

  // export form
  const [useToken, setUseToken] = useState(!hasToken);
  const [token, setToken] = useState("");
  const [repoFull, setRepoFull] = useState(repos[0]?.full ?? "");
  const [manualRepo, setManualRepo] = useState("");
  const [branch, setBranch] = useState(repos[0]?.branch ?? "main");
  const [exp, setExp] = useState<ExportResult | null>(null);

  const initiallyRunning = useRef(run0.status === "running");
  const initialSeq = useRef(run0.startedAt ?? 0);

  const refresh = useCallback(() => {
    void getDeployRun().then((r) => { setRun(r); setChecklist(r.checklist); });
  }, []);

  // Poll the run row while a pipeline is in progress (drives the visual pipeline live).
  useEffect(() => {
    if (run.status !== "running") return;
    let alive = true;
    const id = setInterval(async () => {
      const r = await getDeployRun();
      if (!alive) return;
      setRun(r);
      if (r.status !== "running") { setChecklist(r.checklist); clearInterval(id); }
    }, 900);
    return () => { alive = false; clearInterval(id); };
  }, [run.status]);

  function fireLive() { window.dispatchEvent(new CustomEvent("constella:agent-run", { detail: { channel: "deploy" } })); }

  function runPrep() {
    setBusy("prep"); setShowLogs(true); fireLive();
    setRun({ ...run, status: "running", steps: PIPE_KEYS.map((k) => ({ key: k, label: k, status: "waiting" as const })) });
    start(async () => {
      const r = await runDeployPipeline();
      setRun(r); setChecklist(r.checklist); setBusy("");
    });
  }
  function quick(name: string, fn: () => Promise<unknown>) {
    setBusy(name); fireLive();
    start(async () => { await fn(); refresh(); setBusy(""); });
  }
  function onScan() {
    setBusy("scan");
    start(async () => { const p = await previewCleanExport(); setPreview(p); setBusy(""); });
  }
  function onValidateEnv() {
    setBusy("env");
    start(async () => { const e = await getDeployEnv(); setEnv(e); setBusy(""); });
  }
  function doExport() {
    setBusy("export"); setExp(null);
    const repo = (repos.length && !useToken ? repoFull : manualRepo).trim();
    start(async () => {
      const r = await exportCleanSource({ repo, token: useToken ? token.trim() || undefined : undefined, branch: branch.trim() || "main" });
      setExp(r);
      if (r.blocked && r.secrets) setPreview((p) => p ? { ...p, secrets: r.secrets!, blocked: true } : p);
      setBusy("");
    });
  }

  const ss = STATUS_STYLE[run.status] ?? STATUS_STYLE.idle;
  const steps: PipelineStep[] = run.steps.length ? run.steps : PIPE_KEYS.map((k) => ({ key: k, label: k, status: "waiting" }));
  const targetRepo = (repos.length && !useToken ? repoFull : manualRepo) || repos[0]?.full || t("deploy.notConfigured");
  const exportBlocked = !!preview?.blocked;
  const noProject = !env.detected;
  const formIncomplete = !useToken && repos.length > 0 ? !repoFull : !manualRepo.trim() || !token.trim();

  const dot = (status: string, i: number) => {
    if (status === "done") return <Icon name="check" size={13} />;
    if (status === "error" || status === "blocked") return "!";
    if (status === "running") return <span className="sync-spin"><Icon name="refresh" size={12} /></span>;
    if (status === "needs-action") return "~";
    return i + 1;
  };

  return (
    <div className="pd-page">
      {/* HERO */}
      <div className="hw-card pd-hero">
        <span className="hw-ic"><Icon name="cpu" size={20} /></span>
        <div className="pd-hero-body">
          <div className="pd-hero-top">
            <div className="hw-t">{project ? project.name : t("deploy.env.noProject")}</div>
            <span className="pd-pill" style={{ background: ss.bg, color: ss.c }}>{t("deploy.status." + run.status)}</span>
          </div>
          <div className="pd-hero-meta">
            <span><Icon name="cpu" size={12} /> {env.framework ?? env.runtime}{env.runLabel ? ` · ${env.runLabel}` : ""}</span>
            <span><Icon name="goto" size={12} /> {targetRepo}{branch ? ` · ${branch}` : ""}</span>
            <span><Icon name="calendar" size={12} /> {t("deploy.lastPrep")}: {run.startedAt ? `${ago(run.startedAt)}` : t("deploy.never")}</span>
            {run.lastExport?.ok && <span><Icon name="check" size={12} /> {run.lastExport.sha}</span>}
          </div>
        </div>
        <div className="pd-hero-actions">
          <button className="btn-accent" disabled={busy === "prep" || run.status === "running" || noProject} onClick={runPrep}>
            {busy === "prep" || run.status === "running"
              ? <><span className="sync-spin"><Icon name="refresh" size={13} /></span> {t("deploy.preparing")}</>
              : <><Icon name="play" size={13} /> {run.status === "idle" ? t("deploy.run") : t("deploy.runAgain")}</>}
          </button>
          <button className="btn-ghost" onClick={() => document.getElementById("pd-export")?.scrollIntoView({ behavior: "smooth" })}><Icon name="arrowUp" size={13} /> {t("deploy.export")}</button>
          <button className="btn-ghost" onClick={() => { setShowLogs((v) => !v); document.getElementById("pd-logs")?.scrollIntoView({ behavior: "smooth" }); }}><Icon name="terminal" size={13} /> {t("deploy.logs")}</button>
        </div>
      </div>

      <div className="pd-cols" style={{ alignItems: "stretch" }}>
        {/* LEFT — pipeline + logs + quick actions */}
        <div className="pd-col">
          <div className="hw-card">
            <div className="hw-head">
              <span className="hw-ic"><Icon name="split" size={18} /></span>
              <div style={{ flex: 1 }}><div className="hw-t">{t("deploy.pipeline")}</div><div className="hw-s">{env.framework ?? env.runtime}{env.runLabel ? ` · ${env.runLabel}` : ""}</div></div>
            </div>
            <div className="ceo-pipe">
              {steps.map((s, i) => (
                <div className={"ceo-stage " + stageClass(s.status)} key={s.key}>
                  <span className="cs-dot">{dot(s.status, i)}</span>
                  <div className="cs-main">
                    <div className="cs-t">{t("deploy.step." + s.key)}</div>
                    {s.detail && <div className="cs-d">{s.detail}</div>}
                    <div className="cs-meta">{t("deploy.st." + s.status)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div id="pd-logs">
            <AgentRunLive channel="deploy" resume={initiallyRunning.current} sinceSeq={initialSeq.current} onFinish={refresh} />
            {showLogs && run.buildLog && <pre className="pd-log">{run.buildLog}</pre>}
          </div>

          <div className="hw-card">
            <div className="hw-head"><span className="hw-ic"><Icon name="grid" size={18} /></span><div style={{ flex: 1 }}><div className="hw-t">{t("deploy.qa.title")}</div></div></div>
            <div className="pd-quick">
              <button className="btn-ghost" disabled={!!busy || noProject} onClick={() => quick("build", runBuildOnly)}><Icon name="cpu" size={13} /> {t("deploy.qa.build")}</button>
              <button className="btn-ghost" disabled={!!busy || noProject} onClick={() => quick("tests", runTestsOnly)}><Icon name="check" size={13} /> {t("deploy.qa.tests")}</button>
              <button className="btn-ghost" disabled={!!busy} onClick={onScan}><Icon name="shield" size={13} /> {t("deploy.qa.scan")}</button>
              <button className="btn-ghost" disabled={!!busy || noProject} onClick={() => quick("readme", generateReadme)}><Icon name="doc" size={13} /> {t("deploy.qa.readme")}</button>
              <button className="btn-ghost" disabled={!!busy || noProject} onClick={() => quick("deploydocs", generateDeployDocs)}><Icon name="doc" size={13} /> {t("deploy.qa.deploydocs")}</button>
              <button className="btn-ghost" disabled={!!busy} onClick={onValidateEnv}><Icon name="settings" size={13} /> {t("deploy.qa.env")}</button>
              <button className="btn-ghost" disabled={!!busy} onClick={onScan}><Icon name="files" size={13} /> {t("deploy.qa.review")}</button>
              <Link href="/inbox" className="btn-ghost"><Icon name="bell" size={13} /> {t("deploy.qa.inbox")}</Link>
            </div>
          </div>

          {/* SECURITY — moved here so it fills the left column; env stretches to fill the right */}
          <div className="hw-card">
            <div className="hw-head">
              <span className="hw-ic"><Icon name="shield" size={18} /></span>
              <div style={{ flex: 1 }}><div className="hw-t">{t("deploy.sec.title")}</div></div>
              <button className="btn-ghost" disabled={!!busy} onClick={onScan}>{busy === "scan" ? <><span className="sync-spin"><Icon name="refresh" size={12} /></span> {t("deploy.sec.scanning")}</> : <><Icon name="refresh" size={12} /> {t("deploy.sec.rescan")}</>}</button>
            </div>
            {preview === null ? (
              <div className="home-empty">{t("deploy.sec.notRun")}</div>
            ) : preview.secrets.length > 0 ? (
              <>
                <div className="pd-gate"><Icon name="shield" size={14} /> {t("deploy.sec.blocked")}</div>
                <div className="srv-log scroll" style={{ maxHeight: 150 }}>{preview.secrets.map((s, i) => <div key={i} className="lg-warn">{s.file}:{s.line} · {s.kind}</div>)}</div>
                <Link href="/inbox" className="btn-ghost" style={{ marginTop: 8 }}><Icon name="bell" size={13} /> {t("deploy.sec.openInbox")}</Link>
              </>
            ) : (
              <div className="pd-ok"><Icon name="check" size={14} style={{ color: "var(--sx-string)" }} /> {t("deploy.sec.clean")}</div>
            )}
          </div>
        </div>

        {/* RIGHT — checklist + env (env stretches to fill) */}
        <div className="pd-col">
          <div className="hw-card">
            <div className="hw-head"><span className="hw-ic"><Icon name="check" size={18} /></span><div style={{ flex: 1 }}><div className="hw-t">{t("deploy.checklist")}</div></div></div>
            <div className="pd-checklist">
              {checklist.map((c) => {
                const m = CHK[c.status] ?? CHK.todo;
                return (
                  <div className="pd-chk-row" key={c.key}>
                    <Icon name={m.icon} size={14} style={{ color: m.c, flex: "0 0 auto" }} />
                    <span className="pd-chk-label">{t("deploy.chk." + c.key)}</span>
                    {c.detail && <span className="pd-chk-detail">{c.detail}</span>}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="hw-card" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <div className="hw-head">
              <span className="hw-ic"><Icon name="settings" size={18} /></span>
              <div style={{ flex: 1 }}><div className="hw-t">{t("deploy.env.title")}</div></div>
              <button className="btn-ghost" disabled={!!busy} onClick={onValidateEnv}><Icon name="refresh" size={12} /> {t("deploy.env.validate")}</button>
            </div>
            {noProject ? (
              <div className="home-empty">{t("deploy.env.noProject")}</div>
            ) : (
              <>
                <div className="pd-env-grid">
                  <span className="pd-env-k">{t("deploy.env.runtime")}</span><span className="pd-env-v">{env.runtime}</span>
                  {env.framework && <><span className="pd-env-k">{t("deploy.env.framework")}</span><span className="pd-env-v">{env.framework}</span></>}
                  {env.packageManager && <><span className="pd-env-k">{t("deploy.env.pm")}</span><span className="pd-env-v">{env.packageManager}</span></>}
                  <span className="pd-env-k">{t("deploy.env.database")}</span><span className="pd-env-v">{env.database === "none" ? t("deploy.env.none") : t("deploy.db." + env.database)}</span>
                  {env.ports.length > 0 && <><span className="pd-env-k">{t("deploy.env.ports")}</span><span className="pd-env-v">{env.ports.join(", ")}</span></>}
                  <span className="pd-env-k">{t("deploy.env.docker")}</span><span className="pd-env-v">{env.hasDockerfile || env.hasCompose ? t("deploy.env.yes") : t("deploy.env.no")}</span>
                  <span className="pd-env-k">{t("deploy.env.build")}</span><span className="pd-env-v mono">{env.buildScript || "—"}</span>
                  <span className="pd-env-k">{t("deploy.env.start")}</span><span className="pd-env-v mono">{env.startScript || "—"}</span>
                  <span className="pd-env-k">{t("deploy.env.mode")}</span><span className="pd-env-v">{env.mode}</span>
                </div>
                <div className="pd-env-vars" style={{ marginTop: "auto" }}>
                  <div className="pa-flabel">{t("deploy.env.requiredVars")}</div>
                  {env.requiredEnv.length === 0 && env.unsetEnvKeys.length === 0 && <div className="hw-s">—</div>}
                  {env.requiredEnv.map((v) => <span className="pd-var" key={v.key}>{v.key}</span>)}
                  {env.unsetEnvKeys.map((k) => <span className="pd-var warn" key={k} title={t("deploy.env.unset")}>{k}</span>)}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* CLEAN PACKAGE PREVIEW */}
      <div className="hw-card">
        <div className="hw-head">
          <span className="hw-ic"><Icon name="files" size={18} /></span>
          <div style={{ flex: 1 }}><div className="hw-t">{t("deploy.pkg.title")}</div></div>
          <button className="btn-ghost" disabled={!!busy} onClick={onScan}>{busy === "scan" ? <><span className="sync-spin"><Icon name="refresh" size={12} /></span> {t("deploy.pkg.loading")}</> : <><Icon name="files" size={13} /> {t("deploy.pkg.review")}</>}</button>
        </div>
        {preview === null ? (
          <div className="home-empty">{t("deploy.pkg.review")}.</div>
        ) : preview.includedCount === 0 ? (
          <div className="home-empty">{t("deploy.pkg.empty")}</div>
        ) : (
          <>
            <div className="pd-pkg-meta">
              <span><b>{preview.includedCount}</b> {t("deploy.pkg.included")}</span>
              <span><b>{preview.ignoredCount}</b> {t("deploy.pkg.ignored")}</span>
              <span><b>{humanBytes(preview.totalBytes)}</b> {t("deploy.pkg.size")}</span>
              <span>{t("deploy.pkg.buildOutput")}: <b style={{ color: preview.hasBuild ? "var(--sx-string)" : "var(--text-dim)" }}>{preview.hasBuild ? t("deploy.pkg.present") : t("deploy.pkg.absent")}</b></span>
            </div>
            <div className="folder-grid" style={{ marginTop: 10 }}>
              {preview.tree.map((n: TreeNode) => (
                <div className="folder-item" key={n.name}>
                  <Icon name={n.kind === "dir" ? "files" : "doc"} size={15} />
                  <span className="fi-name">{n.name}</span>
                  <span className="hw-s" style={{ marginLeft: "auto" }}>{n.kind === "dir" ? `${n.childCount} ${t("deploy.pkg.files")}` : humanBytes(n.size ?? 0)}</span>
                </div>
              ))}
            </div>
            {preview.docs.length > 0 && <div className="pd-pkg-docs">{t("deploy.pkg.docs")}: {preview.docs.map((d) => <span className="pd-var" key={d}>{d}</span>)}</div>}
          </>
        )}
      </div>

      {/* EXPORT */}
      <div className="hw-card" id="pd-export">
        <div className="hw-head">
          <span className="hw-ic"><Icon name="goto" size={18} /></span>
          <div style={{ flex: 1 }}><div className="hw-t">{t("deploy.exp.title")}</div><div className="hw-s">{t("deploy.exp.sub")}</div></div>
        </div>
        <div className="form-hint" style={{ marginBottom: 10 }}><Icon name="shield" size={12} /> {t("deploy.exp.diff")}</div>

        {exportBlocked && <div className="pd-gate" style={{ marginBottom: 10 }}><Icon name="shield" size={14} /> {t("deploy.exp.gate")}</div>}

        {repos.length > 0 && (
          <div className="seg" style={{ marginBottom: 10 }}>
            <button className={"seg-opt" + (!useToken ? " on" : "")} onClick={() => setUseToken(false)}>{t("deploy.exp.connected")}</button>
            <button className={"seg-opt" + (useToken ? " on" : "")} onClick={() => setUseToken(true)}>{t("deploy.exp.token")}</button>
          </div>
        )}

        {!useToken && repos.length > 0 ? (
          <div style={{ marginBottom: 8 }}>
            <div className="pa-flabel" style={{ marginBottom: 4 }}>{t("deploy.exp.target")}</div>
            <Dropdown value={repoFull} options={repos.map((r) => ({ value: r.full, label: r.full, tag: r.private ? t("deploy.exp.private") : t("deploy.exp.public") }))} onChange={(v) => { setRepoFull(v); setBranch(repos.find((r) => r.full === v)?.branch ?? "main"); }} />
          </div>
        ) : (
          <div style={{ display: "grid", gap: 8, marginBottom: 8 }}>
            <input className="form-input mono" type="password" placeholder={t("deploy.exp.tokenPh")} value={token} onChange={(e) => setToken(e.target.value)} />
            <input className="form-input mono" placeholder={t("deploy.exp.repoPh")} value={manualRepo} onChange={(e) => setManualRepo(e.target.value)} />
          </div>
        )}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input className="form-input mono" style={{ maxWidth: 160 }} placeholder={t("deploy.exp.branch")} value={branch} onChange={(e) => setBranch(e.target.value)} />
          <button className="btn-accent" disabled={busy === "export" || exportBlocked || formIncomplete} onClick={doExport}>
            {busy === "export" ? <><span className="sync-spin"><Icon name="refresh" size={13} /></span> {t("deploy.exp.exporting")}</> : <><Icon name="arrowUp" size={13} /> {t("deploy.exp.title")}</>}
          </button>
        </div>

        {exp && (
          <div className="pd-result" style={{ marginTop: 12 }}>
            {exp.ok ? (
              <div style={{ fontSize: 12.5, color: "var(--sx-string)" }}><Icon name="check" size={13} /> {t("deploy.exp.pushedPrefix")} {exp.copied} {t("deploy.exp.pushedSuffix")} · {exp.sha}</div>
            ) : exp.blocked ? (
              <>
                <div style={{ fontSize: 12.5, color: "#e8688f", marginBottom: 6 }}><Icon name="shield" size={13} /> {exp.error}</div>
                <div className="srv-log scroll" style={{ maxHeight: 140 }}>{(exp.secrets ?? []).map((s, i) => <div key={i} className="lg-warn">{s.file}:{s.line} · {s.kind}</div>)}</div>
                <div className="form-hint" style={{ marginTop: 6 }}>{t("deploy.exp.blockedNote")}</div>
              </>
            ) : (
              <div style={{ fontSize: 12.5, color: "#e8688f" }}>{exp.error}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
