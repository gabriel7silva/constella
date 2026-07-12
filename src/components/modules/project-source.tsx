"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/ui/icon";
import { reanalyzeProject } from "@/server/onboarding";
import { useT } from "@/lib/i18n-context";

type Source = { type?: string; localPath?: string; repo?: string; fileCount?: number; analyzed?: boolean };

/** Shows where this workspace's project came from (imported local folder / GitHub repo / mock / new starter),
 *  the active managed directory, and whether the existing project has been analyzed — plus a one-click
 *  "Re-analyze" that re-reads the project into specs/SUPER-SPEC.md on the next plan. */
export function ProjectSource({ source }: { source?: Source }) {
  const t = useT();
  const [pending, start] = useTransition();
  const [queued, setQueued] = useState(false);
  const s = source ?? {};
  const kind = s.type ?? "new";
  const imported = kind === "local" || kind === "github" || kind === "mock";
  const label =
    kind === "local" ? t("config.source.local", { name: s.localPath ?? "—", n: s.fileCount ?? 0 })
    : kind === "github" ? t("config.source.github", { repo: s.repo ?? "—", n: s.fileCount ?? 0 })
    : kind === "mock" ? t("config.source.mock")
    : t("config.source.new");

  return (
    <div>
      <div className="kv"><span className="k">{t("config.source.active")}</span><span className="v">{label}</span></div>
      <div className="kv"><span className="k">{t("config.source.dir")}</span><span className="v lr-mono" style={{ fontFamily: "var(--mono-font)", fontSize: 11.5 }}>~/.constella/organizations/&lt;org&gt;/workspace</span></div>
      {imported && (
        <>
          <div className="kv"><span className="k">{t("config.source.analysis")}</span><span className="v">{s.analyzed ? t("config.source.analyzed") : t("config.source.notAnalyzed")}</span></div>
          <button className="btn-ghost" disabled={pending || queued} style={{ marginTop: 8 }}
            onClick={() => start(async () => { const r = await reanalyzeProject(); setQueued(r.ok); })}>
            <span className={pending ? "sync-spin" : ""} style={{ display: "inline-flex" }}><Icon name="refresh" size={13} /></span>
            {" "}{queued ? t("config.source.reanalyzeQueued") : t("config.source.reanalyze")}
          </button>
        </>
      )}
    </div>
  );
}
