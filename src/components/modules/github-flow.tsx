"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { Avatar } from "@/components/ui/avatar";
import { FileGlyph } from "@/components/ui/file-glyph";
import { timeAgo } from "@/lib/timeago";
import { connectGitHub, disconnectGitHub, commitPush, draftCommitMessage, listRepos, createRepo, setRepo, refreshGitStatus, scanWorkspace } from "@/server/github";
import type { PushResult } from "@/server/github";
import type { SecretFinding } from "@/server/git-scan";
import { signIn } from "@/lib/auth-client";
import { useT } from "@/lib/i18n-context";

/** Pick an existing repo (live from the GitHub API) or create a new one → sets git `origin`. */
function RepoBar({ current }: { current: string }) {
  const [open, setOpen] = useState<false | "pick" | "new">(false);
  const [repos, setRepos] = useState<{ full: string; private: boolean }[] | null>(null);
  const [q, setQ] = useState("");
  const [newName, setNewName] = useState("");
  const [priv, setPriv] = useState(true);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const t = useT();

  function openPick() { setOpen("pick"); setErr(""); setRepos(null); start(async () => { const r = await listRepos(); if (r.ok) setRepos(r.repos!.map((x) => ({ full: x.full, private: x.private }))); else setErr(r.error ?? t("github.repo.listError")); }); }
  function pick(full: string) { start(async () => { const r = await setRepo(full); if (!r.ok) { setErr(r.error ?? ""); return; } setOpen(false); router.refresh(); }); }
  function create() { setErr(""); if (!newName.trim()) return; start(async () => { const r = await createRepo({ name: newName, private: priv }); if (!r.ok) { setErr(r.error ?? ""); return; } setOpen(false); setNewName(""); router.refresh(); }); }

  const shown = (repos ?? []).filter((r) => !q.trim() || r.full.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div className="detail-label" style={{ margin: 0, flex: 1 }}>{t("github.repo.label")}</div>
        <button className="link-btn" onClick={openPick} disabled={pending}><Icon name="git" size={12} /> {current ? t("github.repo.change") : t("common.select")}</button>
        <button className="link-btn" onClick={() => { setOpen("new"); setErr(""); }} disabled={pending}><Icon name="add" size={12} /> {t("github.repo.new")}</button>
      </div>
      <div style={{ fontFamily: "var(--mono-font)", fontSize: 12.5, color: current ? "var(--accent)" : "var(--text-faint)", marginTop: 4 }}>{current || t("github.repo.noOrigin")}</div>

      {open === "pick" && (
        <div style={{ marginTop: 10 }}>
          <div className="dm-search" style={{ marginBottom: 8 }}><Icon name="search" size={13} /><input placeholder={t("github.repo.filterPlaceholder")} value={q} onChange={(e) => setQ(e.target.value)} autoFocus /></div>
          {repos === null && <div className="muted" style={{ fontSize: 12 }}><span className="spin"><Icon name="refresh" size={12} /></span> {t("github.repo.loading")}</div>}
          {err && <div className="form-hint" style={{ color: "var(--sx-number)" }}><Icon name="close" size={12} /> {err}</div>}
          <div className="scroll" style={{ maxHeight: 220, overflowY: "auto" }}>
            {shown.map((r) => (
              <button key={r.full} className="lrow" style={{ width: "100%", cursor: "pointer" }} disabled={pending} onClick={() => pick(r.full)}>
                <Icon name="git" size={14} style={{ color: "var(--text-faint)" }} />
                <span className="lr-main"><span className="lr-title" style={{ fontFamily: "var(--mono-font)", fontSize: 12.5 }}>{r.full}</span></span>
                <span className="pill" style={{ fontSize: 10 }}>{r.private ? t("github.repo.private") : t("github.repo.public")}</span>
              </button>
            ))}
            {repos !== null && shown.length === 0 && <div className="muted" style={{ fontSize: 12, padding: 8 }}>{t("github.repo.noRepos")}</div>}
          </div>
        </div>
      )}

      {open === "new" && (
        <div style={{ marginTop: 10 }}>
          <input className="form-input mono" placeholder="new-repo-name" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 12.5, color: "var(--text-dim)" }}>
            <input type="checkbox" checked={priv} onChange={(e) => setPriv(e.target.checked)} /> {t("github.repo.privateRepo")}
          </label>
          {err && <div className="form-hint" style={{ color: "var(--sx-number)" }}><Icon name="close" size={12} /> {err}</div>}
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button className="btn-accent" onClick={create} disabled={pending || !newName.trim()}>{pending ? t("github.repo.creating") : t("github.repo.createSetOrigin")}</button>
            <button className="btn-ghost" onClick={() => setOpen(false)}>{t("common.cancel")}</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Re-scan the working tree (git status) → updates the change set. */
function RefreshStatus() {
  const [pending, start] = useTransition();
  const router = useRouter();
  const t = useT();
  return <button className="link-btn" disabled={pending} onClick={() => start(async () => { await refreshGitStatus(); router.refresh(); })}>{pending ? <span className="spin"><Icon name="refresh" size={12} /></span> : <Icon name="refresh" size={12} />} {t("github.refreshChanges")}</button>;
}

type Change = { path: string; st: string; name: string };
type Repo = { full: string; name: string; branch: string };
type Deploy = { id: string; text: string; detail: string; at: Date };
type Assistant = { name: string; color: string; health: "alive" | "stale" | "down"; role: string } | null;

export function GitHubFlow({
  linked,
  repo,
  changes,
  deploys,
  assistant,
  oauthAvailable,
}: {
  linked: boolean;
  repo: Repo;
  changes: Change[];
  deploys: Deploy[];
  assistant: Assistant;
  oauthAvailable: boolean;
}) {
  const [authTab, setAuthTab] = useState<"oauth" | "token">(oauthAvailable ? "oauth" : "token");
  const [token, setToken] = useState("");
  const [tokenErr, setTokenErr] = useState("");
  const [msg, setMsg] = useState("");
  const [gen, setGen] = useState(false);
  const [byAgent, setByAgent] = useState(false);
  const [phase, setPhase] = useState<"idle" | "committing" | "pushing" | "done">("idle");
  const [outcome, setOutcome] = useState<PushResult | null>(null);
  const [pending, start] = useTransition();
  const t = useT();

  function connectToken() {
    if (token.length < 7) return;
    setTokenErr("");
    start(async () => {
      const r = await connectGitHub(token);
      if (!r.ok) setTokenErr(r.error ?? t("github.connectError"));
    });
  }

  function disconnect() {
    start(async () => {
      await disconnectGitHub();
    });
  }

  function generate() {
    setGen(true);
    start(async () => {
      const r = await draftCommitMessage();
      if (r.ok) setMsg(r.message);
      setGen(false);
    });
  }

  function commitPushFlow(agent: boolean, force = false) {
    setByAgent(agent);
    setPhase("committing");
    start(async () => {
      setPhase("pushing");
      const r = await commitPush({
        repo: repo.full,
        branch: repo.branch,
        message: msg || "chore: sync workspace to remote",
        delegated: agent,
        force,
      });
      setOutcome(r);
      setPhase("done");
      // Keep a BLOCKED result on screen (operator must fix or override); auto-reset only on success.
      if (!r.blocked) setTimeout(() => { setPhase("idle"); setMsg(""); setByAgent(false); setOutcome(null); }, 3800);
    });
  }
  const [scan, setScan] = useState<{ findings: SecretFinding[]; scanned: number } | null>(null);
  function runScan() { setScan(null); start(async () => { const r = await scanWorkspace(); setScan({ findings: r.findings, scanned: r.scanned }); }); }
  const [showChanges, setShowChanges] = useState(true);

  // ---- Not linked: auth card -----------------------------------------------
  if (!linked) {
    return (
      <div className="card">
        <div className="gh-auth-tabs">
          <button
            className={"seg-opt" + (authTab === "oauth" ? " on" : "")}
            onClick={() => setAuthTab("oauth")}
            style={{ flex: "none", padding: "7px 14px" }}
          >
            {t("github.auth.githubLogin")}
          </button>
          <button
            className={"seg-opt" + (authTab === "token" ? " on" : "")}
            onClick={() => setAuthTab("token")}
            style={{ flex: "none", padding: "7px 14px" }}
          >
            {t("github.auth.personalToken")}
          </button>
        </div>
        {authTab === "oauth" ? (
          <>
            <button
              className="oauth-btn"
              disabled={!oauthAvailable || pending}
              onClick={() => oauthAvailable && signIn.social({ provider: "github", callbackURL: "/github" })}
            >
              <Icon name="git" size={15} />
              {t("github.auth.signInWithGithub")}
            </button>
            <div className="form-hint" style={{ marginTop: 8 }}>
              {oauthAvailable ? (
                <>{t("github.auth.authorizeHint")}</>
              ) : (
                <><Icon name="shield" size={12} /> {t("github.auth.oauthNotConfigured")}</>
              )}
            </div>
          </>
        ) : (
          <div className="form-field">
            <label className="form-label">{t("github.auth.patLabel")}</label>
            <input
              className="form-input mono"
              type="password"
              placeholder="ghp_…"
              value={token}
              onChange={(e) => { setToken(e.target.value); setTokenErr(""); }}
            />
            <div className="form-hint">
              <Icon name="shield" size={12} /> {t("github.auth.patHint")}
            </div>
            {tokenErr && <div className="form-hint" style={{ color: "var(--sx-number)" }}><Icon name="close" size={12} /> {tokenErr}</div>}
            <button
              className="btn-accent"
              style={{ marginTop: 10 }}
              onClick={connectToken}
              disabled={token.length < 7 || pending}
            >
              {pending ? <span className="spin"><Icon name="refresh" size={13} /></span> : <Icon name="git" size={13} />}
              {pending ? t("github.auth.verifying") : t("common.connect")}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ---- Linked: commit flow against the real workspace change set -----------
  return (
    <>
      <button className="link-btn" style={{ marginBottom: 10 }} onClick={disconnect} disabled={pending}>
        <Icon name="settings" size={12} /> {t("github.disconnect")}
      </button>

      {/* repository picker (live from the GitHub API) → sets git origin */}
      <RepoBar current={repo.full} />

      {/* flow */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="detail-label">{t("github.flow.title")}</div>
        <div className="gh-flow">
          <div className="gf-node"><div className="gf-t">{t("github.flow.workspace")}</div><div className="gf-s">{changes.length} {t(changes.length === 1 ? "github.flow.change.one" : "github.flow.change.other")}</div></div>
          <span className="gf-arrow"><Icon name="chevronRight" size={18} /></span>
          <div className="gf-node"><div className="gf-t">{t("github.flow.commit")}</div><div className="gf-s">{repo.branch}</div></div>
          <span className="gf-arrow"><Icon name="chevronRight" size={18} /></span>
          <div className="gf-node"><div className="gf-t">origin</div><div className="gf-s">github.com</div></div>
        </div>
      </div>

      {/* changes */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <button onClick={() => setShowChanges((v) => !v)} style={{ flex: 1, display: "flex", alignItems: "center", gap: 7, background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}>
            <Icon name="chevronDown" size={13} style={{ color: "var(--text-dim)", transform: showChanges ? "none" : "rotate(-90deg)", transition: "transform .15s" }} />
            <span className="detail-label" style={{ margin: 0 }}>{t("github.changes.title")}</span>
            {changes.length > 0 && <span className="pill" style={{ fontSize: 10 }}>{changes.length}</span>}
          </button>
          <RefreshStatus />
        </div>
        {showChanges && (changes.length === 0 ? (
          <div className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>{t("github.changes.clean")}</div>
        ) : (
          <div className="scroll" style={{ maxHeight: 340, marginTop: 6, overflowY: "auto" }}>
            {changes.map((c) => (
              <div className="gh-stat" key={c.path}>
                <FileGlyph name={c.name} />
                <span className="gs-file">{c.path}</span>
                <span className={"gstat " + c.st} style={{ fontFamily: "var(--mono-font)", fontWeight: 700 }}>{c.st}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* commit */}
      <div className="card">
        <div className="detail-label">{t("github.commit.message")}</div>
        <textarea
          className="persona-ta mono"
          rows={3}
          placeholder={t("github.commit.placeholder")}
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
        />
        <button className="assist-btn" onClick={generate} disabled={gen || changes.length === 0} style={{ marginTop: 8 }}>
          {gen ? <span className="spin"><Icon name="refresh" size={13} /></span> : <Icon name="skill" size={13} />}
          {gen ? t("github.commit.drafting") : t("github.commit.generate")}
        </button>

        {phase === "idle" ? (
          <>
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button className="btn-accent" onClick={() => commitPushFlow(false)} disabled={!msg.trim() || changes.length === 0}>
                <Icon name="arrowUp" size={14} /> {t("github.commit.commitPush")}
              </button>
              <button className="btn-ghost" onClick={runScan} disabled={changes.length === 0}><Icon name="shield" size={13} /> {t("github.commit.securityScan")}</button>
            </div>
            {scan && (
              <div className="card" style={{ marginTop: 10, borderColor: scan.findings.length ? "color-mix(in srgb, var(--sx-keyword) 45%, var(--border))" : undefined }}>
                {scan.findings.length === 0
                  ? <div style={{ fontSize: 12.5, color: "var(--sx-string)" }}><Icon name="check" size={13} /> {t("github.scan.clean", { n: scan.scanned })}</div>
                  : <>
                      <div style={{ fontSize: 12.5, color: "var(--sx-keyword)", fontWeight: 700, marginBottom: 6 }}><Icon name="shield" size={13} /> {t("github.scan.risks", { n: scan.findings.length })}</div>
                      {scan.findings.slice(0, 30).map((f, i) => (
                        <div key={i} style={{ fontSize: 11.5, fontFamily: "var(--mono-font)", color: "var(--text-dim)", display: "flex", gap: 8 }}>
                          <span style={{ color: "var(--sx-keyword)" }}>{f.kind}</span><span style={{ flex: 1 }}>{f.file}{f.line ? ":" + f.line : ""}</span><span style={{ color: "var(--text-faint)" }}>{f.preview}</span>
                        </div>
                      ))}
                    </>}
              </div>
            )}
          </>
        ) : (
          <div style={{ marginTop: 14 }}>
            {(() => {
              const doneLabel = outcome
                ? outcome.pushed
                  ? `${t("github.progress.pushed", { branch: repo.branch })}${outcome.prUrl ? (byAgent ? ` · ${t("github.progress.agentOpenedPr", { name: assistant?.name ?? t("github.progress.agent") })}` : ` · ${t("github.progress.prOpened")}`) : ""}`
                  : outcome.committed
                    ? `${t("github.progress.committedLocal")}${outcome.sha ? ` (${outcome.sha})` : ""}${t("github.progress.notPushedSuffix")}`
                    : outcome.nothing ? t("github.progress.nothing") : t("github.progress.failed")
                : t("github.progress.finishing");
              const failed = phase === "done" && outcome != null && !outcome.ok;
              const steps: [string, string][] = [
                ["committing", t("github.progress.committing", { n: changes.length })],
                ["pushing", t("github.progress.pushing", { branch: repo.branch })],
                ["done", doneLabel],
              ];
              const order = ["committing", "pushing", "done"];
              const cur = order.indexOf(phase);
              return steps.map(([k, label]) => {
                const mine = order.indexOf(k);
                const st = (mine < cur || (phase === "done" && k === "done")) ? "done" : mine === cur ? "on" : "";
                const isDoneFail = k === "done" && failed;
                return (
                  <div className={"gh-progress-step " + (isDoneFail ? "" : st)} key={k}>
                    <span className="gp-ico">
                      {isDoneFail ? <Icon name="close" size={13} /> : st === "done" ? <Icon name="check" size={14} /> : st === "on" ? <span className="spin"><Icon name="refresh" size={13} /></span> : <Icon name="dot" size={8} />}
                    </span>
                    {label}
                  </div>
                );
              });
            })()}
            {outcome?.error && <div className="form-hint" style={{ marginTop: 8, color: "var(--sx-number)" }}><Icon name="shield" size={12} /> {outcome.error}</div>}
            {outcome?.blocked && outcome.secrets && outcome.secrets.length > 0 && (
              <div className="card" style={{ marginTop: 10, borderColor: "color-mix(in srgb, var(--sx-keyword) 45%, var(--border))" }}>
                {outcome.secrets.slice(0, 30).map((f, i) => (
                  <div key={i} style={{ fontSize: 11.5, fontFamily: "var(--mono-font)", color: "var(--text-dim)", display: "flex", gap: 8 }}>
                    <span style={{ color: "var(--sx-keyword)" }}>{f.kind}</span><span style={{ flex: 1 }}>{f.file}{f.line ? ":" + f.line : ""}</span><span style={{ color: "var(--text-faint)" }}>{f.preview}</span>
                  </div>
                ))}
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button className="btn-ghost" onClick={() => { setPhase("idle"); setOutcome(null); }}>{t("github.blocked.fixRetry")}</button>
                  <button className="btn-accent" style={{ background: "var(--sx-keyword)" }} onClick={() => { if (confirm(t("github.blocked.confirm"))) commitPushFlow(byAgent, true); }}>{t("github.blocked.commitAnyway")}</button>
                </div>
              </div>
            )}
            {outcome?.blocked && (!outcome.secrets || outcome.secrets.length === 0) && (
              <button className="btn-ghost" style={{ marginTop: 8 }} onClick={() => { setPhase("idle"); setOutcome(null); }}>{t("github.blocked.ok")}</button>
            )}
            {outcome?.prUrl && <a className="link-btn" href={outcome.prUrl} target="_blank" rel="noreferrer" style={{ marginTop: 8, display: "inline-flex" }}><Icon name="git" size={12} /> {t("github.viewPr")}</a>}
          </div>
        )}

        {/* agent does it */}
        {phase === "idle" && assistant && (
          <div className="agent-do">
            <Avatar name={assistant.name} color={assistant.color} size={30} health={assistant.health} />
            <div style={{ flex: 1 }}>
              <div className="sr-title">{t("github.delegate.title")}</div>
              <div className="sr-sub">{t("github.delegate.sub", { name: assistant.name })}</div>
            </div>
            <button
              className="btn-ghost"
              onClick={() => { setMsg(msg || "chore: sync workspace to remote"); commitPushFlow(true); }}
              disabled={changes.length === 0}
            >
              <Icon name="bot" size={13} /> {t("github.delegate.button")}
            </button>
          </div>
        )}
      </div>

      {/* real push history */}
      {deploys.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="detail-label">{t("github.recentPushes")}</div>
          <div className="scroll" style={{ maxHeight: 260, overflowY: "auto" }}>
            {deploys.map((d) => (
              <div className="gh-stat" key={d.id}>
                <Icon name="git" size={13} style={{ color: "var(--text-faint)" }} />
                <span className="gs-file" style={{ fontFamily: "var(--ui-font)" }}>{d.text}</span>
                <span style={{ fontSize: 11, color: "var(--text-faint)" }}>{timeAgo(d.at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
