"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeOnboarding, operatorHasOrg } from "@/server/onboarding";
import { isSkipDir, isTextFile } from "@/data/import-skip";
import { githubReposForToken, type GhRepo } from "@/server/github";
import { detectProviders, testConnection, checkSetupEnv, checkAdapter, probeModel, type DetectedProvider } from "@/server/onboarding-detect";
import { PROVIDER_CATALOG } from "@/data/providers-catalog";
import { STACK_CATS, descFor } from "@/data/stack-catalog";
import { iconUrl } from "@/data/stack-icons";
import { incompat, stackNote, reconcileStack } from "@/lib/stack-compat";
import { toggleStack, hasStack } from "@/lib/stack-multi";
import { ConstellaMark } from "@/components/ui/constella-mark";
import { Icon } from "@/components/ui/icon";
import { Dropdown } from "@/components/ui/dropdown";
import { ProviderGlyph } from "@/components/ui/provider-glyph";
import { useT } from "@/lib/i18n-context";

// Stable step keys — labels are translated at the render site (StepDots).
const STEP_KEYS = ["company", "ceoModel", "connection", "stack", "brief"] as const;

/** Devicon icon for a stack option, falling back to a 2-letter monospace badge when there's no
 *  mapped icon or the CDN SVG fails to load (offline / 404). */
function StackGlyph({ name }: { name: string }) {
  const url = iconUrl(name);
  const [failed, setFailed] = useState(false);
  if (!url || failed) return <span className="sc-mono">{name.replace(/[^A-Za-z0-9]/g, "").slice(0, 2)}</span>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="sc-ico" src={url} alt="" loading="lazy" onError={() => setFailed(true)} />;
}

/** Searchable combobox: type to find any technology across all categories and select it directly
 *  (the big cards below remain the visual browse-and-pick surface). */
function StackSearch({ stack, onPick, query, setQuery }: {
  stack: Record<string, string>;
  onPick: (catKey: string, opt: string) => void;
  query: string; setQuery: (v: string) => void;
}) {
  const t = useT();
  const f = query.trim().toLowerCase();
  const results = f
    ? STACK_CATS.flatMap((cat) =>
        cat.opts
          .filter((o) => o !== "None" && (o.toLowerCase().includes(f) || cat.label.toLowerCase().includes(f)))
          .map((o) => ({ cat, o, bad: incompat(stack, cat.key, o) })))
        .slice(0, 16)
    : [];
  return (
    <div className="stack-search-wrap">
      <div className="stack-search">
        <Icon name="search" size={15} />
        <input placeholder={t("onboarding.stackSearchPh")} value={query} onChange={(e) => setQuery(e.target.value)} />
        {query && <button className="ss-clear" onClick={() => setQuery("")}><Icon name="close" size={13} /></button>}
      </div>
      {f && results.length > 0 && (
        <div className="stack-find scroll">
          {results.map(({ cat, o, bad }) => (
            <button type="button" key={cat.key + o} className={"stack-find-row" + (bad ? " disabled" : "")} disabled={!!bad}
              title={bad ? bad : descFor(cat.key, o)}
              onClick={() => { if (!bad) onPick(cat.key, o); }}>
              <StackGlyph name={o} />
              <span className="sf-name">{o}</span>
              <span className="sf-cat">{cat.label}</span>
              {hasStack(stack[cat.key], o) && <Icon name="check" size={13} />}
            </button>
          ))}
        </div>
      )}
      {f && results.length === 0 && <div className="stack-find sf-empty">{t("onboarding.stackNoMatch", { query })}</div>}
    </div>
  );
}

function StepDots({ step }: { step: number }) {
  const t = useT();
  return (
    <div className="onb-steps">
      {STEP_KEYS.map((k, i) => (
        <span key={k} style={{ display: "contents" }}>
          {i > 0 && <span className="onb-sep" />}
          <div className={"onb-stepdot" + (step === i ? " on" : step > i ? " done" : "")}>
            <span className="num">{step > i ? "✓" : i + 1}</span><span>{t(`onboarding.step.${k}`)}</span>
          </div>
        </span>
      ))}
    </div>
  );
}

function ConnectionTest({ adapter, model, cached, onDone }: { adapter: string; model: string; cached: boolean; onDone: (ok: boolean) => void }) {
  const t = useT();
  const STEPS = [
    { t: t("onboarding.test.prepare"), d: t("onboarding.test.prepareDesc") },
    { t: t("onboarding.test.adapter"), d: t("onboarding.test.adapterDesc", { adapter }) },
    { t: t("onboarding.test.connection"), d: t("onboarding.test.connectionDesc") },
    { t: t("onboarding.test.model", { model }), d: t("onboarding.test.modelDesc") },
    { t: t("onboarding.test.ready"), d: t("onboarding.test.readyDesc") },
  ];
  const [cur, setCur] = useState(cached ? STEPS.length : 0);
  const [failIdx, setFailIdx] = useState<number | null>(null);
  const [failMsg, setFailMsg] = useState<string | null>(null);

  useEffect(() => {
    if (cached) { setCur(STEPS.length); return; } // already verified for this provider+model — no re-run
    let alive = true;
    setFailIdx(null); setFailMsg(null);
    (async () => {
      // Each step is a REAL check (no fake timers): env → adapter → connection → model.
      const checks: Array<() => Promise<{ ok: boolean; error?: string }>> = [
        () => checkSetupEnv(),
        () => checkAdapter(adapter),
        () => testConnection(adapter),
        () => probeModel(adapter, model),
      ];
      for (let i = 0; i < checks.length; i++) {
        if (!alive) return;
        setCur(i);
        const r = await checks[i]();
        if (!alive) return;
        if (!r.ok) { setFailIdx(i); setFailMsg(r.error ?? t("onboarding.test.failed")); onDone(false); return; }
        setCur(i + 1);
      }
      if (!alive) return;
      setCur(STEPS.length);
      onDone(true);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cached]);

  return (
    <div className="track">
      {STEPS.map((s, i) => {
        const isFail = failIdx === i;
        const state = isFail ? "" : i < cur ? "done" : i === cur ? "on" : "todo";
        return (
          <div className={"track-step " + state} key={i}>
            <div className="track-ico">{isFail ? <Icon name="close" size={15} /> : state === "done" ? <Icon name="check" size={16} /> : state === "on" ? <span className="spin"><Icon name="refresh" size={15} /></span> : <Icon name="dot" size={8} />}</div>
            <div className="track-main"><div className="track-t">{s.t}</div><div className="track-d">{isFail ? failMsg : s.d}</div></div>
          </div>
        );
      })}
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const t = useT();
  const [step, setStep] = useState(0);
  const [canClose, setCanClose] = useState(false);
  useEffect(() => { operatorHasOrg().then(setCanClose).catch(() => {}); }, []);
  const [company, setCompany] = useState("");
  const [mission, setMission] = useState("");
  const [objective, setObjective] = useState("");
  const [providers, setProviders] = useState<DetectedProvider[]>([]);
  const [selId, setSelId] = useState("");
  const [model, setModel] = useState("");
  // Nothing is auto-selected — the operator chooses each category manually (or leaves it as "None").
  const [stack, setStack] = useState<Record<string, string>>({});
  const [stackQ, setStackQ] = useState("");
  const [stackMsg, setStackMsg] = useState(""); // explains options auto-deselected for becoming incompatible
  const [sys, setSys] = useState("You are Ada, the CEO of this company. Plan before building: analyse the brief, design the architecture and rituals, then organise the team.");
  const [briefName, setBriefName] = useState("");
  const [briefText, setBriefText] = useState("");
  const [mockFiles, setMockFiles] = useState<{ path: string; content: string }[]>([]);
  const [tested, setTested] = useState(false);
  // Remember WHICH adapter+model was verified, so going Back→Continue doesn't re-run the checks
  // (only a real change of provider/model re-verifies).
  const [testedKey, setTestedKey] = useState("");
  // Project source (import an existing project): "new" scaffolds a starter; github clones a repo;
  // local copies a directory. github/local/mock all suppress the deterministic starter.
  const [sourceType, setSourceType] = useState<"new" | "github" | "local">("new");
  const [pat, setPat] = useState(""); const [ghLogin, setGhLogin] = useState("");
  const [repos, setRepos] = useState<GhRepo[]>([]); const [repoFull, setRepoFull] = useState("");
  const [srcBusy, setSrcBusy] = useState(false); const [srcErr, setSrcErr] = useState("");
  // Local import = the operator picks a folder; the browser filters + reads its text source files here.
  const [localFiles, setLocalFiles] = useState<{ path: string; content: string }[]>([]);
  const [localRoot, setLocalRoot] = useState(""); const [localStack, setLocalStack] = useState("");
  const [localBusy, setLocalBusy] = useState(false); const [localPct, setLocalPct] = useState(0);
  const [handPct, setHandPct] = useState(0); // handoff (import + setup) progress while completeOnboarding runs
  const [finishErr, setFinishErr] = useState(""); // surfaced if completeOnboarding fails (no more silent stall)
  // True once handoff succeeds and we kick the redirect. `pending` (useTransition) settles BEFORE the slow
  // navigation to /planner finishes, which would re-enable the button + reset the bar — letting the operator
  // double-submit (a second workspace) while the page is already leaving. `done` keeps the foot locked.
  const [done, setDone] = useState(false);

  async function listGhRepos() {
    setSrcBusy(true); setSrcErr("");
    try {
      const r = await githubReposForToken(pat);
      if (!r.ok) { setSrcErr(r.error ?? t("onboarding.src.listReposFailed")); setRepos([]); return; }
      setGhLogin(r.login ?? ""); setRepos(r.repos ?? []);
      if (r.repos?.[0]) setRepoFull(r.repos[0].full);
    } finally { setSrcBusy(false); }
  }
  function detectStackClient(paths: string[]): string {
    const has = (re: RegExp) => paths.some((p) => re.test(p));
    if (has(/(^|\/)manage\.py$/)) return "Django (Python)";
    if (has(/(^|\/)next\.config\.(js|mjs|ts)$/)) return "Next.js";
    if (has(/\.vue$/)) return "Vue";
    if (has(/(^|\/)go\.mod$/)) return "Go";
    if (has(/(^|\/)Cargo\.toml$/i)) return "Rust";
    if (has(/(^|\/)pom\.xml$/) || has(/(^|\/)build\.gradle/)) return "JVM";
    if (has(/(^|\/)composer\.json$/)) return "PHP";
    if (has(/\.py$/)) return "Python";
    if (has(/(^|\/)package\.json$/)) return "Node";
    return "";
  }
  /** Folder picker → filter (skip dep/build dirs, binaries, oversize) → read text files with a % bar. */
  async function onPickProjectFolder(files: FileList | null) {
    if (!files || !files.length) return;
    setLocalBusy(true); setLocalPct(0); setSrcErr(""); setLocalFiles([]); setLocalStack("");
    const all = Array.from(files);
    const root = (all[0].webkitRelativePath || all[0].name).split("/")[0] || "project";
    const cand = all.filter((f) => {
      const segs = (f.webkitRelativePath || f.name).split("/");
      for (let i = 1; i < segs.length - 1; i++) if (isSkipDir(segs[i])) return false; // any dep/build dir segment
      const base = segs[segs.length - 1];
      if (/^\.env(\.local|\.development|\.production)?$/i.test(base) || base === ".DS_Store") return false;
      if (!isTextFile(base)) return false;
      if (f.size > 512 * 1024) return false;
      return true;
    });
    if (!cand.length) { setLocalBusy(false); setSrcErr(t("onboarding.src.noFiles")); return; }
    const out: { path: string; content: string }[] = [];
    for (let i = 0; i < cand.length; i++) {
      const f = cand[i];
      const rel = (f.webkitRelativePath || f.name).split("/").slice(1).join("/"); // strip the picked root folder
      if (rel) { try { out.push({ path: rel, content: await f.text() }); } catch { /* skip unreadable */ } }
      if (i % 5 === 0 || i === cand.length - 1) setLocalPct(Math.round(((i + 1) / cand.length) * 100));
    }
    setLocalFiles(out); setLocalRoot(root); setLocalStack(detectStackClient(out.map((o) => o.path))); setLocalBusy(false);
  }
  const branchFor = (full: string) => repos.find((r) => r.full === full)?.branch;
  const sourceReady = sourceType === "new" || (sourceType === "github" && !!repoFull) || (sourceType === "local" && localFiles.length > 0);

  async function onPickMock(files: FileList | null) {
    if (!files) return;
    const TEXT = /\.(html?|css|jsx?|tsx?|md|txt|json|svg)$/i;
    const out: { path: string; content: string }[] = [];
    for (const f of Array.from(files).slice(0, 120)) {
      const path = ((f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name).replace(/^\/+/, "");
      if (!TEXT.test(path) || f.size > 262144) continue;
      try { out.push({ path, content: await f.text() }); } catch { /* skip unreadable */ }
    }
    setMockFiles(out);
  }
  const [regOpen, setRegOpen] = useState(false);
  const [regId, setRegId] = useState("");
  const [regKey, setRegKey] = useState("");
  const [regModel, setRegModel] = useState("");

  function registerProvider() {
    const cp = PROVIDER_CATALOG.find((p) => p.id === regId);
    if (!cp) return;
    const p: DetectedProvider = {
      id: cp.id, name: cp.displayName, adapter: cp.defaultAdapter,
      kind: cp.category === "cli" ? "cli" : cp.category === "local_runtime" ? "local" : "cloud",
      models: regModel.trim() ? [regModel.trim()] : [],
    };
    setProviders((prev) => (prev.find((x) => x.id === p.id) ? prev : [...prev, p]));
    setSelId(p.id); setModel(regModel.trim() || "");
    setRegOpen(false);
  }
  const [pending, start] = useTransition();

  useEffect(() => {
    detectProviders().then(({ detected }) => {
      setProviders(detected);
      if (detected[0]) { setSelId(detected[0].id); setModel(detected[0].models[0] ?? ""); }
    });
  }, []);

  // While "Hand off to Ada" runs (import + scaffold on the server), creep a progress bar so the operator
  // sees the project is being imported. It settles at ~92% until the redirect to /planner completes.
  useEffect(() => {
    if (done) { setHandPct(100); return; }       // handoff succeeded — pin the bar full through the redirect
    if (!pending) { setHandPct(0); return; }
    setHandPct(8);
    const id = setInterval(() => setHandPct((p) => (p < 92 ? p + Math.max(1, Math.round((92 - p) / 12)) : p)), 400);
    return () => clearInterval(id);
  }, [pending, done]);

  const sel = providers.find((p) => p.id === selId);
  const adapter = sel?.adapter ?? "";
  const setupKey = adapter + ":" + model;
  const verified = tested && testedKey === setupKey; // already-OK for this exact provider+model
  function selectProvider(p: DetectedProvider) { setSelId(p.id); setModel(p.models[0] ?? ""); }
  const note = stackNote(stack);
  // Toggle a stack pick, then RECONCILE: drop anything that just became incompatible so a blocked option
  // can never stay selected, and tell the operator what was auto-removed + why.
  function pickStack(catKey: string, opt: string) {
    const r = reconcileStack({ ...stack, [catKey]: toggleStack(stack[catKey], opt) });
    setStack(r.stack);
    setStackMsg(r.removed.map((x) => `${x.opt} was unselected automatically — ${x.reason}.`).join("  "));
  }

  function finish() {
    const source =
      sourceType === "github" ? { type: "github" as const, pat, repoFull, branch: branchFor(repoFull), login: ghLogin || undefined } :
      sourceType === "local" ? { type: "local" as const, rootName: localRoot, files: localFiles } :
      { type: "new" as const };
    setFinishErr("");
    start(async () => {
      try {
        const r = await completeOnboarding({ company, mission, objective, stack, provider: adapter, model, systemPrompt: sys, briefText, briefName, mockFiles, source, providerCatalogId: selId || undefined, providerKey: regId && regId === selId && regKey ? regKey : undefined });
        if (r && !r.ok) { setFinishErr(r.error || "Setup didn't complete — please try again."); return; }
        setDone(true); // lock the foot — the nav below is slow and `pending` is about to settle
        // HARD navigation (not router.push + router.refresh): the workspace was just created server-side, and a
        // client transition that also refreshes can stall on the push→refresh→redirect handshake — freezing the
        // operator on "Setting up… 100%" forever (the `pending` transition never settles). A full page load
        // re-runs requireWorkspace from scratch and lands on the Planner reliably.
        setHandPct(100);
        window.location.assign("/planner");
      } catch {
        // Action threw (e.g. a stale browser tab → "Failed to find Server Action") — surface it instead
        // of leaving the operator on a frozen 92% bar with no idea what happened.
        setFinishErr("Setup didn't complete — please try again. If it keeps failing, reload the page.");
      }
    });
  }

  return (
    <div className="onb">
      <div className="onb-top">
        <div className="onb-brand"><ConstellaMark size={34} rx={9} /><div className="bw">Constella</div></div>
        <StepDots step={step} />
        {/* Only offer Close once the user already has a workspace — a first-run user closing would
            just bounce back here (requireWorkspace → /onboarding). */}
        {canClose && <button className="onb-close" title={t("onboarding.closeSetup")} aria-label={t("onboarding.closeSetup")} onClick={() => router.push("/")}><Icon name="close" size={16} /></button>}
      </div>
      <div className="onb-body">
        <div className={"onb-card" + (step === 3 ? " onb-card-wide" : "")}>

          {step === 0 && <>
            <div className="onb-h">{t("onboarding.company.h")}</div>
            <div className="onb-sub" style={{ marginBottom: 14 }}>{t("onboarding.company.sub")}</div>
            <div className="persona-field"><label className="form-label">{t("onboarding.company.nameLabel")} <span className="req">*</span></label>
              <input className="form-input" required autoFocus value={company} onChange={(e) => setCompany(e.target.value)} placeholder={t("onboarding.company.namePh")} /></div>
            <div className="persona-field"><label className="form-label">{t("onboarding.company.missionLabel")} <span className="req">*</span></label>
              <textarea className="persona-ta" required value={mission} onChange={(e) => setMission(e.target.value)} placeholder={t("onboarding.company.missionPh")} /></div>
            <div className="persona-field"><label className="form-label">{t("onboarding.company.objectiveLabel")} <span className="req">*</span></label>
              <textarea className="persona-ta" required value={objective} onChange={(e) => setObjective(e.target.value)} placeholder={t("onboarding.company.objectivePh")} /></div>
            <div className="onb-foot"><button className="btn-accent" disabled={!company.trim() || !mission.trim() || !objective.trim()} onClick={() => setStep(1)}>{t("common.next")} <Icon name="chevronRight" size={13} /></button></div>
          </>}

          {step === 1 && <>
            <div className="onb-h">{t("onboarding.brain.h")}</div>
            <div className="onb-sub">{t("onboarding.brain.sub")}</div>
            <div className="onb-secrow"><span className="osr-t">{t("onboarding.brain.detected")}</span><span className="osr-line" /></div>
            <div className="prov-cards">
              {providers.map((p) => (
                <div key={p.id} className={"prov-card " + (p.kind === "local" ? "local-card" : "cloud-card") + (selId === p.id ? " on" : "")} onClick={() => selectProvider(p)}>
                  <span className="pc-badge">{t(`onboarding.kind.${p.kind}`)}</span>
                  <ProviderGlyph id={p.id} size={42} />
                  <div className="pc-name">{p.name}</div>
                  <div className="pc-sub">{p.adapter}</div>
                </div>
              ))}
              {providers.length === 0 && <div className="muted" style={{ fontSize: 12.5, padding: 12 }}>{t("onboarding.brain.detecting")}</div>}
            </div>
            <button className="btn-ghost" style={{ marginTop: 10 }} onClick={() => setRegOpen((v) => !v)}><Icon name="add" size={13} /> {t("onboarding.brain.registerToggle")}</button>
            {regOpen && (
              <div className="card" style={{ marginTop: 10 }}>
                <div className="detail-label">{t("onboarding.brain.registerTitle")}</div>
                <Dropdown value={regId} placeholder={t("onboarding.brain.chooseProvider")} options={PROVIDER_CATALOG.filter((p) => p.status !== "unsupported").map((p) => ({ value: p.id, label: p.displayName, glyphId: p.id }))} onChange={setRegId} glyph />
                <div className="set-grid" style={{ marginTop: 8 }}>
                  <input className="form-input mono" placeholder={t("onboarding.brain.modelIdPh")} value={regModel} onChange={(e) => setRegModel(e.target.value)} />
                  <input className="form-input mono" type="password" placeholder={t("onboarding.brain.apiKeyPh")} value={regKey} onChange={(e) => setRegKey(e.target.value)} />
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
                  <button className="btn-ghost" onClick={() => setRegOpen(false)}>{t("common.cancel")}</button>
                  <button className="btn-accent" disabled={!regId} onClick={registerProvider}><Icon name="check" size={13} /> {t("onboarding.brain.addSelect")}</button>
                </div>
              </div>
            )}
            {sel && <>
              <div className="onb-secrow"><span className="osr-t">{t("onboarding.brain.modelFor", { name: sel.name })}</span><span className="osr-line" /></div>
              <Dropdown mono value={model} options={sel.models.map((m) => ({ value: m, label: m }))} onChange={setModel} />
            </>}
            <div className="onb-foot">
              <button className="btn-ghost" onClick={() => setStep(0)}><Icon name="chevronLeft" size={13} /> {t("common.back")}</button>
              <button className="btn-accent" disabled={!sel || !model} onClick={() => setStep(2)}>{t("common.next")} <Icon name="chevronRight" size={13} /></button>
            </div>
          </>}

          {step === 2 && <>
            <div className="onb-h">{t("onboarding.setup.h")}</div>
            <div className="onb-sub">{t("onboarding.setup.sub")} <b style={{ color: "var(--text)" }}>{adapter}</b> · <b style={{ color: "var(--text)" }}>{model}</b>.</div>
            <ConnectionTest adapter={adapter} model={model} cached={verified} onDone={(ok) => { setTested(ok); setTestedKey(setupKey); }} />
            <div className="onb-foot">
              <button className="btn-ghost" onClick={() => setStep(1)}><Icon name="chevronLeft" size={13} /> {t("common.back")}</button>
              <button className="btn-accent" disabled={!verified} onClick={() => setStep(3)}>{verified ? <>{t("onboarding.setup.continue")} <Icon name="chevronRight" size={13} /></> : t("onboarding.setup.testing")}</button>
            </div>
          </>}

          {step === 3 && <>
            <div className="onb-h">{t("onboarding.stack.h")}</div>
            <div className="onb-sub">{t("onboarding.stack.sub")}</div>
            {note && <div className="modal-hint" style={{ color: "var(--sx-number)" }}><Icon name="pulse" size={12} /> {note}</div>}
            {stackMsg && <div className="modal-hint" style={{ color: "var(--sx-keyword)" }}><Icon name="warn" size={12} /> {stackMsg}</div>}
            <StackSearch stack={stack} onPick={pickStack} query={stackQ} setQuery={setStackQ} />
            {STACK_CATS.map((cat) => (
              <div className="stack-cat" key={cat.key}>
                <div className="onb-secrow"><span className="osr-t">{cat.label}</span><span className="osr-pick">{stack[cat.key] || "—"}</span><span className="osr-line" /></div>
                <div className="stack-cards">
                  {cat.opts.map((o) => {
                    const bad = incompat(stack, cat.key, o);
                    const on = hasStack(stack[cat.key], o);
                    return (
                      <button key={o} className={"stack-card" + (on ? " on" : "") + (bad ? " disabled" : "")} disabled={!!bad && !on} title={bad ? bad : descFor(cat.key, o)} onClick={() => !bad && pickStack(cat.key, o)}>
                        <StackGlyph name={o} />
                        <span className="sc-name">{o}</span>
                        {on && <span className="sc-check"><Icon name="check" size={12} /></span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="onb-foot">
              <button className="btn-ghost" onClick={() => setStep(2)}><Icon name="chevronLeft" size={13} /> {t("common.back")}</button>
              <button className="btn-accent" onClick={() => setStep(4)}>{t("common.next")} <Icon name="chevronRight" size={13} /></button>
            </div>
          </>}

          {step === 4 && <>
            <div className="onb-h">{t("onboarding.brief.h")}</div>
            <div className="onb-sub">{t("onboarding.brief.sub")}</div>

            <div className="persona-field">
              <label className="form-label">{t("onboarding.brief.sourceLabel")}</label>
              <div className="src-cards">
                {(["new", "github", "local"] as const).map((k) => (
                  <button key={k} type="button" className={"src-card" + (sourceType === k ? " on" : "")} onClick={() => { setSourceType(k); setSrcErr(""); }}>
                    <Icon name={k === "new" ? "add" : k === "github" ? "git" : "files"} size={18} />
                    <div className="src-t">{t(`onboarding.src.${k}.t`)}</div><div className="src-d">{t(`onboarding.src.${k}.d`)}</div>
                  </button>
                ))}
              </div>
              {sourceType === "github" && (
                <div className="card" style={{ marginTop: 10, display: "grid", gap: 8 }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input className="form-input mono" type="password" placeholder={t("onboarding.src.tokenPh")} value={pat} onChange={(e) => setPat(e.target.value)} />
                    <button className="btn-ghost" disabled={srcBusy || pat.trim().length < 7} onClick={listGhRepos}>{srcBusy ? "…" : t("onboarding.src.listRepos")}</button>
                  </div>
                  {repos.length > 0 && <>
                    <div className="form-hint">{ghLogin && <>{t("onboarding.src.signedInAs")} <b>{ghLogin}</b> · </>}{t("onboarding.src.pickRepo")}</div>
                    <Dropdown value={repoFull} options={repos.map((r) => ({ value: r.full, label: r.full, tag: r.private ? t("onboarding.src.private") : t("onboarding.src.public") }))} onChange={setRepoFull} />
                  </>}
                </div>
              )}
              {sourceType === "local" && (
                <div className="card" style={{ marginTop: 10, display: "grid", gap: 8 }}>
                  <label className="btn-ghost" style={{ cursor: localBusy ? "default" : "pointer", justifyContent: "center" }}>
                    <Icon name="grid" size={14} /> {localBusy ? t("onboarding.src.reading") : (localFiles.length > 0 ? t("onboarding.src.chooseAnother") : t("onboarding.src.chooseFolder"))}
                    {/* @ts-expect-error non-standard directory-picker attributes */}
                    <input type="file" hidden webkitdirectory="" directory="" multiple disabled={localBusy} onChange={(e) => onPickProjectFolder(e.target.files)} />
                  </label>
                  {localBusy && (
                    <div>
                      <div style={{ height: 6, borderRadius: 999, background: "var(--bg-active)", overflow: "hidden" }}><div style={{ height: "100%", width: localPct + "%", background: "var(--accent)", transition: "width .2s" }} /></div>
                      <div className="form-hint">{t("onboarding.src.readingPct", { pct: localPct })}</div>
                    </div>
                  )}
                  {!localBusy && localFiles.length > 0 && (
                    <div className="form-hint" style={{ color: "var(--sx-string)" }}>
                      <Icon name="check" size={12} /> {t(localFiles.length === 1 ? "onboarding.src.imported.one" : "onboarding.src.imported.other", { n: localFiles.length, name: localRoot })}{localStack && <> · <b style={{ color: "var(--text)" }}>{localStack}</b></>}
                    </div>
                  )}
                </div>
              )}
              {srcErr && <div style={{ fontSize: 11.5, color: "#e8688f", marginTop: 6 }}>{srcErr}</div>}
              <div className="form-hint"><Icon name="bot" size={12} /> {t("onboarding.src.analyseHint")}</div>
            </div>

            <div className="persona-field"><label className="form-label">{t("onboarding.brief.systemPrompt")} <span className="req">*</span></label>
              <textarea className="persona-ta mono" required value={sys} onChange={(e) => setSys(e.target.value)} /></div>
            <div className="persona-field"><label className="form-label">{t("onboarding.brief.projectBrief")} <span style={{ color: "var(--text-faint)", fontWeight: 400 }}>· {t("onboarding.brief.optional")}</span></label>
              <textarea className="persona-ta mono" style={{ minHeight: 110 }} placeholder={t("onboarding.brief.briefPh")} value={briefText} onChange={(e) => { setBriefText(e.target.value); if (!briefName && e.target.value) setBriefName("project-brief.md"); }} /></div>
            <div className="persona-field">
              <label className="form-label">{t("onboarding.brief.attachMock")} <span style={{ color: "var(--text-faint)", fontWeight: 400 }}>· {t("onboarding.brief.optional")} · HTML, CSS, JS, MD</span></label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <label className="btn-ghost" style={{ cursor: "pointer" }}>
                  <Icon name="doc" size={13} /> {t("onboarding.brief.files")}
                  <input type="file" multiple hidden onChange={(e) => onPickMock(e.target.files)} />
                </label>
                <label className="btn-ghost" style={{ cursor: "pointer" }}>
                  <Icon name="grid" size={13} /> {t("onboarding.brief.folder")}
                  {/* @ts-expect-error non-standard directory-picker attributes */}
                  <input type="file" hidden webkitdirectory="" directory="" multiple onChange={(e) => onPickMock(e.target.files)} />
                </label>
                {mockFiles.length > 0 && (
                  <span className="chip-sm" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <Icon name="check" size={12} /> {t(mockFiles.length === 1 ? "onboarding.brief.filesAttached.one" : "onboarding.brief.filesAttached.other", { n: mockFiles.length })}
                    <button className="link-btn" style={{ marginLeft: 4 }} onClick={() => setMockFiles([])}><Icon name="close" size={11} /></button>
                  </span>
                )}
              </div>
              <div className="form-hint"><Icon name="bot" size={12} /> {t("onboarding.brief.mockHintPre")} <span className="mono">mock/</span> {t("onboarding.brief.mockHintPost")}</div>
            </div>
            {(pending || done) && (
              <div style={{ marginTop: 12 }}>
                <div style={{ height: 6, borderRadius: 999, background: "var(--bg-active)", overflow: "hidden" }}><div style={{ height: "100%", width: handPct + "%", background: "var(--accent)", transition: "width .3s" }} /></div>
                <div className="form-hint">{t("onboarding.src.settingUp")} {handPct}%</div>
              </div>
            )}
            {finishErr && <div className="form-hint" style={{ color: "var(--sx-keyword)", marginTop: 10 }}><Icon name="close" size={12} /> {finishErr}</div>}
            <div className="onb-foot">
              <button className="btn-ghost" disabled={pending || done} onClick={() => setStep(3)}><Icon name="chevronLeft" size={13} /> {t("common.back")}</button>
              <button className="btn-accent" disabled={pending || done || !sys.trim() || !sourceReady} onClick={finish}><Icon name="bot" size={14} /> {(pending || done) ? t("onboarding.brief.settingUp") : t("onboarding.brief.handOff")}</button>
            </div>
          </>}

        </div>
      </div>
    </div>
  );
}
