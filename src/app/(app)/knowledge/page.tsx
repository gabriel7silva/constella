import { requireWorkspace } from "@/lib/workspace";
import { kbOverview } from "@/server/kb";
import { activeLocks } from "@/server/file-locks";
import { listBlocks, listProposals } from "@/server/blocks";
import { getT } from "@/lib/i18n-server";
import { ViewShell } from "@/components/shell/view-shell";
import { Icon } from "@/components/ui/icon";
import { timeAgo } from "@/lib/timeago";
import { KbActions } from "@/components/modules/kb-actions";
import { BlocksPanel } from "@/components/modules/blocks-panel";

const STATUS_COLOR: Record<string, string> = { active: "#7ee0a5", done: "#84aef5", cancelled: "#e8688f", archived: "#828aa3" };

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="card" style={{ flex: "1 1 140px", minWidth: 140 }}>
      <div className="muted" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, marginTop: 4 }}>{value}</div>
      {hint && <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

function Bar({ frac }: { frac: number }) {
  return (
    <div style={{ height: 6, borderRadius: 3, background: "var(--bg-elevated)", overflow: "hidden", minWidth: 80 }}>
      <div style={{ width: `${Math.round(Math.max(0, Math.min(1, frac)) * 100)}%`, height: "100%", background: "var(--accent)" }} />
    </div>
  );
}

export default async function KnowledgePage() {
  const t = await getT();
  const { workspace } = await requireWorkspace();
  const o = await kbOverview(workspace.id);
  const locks = await activeLocks(workspace.id);
  const blocks = await listBlocks(workspace.id);
  const proposals = await listProposals(workspace.id);
  const embPct = o.index.chunks ? Math.round((o.index.embedded / o.index.chunks) * 100) : 0;

  return (
    <ViewShell title={t("mod.knowledge")} sub={t("kb.sub")} right={<KbActions />}>

      {/* Index status */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <Stat label={t("kb.entries")} value={o.total} hint={t("kb.entriesHint", { n: o.lifecycle.active })} />
        <Stat label={t("kb.ragChunks")} value={o.index.chunks} hint={t("kb.ragChunksHint", { a: o.index.active, o: o.index.obsolete })} />
        <Stat label={t("kb.kbChunks")} value={o.index.kbChunks} hint={t("kb.kbChunksHint")} />
        <Stat label={t("kb.embedded")} value={`${embPct}%`} hint={o.index.semantic ? t("kb.embeddedSemantic", { dim: o.index.dim || "?" }) : t("kb.embeddedKeyword")} />
        <Stat label={t("kb.indexHealth")} value={o.index.semantic ? t("kb.semantic") : t("kb.keyword")} hint={o.index.lastUpdated ? t("kb.updated", { ago: timeAgo(new Date(o.index.lastUpdated)) }) : t("kb.notBuilt")} />
      </div>

      {/* Reconcile the common confusion: RAG is full but the curated KB layer hasn't been built yet. */}
      {o.total === 0 && o.index.chunks > 0 && (
        <div className="home-empty" style={{ marginTop: 12 }}>{t("kb.emptyEntries", { n: o.index.chunks })}</div>
      )}

      {/* Lifecycle */}
      <div className="card" style={{ marginTop: 12 }}>
        <div className="lr-title" style={{ marginBottom: 8 }}><Icon name="sync" size={14} style={{ color: "var(--accent)" }} /> {t("kb.lifecycle")}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 18 }}>
          <span><b>{o.lifecycle.active}</b> <span className="muted">{t("kb.active")}</span></span>
          <span><b>{o.lifecycle.superseded}</b> <span className="muted">{t("kb.superseded")}</span></span>
          <span><b>{o.lifecycle.obsolete}</b> <span className="muted">{t("kb.obsolete")}</span></span>
          <span><b>{o.lifecycle.archived}</b> <span className="muted">{t("kb.archived")}</span></span>
        </div>
      </div>

      {/* Active file locks */}
      <div className="card" style={{ marginTop: 12 }}>
        <div className="lr-title" style={{ marginBottom: 8 }}><Icon name="branch" size={14} style={{ color: locks.length ? "#e8a14e" : "var(--accent)" }} /> {t("kb.locks")}</div>
        {locks.length === 0
          ? <div className="muted">{t("kb.locksEmpty")}</div>
          : <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>{locks.map((l, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                <Icon name="branch" size={11} style={{ color: "#e8a14e" }} />
                <span style={{ fontFamily: "var(--font-mono, monospace)" }}>{l.path}</span>
                {l.agentHandle && <span className="muted">· @{l.agentHandle}</span>}
              </div>
            ))}</div>}
      </div>

      {/* Knowledge by type */}
      <div className="card" style={{ marginTop: 12 }}>
        <div className="lr-title" style={{ marginBottom: 10 }}><Icon name="grid" size={14} style={{ color: "var(--accent)" }} /> {t("kb.byType")}</div>
        {o.byType.length === 0 && <div className="muted">{t("kb.byTypeEmpty")}</div>}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(120px,1fr) 60px 1fr", gap: "6px 14px", alignItems: "center" }}>
          {o.byType.map((ty) => (
            <div key={ty.type} style={{ display: "contents" }}>
              <div style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 13 }}>{ty.type}</div>
              <div className="muted" style={{ fontSize: 12, textAlign: "right" }}>{ty.active}/{ty.total}</div>
              <Bar frac={ty.total ? ty.active / ty.total : 0} />
            </div>
          ))}
        </div>
      </div>

      {/* Goal ↔ Spec ↔ Issue ↔ file relations */}
      <div className="card" style={{ marginTop: 12 }}>
        <div className="lr-title" style={{ marginBottom: 10 }}><Icon name="branch" size={14} style={{ color: "var(--accent)" }} /> {t("kb.relations")}</div>
        {o.goals.length === 0 && <div className="muted">{t("kb.noGoals")}</div>}
        {o.goals.map((g) => (
          <div key={g.id} className="lrow" style={{ alignItems: "center" }}>
            <span style={{ width: 8, height: 8, borderRadius: 8, background: STATUS_COLOR[g.status] ?? "#828aa3", flex: "0 0 8px" }} />
            <div className="lr-main">
              <div className="lr-title">{g.title}</div>
              <div className="lr-sub">{g.status}</div>
            </div>
            <div className="muted" style={{ fontSize: 12, display: "flex", gap: 12, whiteSpace: "nowrap" }}>
              <span>{g.specs} spec</span><span>{g.issues} issue</span><span>{g.files} {t("kb.fileUnit")}</span><span style={{ color: "var(--accent)" }}>{g.entries} kb</span>
            </div>
          </div>
        ))}
      </div>

      {/* Coverage gaps */}
      <div className="card" style={{ marginTop: 12 }}>
        <div className="lr-title" style={{ marginBottom: 8 }}><Icon name="warn" size={14} style={{ color: o.gaps.length ? "#e8a14e" : "var(--accent)" }} /> {t("kb.gaps")}</div>
        {o.gaps.length === 0 ? (
          <div className="muted">{t("kb.gapsEmpty")}</div>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18 }}>{o.gaps.map((g, i) => <li key={i} style={{ fontSize: 13, margin: "2px 0" }}>{g}</li>)}</ul>
        )}
      </div>

      {/* Agent recall history */}
      <div className="card" style={{ marginTop: 12 }}>
        <div className="lr-title" style={{ marginBottom: 10 }}><Icon name="search" size={14} style={{ color: "var(--accent)" }} /> {t("kb.queries")}</div>
        {o.queries.length === 0 && <div className="muted">{t("kb.queriesEmpty")}</div>}
        {o.queries.map((q, i) => (
          <div key={i} className="lrow" style={{ alignItems: "flex-start" }}>
            <div className="lr-main">
              <div className="lr-title" style={{ fontWeight: 500 }}>{q.query || t("kb.emptyQuery")}</div>
              <div className="lr-sub">
                {q.agentHandle ? `@${q.agentHandle} · ` : ""}{t("kb.hits", { n: q.hits })} · {q.mode || t("common.none")}
                {q.refs.length ? ` · ${q.refs.slice(0, 4).join(", ")}` : ""}
                {q.answeredAt ? ` · ${timeAgo(new Date(q.answeredAt))}` : ""}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Canonical synced blocks */}
      <BlocksPanel blocks={blocks} proposals={proposals} />

    </ViewShell>
  );
}
