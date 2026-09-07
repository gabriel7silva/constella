import { requireWorkspace } from "@/lib/workspace";
import { ViewShell } from "@/components/shell/view-shell";
import { EditorSettings, AgentRuntimeSettings, DesignGateSettings } from "@/components/modules/config-actions";
import { AnimToggle } from "@/components/shell/anim-toggle";
import { StackEditor } from "@/components/modules/stack-editor";
import { ProjectSource } from "@/components/modules/project-source";
import { getT } from "@/lib/i18n-server";

export default async function ConfigPage() {
  const t = await getT();
  const { workspace } = await requireWorkspace();
  const settings = workspace.settings ?? {};

  return (
    <ViewShell title="Config" sub={t("config.sub")}>
      <div className="cards-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="set-card" style={{ gridColumn: "1 / -1" }}>
          <h4>Project Stack</h4>
          <div className="set-desc">The technologies this project is built on. Changing the stack re-links every agent to the matching skills — the chosen frameworks, the design system, database, security and testing — and re-indexes the knowledge base, so planning and execution stay specific to this stack.</div>
          <StackEditor stack={(workspace.stack ?? {}) as Record<string, string>} />
        </div>

        <div className="set-card" style={{ gridColumn: "1 / -1" }}>
          <h4>{t("config.source.title")}</h4>
          <div className="set-desc">{t("config.source.desc")}</div>
          <ProjectSource source={settings.source} />
        </div>

        <div className="set-card">
          <h4>{t("config.editor")}</h4>
          <div className="set-desc">{t("config.editorDesc")}</div>
          <EditorSettings editor={settings.editor} />
        </div>

        <div className="set-card">
          <h4>{t("config.appearance")}</h4>
          <div className="set-desc">{t("config.appearanceDesc")}</div>
          <AnimToggle labeled />
        </div>

        <div className="set-card">
          <h4>{t("config.agents")}</h4>
          <div className="set-desc">{t("config.agentsDesc")}</div>
          <AgentRuntimeSettings agents={settings.agents} />
        </div>

        <div className="set-card">
          <h4>{t("config.design")}</h4>
          <div className="set-desc">{t("config.designDesc")}</div>
          <DesignGateSettings design={settings.design} />
        </div>

        <div className="set-card">
          <h4>{t("config.configFiles")}</h4>
          <div className="set-desc">{t("config.configFilesDesc")}</div>
          <div className="kv"><span className="k">constella.yaml</span><span className="v lr-mono" style={{ fontFamily: "var(--mono-font)", fontSize: 11.5 }}>~/.constella/config.yaml</span></div>
          <div className="kv"><span className="k">company.yaml</span><span className="v lr-mono" style={{ fontFamily: "var(--mono-font)", fontSize: 11.5 }}>./company.yaml</span></div>
          <div className="kv"><span className="k">{t("config.authentication")}</span><span className="v">better-auth · {t("config.singleOperator")}</span></div>
        </div>
      </div>
    </ViewShell>
  );
}
