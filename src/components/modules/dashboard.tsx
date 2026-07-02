"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Icon } from "@/components/ui/icon";
import { Avatar } from "@/components/ui/avatar";
import { StatusDot } from "@/components/ui/status-dot";
import { Dropdown } from "@/components/ui/dropdown";
import { Donut, DonutSegments, Sparkline, SegBar, ProgressBar, CHART_PALETTE, type Seg } from "@/components/ui/charts";
import { useT } from "@/lib/i18n-context";
import { getDashboardSnapshot, startDevServer, releaseStaleLock, type DashboardData, type Range, type HealthItem } from "@/server/dashboard";
import { setRunMode } from "@/server/actions/runner-actions";
import { reindexKbAction, curateKbAction } from "@/server/actions/kb-actions";
import { seedDefaultBlocksAction } from "@/server/actions/blocks-actions";

const RANGES: { id: Range; key: string }[] = [
  { id: "today", key: "dash.filter.today" }, { id: "7d", key: "dash.filter.7d" },
  { id: "30d", key: "dash.filter.30d" }, { id: "month", key: "dash.filter.month" },
];
const ACT_LABEL: Record<string, string> = { "start-dev": "dash.act.start", "reindex": "dash.act.reindex", "start-loop": "dash.act.start", open: "dash.act.open", configure: "dash.act.configure", reconnect: "dash.act.reconnect" };
const TASK_COLOR: Record<string, string> = { triage: "var(--text-faint)", todo: "var(--sx-property)", doing: "var(--sx-number)", blocked: "var(--sx-keyword)", review: "var(--sx-function)", done: "var(--sx-string)" };
const HEALTH_ICON: Record<string, string> = { devServer: "cpu", production: "goto", agentLoop: "play", kb: "knowledge", storage: "files", models: "cpu", github: "goto", telegram: "send", testDev: "check", queues: "files", locks: "files", update: "refresh" };
const INTEG_ICON: Record<string, string> = { github: "goto", telegram: "send", models: "cpu", cli: "terminal", local: "cpu", update: "refresh" };

function fmtUsd(n: number) { return "$" + n.toFixed(2); }
function fmtTok(n: number) { return n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? (n / 1e3).toFixed(1) + "K" : String(n); }
function ago(ms: number | null) { if (!ms) return "—"; const s = Math.floor((Date.now() - ms) / 1000); if (s < 60) return s + "s"; if (s < 3600) return Math.floor(s / 60) + "m"; if (s < 86400) return Math.floor(s / 3600) + "h"; return Math.floor(s / 86400) + "d"; }

export function Dashboard({ initial, runMode }: { initial: DashboardData; runMode: string }) {
  const t = useT();
  const [data, setData] = useState<DashboardData>(initial);
  const [opts, setOpts] = useState<{ range: Range; goalId: string; agentId: string }>({ range: initial.range, goalId: "", agentId: "" });
  const optsRef = useRef(opts);
  const [busy, setBusy] = useState("");
  const [, start] = useTransition();
  const [, setTick] = useState(0);

  const fetchNow = useCallback(async () => {
    const o = optsRef.current;
    try { const d = await getDashboardSnapshot({ range: o.range, goalId: o.goalId || null, agentId: o.agentId || null }); setData(d); } catch { /* keep last */ }
  }, []);

  useEffect(() => {
    const poll = setInterval(() => { if (!document.hidden) void fetchNow(); }, 10_000);
    const tick = setInterval(() => { if (!document.hidden) setTick((n) => n + 1); }, 5_000);
    return () => { clearInterval(poll); clearInterval(tick); };
  }, [fetchNow]);

  function applyOpts(next: typeof opts) { setOpts(next); optsRef.current = next; start(() => { void fetchNow(); }); }
  function act(name: string, fn: () => Promise<unknown>) { setBusy(name); start(async () => { try { await fn(); } catch { /* ignore */ } await fetchNow(); setBusy(""); }); }
  function healthAction(item: HealthItem) {
    if (item.action === "start-dev") return act("h-" + item.key, startDevServer);
    if (item.action === "reindex") return act("h-" + item.key, reindexKbAction);
    if (item.action === "start-loop") return act("h-" + item.key, () => setRunMode("start"));
  }

  const c = data.cards;
  const totalTasks = data.tasksByCol.reduce((s, x) => s + x.count, 0);
  const trend = c.spend.trendPct;
  const capPct = c.spend.cap > 0 ? Math.min(100, (c.spend.spent / c.spend.cap) * 100) : 0;
  const capColor = capPct >= 85 ? "var(--sx-keyword)" : capPct >= 60 ? "var(--sx-number)" : "var(--sx-string)";
  const risk = Math.min(100, c.security.high * 15 + c.security.med * 6 + c.security.low * 2);
  const scoreColor = c.security.high ? "var(--sx-keyword)" : c.security.open ? "var(--sx-number)" : "var(--sx-string)";

  const agentSegs: Seg[] = [
    { value: c.agents.idle, color: "var(--text-faint)", label: t("dash.ag.idle") }, { value: c.agents.working, color: "var(--sx-string)", label: t("dash.ag.working") },
    { value: c.agents.review, color: "var(--sx-number)", label: t("dash.ag.review") }, { value: c.agents.blocked, color: "var(--sx-keyword)", label: t("dash.ag.blocked") },
  ];
  const goalSegs: Seg[] = [
    { value: c.goals.active, color: "var(--accent)" }, { value: c.goals.done, color: "var(--sx-string)" }, { value: c.goals.blocked, color: "var(--sx-keyword)" },
  ];
  const secSegs: Seg[] = [
    { value: c.security.high, color: "var(--sx-keyword)" }, { value: c.security.med, color: "var(--sx-number)" }, { value: c.security.low, color: "var(--sx-property)" },
  ];
  // RAG donut: prefer knowledge-by-type; when there are indexed chunks but no typed entries yet, fall
  // back to embedded-vs-raw so the ring reflects the real index instead of rendering empty.
  const kbHasTypes = data.kbByType.length > 0;
  const kbSegs: Seg[] = kbHasTypes
    ? data.kbByType.map((b, i) => ({ value: b.total, color: CHART_PALETTE[i % CHART_PALETTE.length], label: b.type }))
    : [
        { value: data.kb.embeddings, color: "var(--sx-string)", label: t("dash.kb.embeddings") },
        { value: Math.max(0, data.kb.chunks - data.kb.embeddings), color: "var(--bg-active)", label: t("dash.kb.chunks") },
      ];
  const kbCenter = kbHasTypes ? data.kb.active : data.kb.chunks;
  const kbCenterSub = kbHasTypes ? t("dash.kb.entries") : t("dash.kb.chunks");

  return (
    <div className="dash">
      {/* FILTER BAR */}
      <div className="dash-filters">
        <div className="df-ranges">
          {RANGES.map((r) => (
            <button key={r.id} className={"df-chip" + (opts.range === r.id ? " on" : "")} onClick={() => applyOpts({ ...opts, range: r.id })}>{t(r.key)}</button>
          ))}
        </div>
        <div className="df-selects">
          <Dropdown value={opts.goalId} onChange={(v) => applyOpts({ ...opts, goalId: v })}
                    options={[{ value: "", label: t("dash.filter.allGoals") }, ...data.goalOptions.map((g) => ({ value: g.id, label: g.title }))]} />
          <Dropdown value={opts.agentId} onChange={(v) => applyOpts({ ...opts, agentId: v })}
                    options={[{ value: "", label: t("dash.filter.allAgents") }, ...data.agents.map((a) => ({ value: a.id, label: a.name }))]} />
        </div>
        <div className="df-meta">
          <span className="df-updated">{t("dash.updated")} {ago(data.generatedAt)}</span>
          <button className="df-refresh" disabled={!!busy} onClick={() => act("refresh", fetchNow)} title={t("dash.refresh")}><Icon name="refresh" size={13} /></button>
        </div>
      </div>

      {/* OVERVIEW CARDS */}
      <div className="dash-grid">
        {/* Agents */}
        <div className="dash-card stat-card" style={{ gridColumn: "span 3" }}>
          <h3><Icon name="agents" size={14} /> {t("dash.agents")}</h3>
          <div className="sc-body">
            <div className="sc-left">
              <div className="stat-num">{c.agents.activeNow}<span className="stat-of">/{c.agents.total}</span></div>
              <div className="kpi-sub">{t("dash.activeNow")}</div>
            </div>
            <Donut value={c.agents.activeNow} max={Math.max(1, c.agents.total)} size={56} thickness={6} color="var(--sx-string)" center={String(c.agents.activeNow)} />
          </div>
          <SegBar segments={agentSegs} className="sc-seg" />
          <div className="stat-chips">
            <span><i className="dotc" style={{ background: "var(--sx-string)" }} />{c.agents.working} {t("dash.ag.working")}</span>
            <span><i className="dotc" style={{ background: "var(--sx-number)" }} />{c.agents.review} {t("dash.ag.review")}</span>
            <span className={c.agents.blocked ? "bad" : ""}><i className="dotc" style={{ background: "var(--sx-keyword)" }} />{c.agents.blocked} {t("dash.ag.blocked")}</span>
          </div>
          <div className="sc-foot"><Icon name="pulse" size={11} /> {t("dash.ag.heartbeat")} {ago(c.agents.lastHeartbeat)}</div>
        </div>

        {/* Spend */}
        <div className="dash-card stat-card" style={{ gridColumn: "span 3" }}>
          <h3><Icon name="coins" size={14} /> {t("dash.spend")}</h3>
          <div className="sc-body">
            <div className="sc-left">
              <div className="stat-num">{fmtUsd(c.spend.spent)}</div>
              <div className="kpi-sub">{c.spend.cap ? `${Math.round(capPct)}% ${t("dash.ofCapShort", { cap: c.spend.cap })}` : `${fmtTok(c.spend.tokens)} ${t("dash.tokens")}`}</div>
            </div>
            <Sparkline data={data.spendSeries} color="var(--accent)" width={104} height={42} />
          </div>
          <ProgressBar pct={capPct} color={capColor} className="sc-seg" />
          <div className="stat-chips">
            <span className={"trend " + (trend > 0 ? "up" : trend < 0 ? "down" : "")}><Icon name={trend > 0 ? "arrowUp" : trend < 0 ? "arrowDown" : "dot"} size={11} /> {Math.abs(trend)}%</span>
            <span>{t("dash.vsPrev")}</span>
            <span style={{ marginLeft: "auto" }}>{fmtTok(c.spend.tokens)} {t("dash.tokens")}</span>
          </div>
        </div>

        {/* Security */}
        <div className="dash-card stat-card" style={{ gridColumn: "span 3" }}>
          <h3><Icon name="shield" size={14} /> {t("mod.security")}</h3>
          <div className="sc-body">
            <div className="sc-left">
              <div className="stat-num" style={{ color: scoreColor }}>{c.security.score}</div>
              <div className="kpi-sub">{t("dash.openFindings", { n: c.security.open })}</div>
            </div>
            <Donut value={risk} max={100} size={56} thickness={6} color={scoreColor} center={String(c.security.open)} sub={t("dash.openShort")} />
          </div>
          <SegBar segments={secSegs} className="sc-seg" />
          <div className="stat-chips">
            <span className={c.security.high ? "bad" : ""}><i className="dotc" style={{ background: "var(--sx-keyword)" }} />{c.security.high} {t("dash.sev.high")}</span>
            <span><i className="dotc" style={{ background: "var(--sx-number)" }} />{c.security.med} {t("dash.sev.med")}</span>
            <span><i className="dotc" style={{ background: "var(--sx-property)" }} />{c.security.low} {t("dash.sev.low")}</span>
          </div>
          <div className="sc-foot"><Icon name="refresh" size={11} /> {t("dash.lastScan")} {ago(c.security.lastScan)}</div>
        </div>

        {/* Goals */}
        <div className="dash-card stat-card" style={{ gridColumn: "span 3" }}>
          <h3><Icon name="target" size={14} /> {t("mod.goals")}</h3>
          <div className="sc-body">
            <div className="sc-left">
              <div className="stat-num">{c.goals.avgProgress}<span className="stat-of">%</span></div>
              <div className="kpi-sub">{t("dash.avgActive", { n: c.goals.active })}</div>
            </div>
            <Donut value={c.goals.avgProgress} max={100} size={56} thickness={6} color="var(--accent)" />
          </div>
          <SegBar segments={goalSegs} className="sc-seg" />
          <div className="stat-chips">
            <span><i className="dotc" style={{ background: "var(--accent)" }} />{c.goals.active} {t("dash.go.active")}</span>
            <span><i className="dotc" style={{ background: "var(--sx-string)" }} />{c.goals.done} {t("dash.go.done")}</span>
            <span className={c.goals.blocked ? "bad" : ""}><i className="dotc" style={{ background: "var(--sx-keyword)" }} />{c.goals.blocked} {t("dash.go.blocked")}</span>
          </div>
        </div>
      </div>

      {/* SYSTEM HEALTH */}
      <div className="dash-card">
        <h3><Icon name="pulse" size={14} /> {t("dash.healthTitle")}</h3>
        <div className="hcard-grid">
          {data.health.map((h) => (
            <div className="hcard" key={h.key}>
              <div className="hc-top">
                <span className="hc-ic"><Icon name={HEALTH_ICON[h.key] ?? "dot"} size={14} /></span>
                <span className="hc-name">{t("dash.health." + h.key)}</span>
                <span className={"hdot " + h.status} style={{ marginLeft: "auto" }} />
              </div>
              <div className="hc-detail">{h.detail}</div>
              <div className="hc-foot">
                <span className={"hc-badge " + h.status}>{t("dash.hstatus." + h.status)}</span>
                {(h.action === "start-dev" || h.action === "reindex" || h.action === "start-loop")
                  ? <button className="hi-act" disabled={!!busy} onClick={() => healthAction(h)}>{busy === "h-" + h.key ? "…" : t(ACT_LABEL[h.action])}</button>
                  : h.href ? <Link className="hi-act" href={h.href as Route}>{t(ACT_LABEL[h.action ?? "open"] ?? "dash.act.open")}</Link> : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="dash-grid">
        {/* CURRENT EXECUTION */}
        <div className="dash-card" style={{ gridColumn: "span 7" }}>
          <h3><Icon name="play" size={14} /> {t("dash.execTitle")}</h3>
          {data.execution && data.execution.runState === "running" ? (
            <div className="exec-panel">
              <div className="exec-head">
                <span className="dotpulse" />
                <span className="exec-goal">{data.execution.goalTitle ?? data.execution.issueTitle ?? "—"}</span>
                {data.execution.agentName && <span className="exec-agent">{data.execution.agentName}</span>}
                <span className="exec-elapsed mono">{data.execution.elapsedMs ? ago(Date.now() - data.execution.elapsedMs) : ""}</span>
              </div>
              <div className="exec-grid">
                <div className="exec-row"><span className="ex-k">{t("dash.exec.issue")}</span><span className="ex-v">{data.execution.issueTitle ?? "—"}</span></div>
                <div className="exec-row"><span className="ex-k">{t("dash.exec.next")}</span><span className="ex-v">{data.execution.nextStep ?? "—"}</span></div>
                <div className="exec-row"><span className="ex-k">{t("dash.exec.review")}</span><span className="ex-v">{data.execution.reviewOpen ?? 0}</span></div>
                <div className="exec-row"><span className="ex-k">{t("dash.exec.tests")}</span><span className="ex-v">{data.execution.testStatus ? t("dash.test." + data.execution.testStatus) : "—"}</span></div>
                <div className="exec-row"><span className="ex-k">{t("dash.exec.locks")}</span><span className="ex-v">{data.execution.lockedFiles ?? 0}</span></div>
              </div>
            </div>
          ) : (
            <div className="exec-blank">
              <span className="exec-blank-ic"><Icon name="play" size={22} /></span>
              <div className="exec-blank-t">{t("dash.exec.none." + (data.execution?.runState ?? "idle"))}</div>
              <div className="exec-cta">
                <Link className="btn-accent" href="/planner"><Icon name="target" size={13} /> {t("dash.exec.planner")}</Link>
                <button className="btn-ghost" disabled={!!busy} onClick={() => act("loop", () => setRunMode(runMode === "off" ? "start" : "off"))}><Icon name="play" size={13} /> {runMode === "off" ? t("dash.exec.startLoop") : t("dash.exec.pauseLoop")}</button>
                <Link className="btn-ghost" href="/inbox"><Icon name="bell" size={13} /> {t("dash.exec.pending")}</Link>
              </div>
            </div>
          )}
        </div>

        {/* TASKS BY STATUS */}
        <div className="dash-card" style={{ gridColumn: "span 5" }}>
          <h3><Icon name="files" size={14} /> {t("dash.tasksByStatus")}</h3>
          <SegBar segments={data.tasksByCol.map((col) => ({ value: col.count, color: TASK_COLOR[col.col] }))} height={12} className="tasks-seg" />
          <div className="tasks-rows">
            {data.tasksByCol.map((col) => {
              const pct = totalTasks ? Math.round((col.count / totalTasks) * 100) : 0;
              return (
                <Link key={col.col} href={"/tasks" as Route} className="taskrow">
                  <span className="tr-dot" style={{ background: TASK_COLOR[col.col] }} />
                  <span className="tr-name">{t("dash.col." + col.col)}</span>
                  <span className="tr-track"><span className="tr-fill" style={{ width: pct + "%", background: TASK_COLOR[col.col] }} /></span>
                  <span className="tr-val">{col.count}<span className="tr-pct"> {pct}%</span></span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <div className="dash-grid">
        {/* ACTIVE AGENTS */}
        <div className="dash-card" style={{ gridColumn: "span 7" }}>
          <h3><Icon name="bot" size={14} /> {t("dash.activeAgents")}</h3>
          {data.agents.length === 0 ? (
            <div className="exec-blank">
              <span className="exec-blank-ic"><Icon name="bot" size={22} /></span>
              <div className="exec-blank-t">{t("dash.noActive")}</div>
              <div className="exec-cta">
                <button className="btn-accent" disabled={!!busy} onClick={() => act("loop", () => setRunMode("start"))}><Icon name="play" size={13} /> {t("dash.exec.startLoop")}</button>
                <Link className="btn-ghost" href={"/agents/ada" as Route}><Icon name="agents" size={13} /> {t("dash.openStudio")}</Link>
                <Link className="btn-ghost" href="/config"><Icon name="settings" size={13} /> {t("dash.runConfig")}</Link>
              </div>
            </div>
          ) : (
            <div className="agent-grid">
              {data.agents.map((a) => {
                const cost = data.costByAgent[a.id] ?? 0;
                return (
                  <div className="agent-card" key={a.id}>
                    <Avatar name={a.name} color={a.color} size={32} health={a.health} />
                    <div className="ac-main">
                      <div className="ac-top"><span className="ac-name">{a.name}</span><StatusDot status={a.status} /></div>
                      <div className="ac-meta"><span className="ac-model mono">{a.model}</span>{cost > 0 && <span className="ac-cost">{fmtUsd(cost)}</span>}</div>
                      <div className="ac-task">{a.taskTitle ?? t("dash.ag." + a.status)}</div>
                      <div className="ac-hb"><Icon name="pulse" size={10} /> {ago(a.lastPulseMs)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* GROUPED ALERTS */}
        <div className="dash-card" style={{ gridColumn: "span 5" }}>
          <h3><Icon name="bell" size={14} /> {t("dash.alerts")}</h3>
          {data.alerts.length === 0 ? (
            <div className="home-empty">{t("dash.nothingNeedsYou")}</div>
          ) : data.alerts.map((al) => (
            <Link href="/inbox" key={al.key} className="alert-group">
              <span className={"ag-badge p" + al.priority}>{al.count}</span>
              <span className="ag-text">{t("dash.alert." + al.kind)}{al.agentName ? ` · ${al.agentName}` : ""}</span>
              <span className="ag-time">{ago(al.latestAtMs)}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* PROBLEMS */}
      {data.problems.length > 0 && (
        <div className="dash-card">
          <h3><Icon name="warn" size={14} /> {t("dash.problemsTitle")}</h3>
          {data.problems.map((p) => (
            <div className="problem-row" key={p.key}>
              <span className={"prob-sev " + p.severity}>{t("dash.sev." + p.severity)}</span>
              <div className="pr-main"><div className="pr-title">{t(p.title)}</div><div className="pr-impact">{t(p.impact)}</div></div>
              <Link className="hi-act" href={p.href as Route}>{t(ACT_LABEL[p.action] ?? "dash.act.open")}</Link>
            </div>
          ))}
        </div>
      )}

      <div className="dash-grid">
        {/* KB / RAG */}
        <div className="dash-card" style={{ gridColumn: "span 7" }}>
          <h3><Icon name="knowledge" size={14} /> {t("dash.kbTitle")}</h3>
          {data.kb.chunks === 0 ? (
            <div className="exec-blank">
              <span className="exec-blank-ic"><Icon name="knowledge" size={22} /></span>
              <div className="exec-blank-t">{t("dash.kb.empty")}</div>
              <div className="exec-cta">
                <button className="btn-accent" disabled={!!busy} onClick={() => act("kb-seed", seedDefaultBlocksAction)}><Icon name="add" size={13} /> {t("dash.kb.createBlocks")}</button>
                <Link className="btn-ghost" href="/knowledge"><Icon name="knowledge" size={13} /> {t("dash.kb.open")}</Link>
              </div>
            </div>
          ) : (
            <div className="kb-body">
              <div className="kb-donut">
                <DonutSegments segments={kbSegs} size={104} thickness={13} center={String(kbCenter)} sub={kbCenterSub} />
                <div className="kb-legend">
                  {kbHasTypes
                    ? data.kbByType.slice(0, 6).map((b, i) => (
                        <span className="kb-leg" key={b.type}><i className="dotc" style={{ background: CHART_PALETTE[i % CHART_PALETTE.length] }} />{b.type} <b>{b.total}</b></span>
                      ))
                    : <>
                        <span className="kb-leg"><i className="dotc" style={{ background: "var(--sx-string)" }} />{t("dash.kb.embeddings")} <b>{data.kb.embeddings}</b></span>
                        <span className="kb-leg"><i className="dotc" style={{ background: "var(--bg-active)" }} />{t("dash.kb.chunks")} <b>{data.kb.chunks}</b></span>
                      </>}
                </div>
              </div>
              <div className="kb-right">
                <div className="kb-tiles">
                  <div className="ks"><div className="ks-v">{data.kb.chunks}</div><div className="ks-k">{t("dash.kb.chunks")}</div></div>
                  <div className="ks"><div className="ks-v">{data.kb.embeddings}</div><div className="ks-k">{t("dash.kb.embeddings")}</div></div>
                  <div className="ks"><div className="ks-v">{data.kb.recentQueries}</div><div className="ks-k">{t("dash.kb.queries")}</div></div>
                  <div className="ks"><div className={"ks-v" + (data.kb.gaps ? " warn" : "")}>{data.kb.gaps}</div><div className="ks-k">{t("dash.kb.gaps")}</div></div>
                  <div className="ks"><div className="ks-v">{ago(data.kb.lastReindexMs)}</div><div className="ks-k">{t("dash.kb.lastReindex")}</div></div>
                  <div className="ks"><div className={"ks-v" + (data.kb.semantic ? "" : " warn")}>{data.kb.semantic ? "●" : "○"}</div><div className="ks-k">{t("dash.kb.semantic")}</div></div>
                </div>
                <div className="exec-cta">
                  <Link className="btn-ghost" href="/knowledge"><Icon name="knowledge" size={13} /> {t("dash.kb.open")}</Link>
                  <button className="btn-ghost" disabled={!!busy} onClick={() => act("kb-reindex", reindexKbAction)}><Icon name="refresh" size={13} /> {t("dash.kb.reindex")}</button>
                  <button className="btn-ghost" disabled={!!busy} onClick={() => act("kb-curate", curateKbAction)}><Icon name="skill" size={13} /> {t("dash.kb.curate")}</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* INTEGRATIONS */}
        <div className="dash-card" style={{ gridColumn: "span 5" }}>
          <h3><Icon name="ext" size={14} /> {t("dash.integTitle")}</h3>
          <div className="integ-grid">
            {data.integrations.map((ig) => (
              <div className="integ-card" key={ig.key}>
                <span className="ic-ic"><Icon name={INTEG_ICON[ig.key] ?? "ext"} size={14} /></span>
                <div className="ic-main">
                  <div className="ic-name">{t("dash.integ." + ig.key)}</div>
                  <div className="ic-detail">{ig.detail}</div>
                </div>
                <span className={"integ-chip " + ig.status}>{t("dash.integStatus." + ig.status)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FILE LOCKS */}
      {data.locks.length > 0 && (
        <div className="dash-card">
          <h3><Icon name="files" size={14} /> {t("dash.locksTitle")}</h3>
          {data.locks.map((l) => (
            <div className="lock-row" key={l.path}>
              <Icon name="files" size={13} />
              <span className="lk-path mono">{l.path}</span>
              <span className="lk-by">@{l.agentHandle}</span>
              <button className="hi-act" disabled={!!busy} onClick={() => act("lock-" + l.path, () => releaseStaleLock(l.path))}>{t("dash.locks.release")}</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
