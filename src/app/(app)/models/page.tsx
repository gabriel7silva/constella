import { eq } from "drizzle-orm";
import { db } from "@/db";
import { provider, localModel, agent } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";
import { ViewShell } from "@/components/shell/view-shell";
import { catalogById } from "@/data/providers-catalog";
import { detectHardware, ollamaInfo, ollamaInstalled, llamaServerStatus, llamaServerInstalled } from "@/server/local-models";
import { ModelsScreen, OpenCatalogButton } from "@/components/modules/models-screen";
import { getT } from "@/lib/i18n-server";

export default async function ModelsPage() {
  const t = await getT();
  const { workspace } = await requireWorkspace();
  const [providers, locals, agents, hardware, ollama, isOllamaInstalled, llama, isLlamaInstalled] = await Promise.all([
    db.select().from(provider).where(eq(provider.workspaceId, workspace.id)),
    // Local GGUF models are a MACHINE resource (one file under ~/.constella/models, shared by every
    // workspace) — list across ALL workspaces so a model downloaded once shows everywhere, then dedup by file.
    db.select().from(localModel),
    db.select().from(agent).where(eq(agent.workspaceId, workspace.id)),
    detectHardware(),
    ollamaInfo(),
    ollamaInstalled(),
    llamaServerStatus(),
    llamaServerInstalled(),
  ]);

  return (
    <ViewShell
      title={t("models.title")}
      sub={t("models.sub")}
      right={<OpenCatalogButton />}
    >
      <ModelsScreen
        providers={providers.map((p) => ({
          id: p.id, catalogId: p.catalogId, displayName: catalogById(p.catalogId)?.displayName ?? p.catalogId,
          adapter: p.adapter, kind: p.kind, auth: p.auth, status: p.status, modelCount: p.modelCount,
          lastSync: p.lastSync ? new Date(p.lastSync).toLocaleString() : null,
          cliVersion: p.cliVersion ?? null, defaultModel: p.defaultModel ?? null, authState: p.authState ?? null,
        }))}
        locals={Array.from(new Map(locals.map((l) => [l.file, l])).values()).map((l) => ({ id: l.id, name: l.name, file: l.file, quant: l.quant, params: l.params, sizeBytes: l.sizeBytes, bind: l.bind }))}
        agents={agents.map((a) => ({ id: a.id, handle: a.handle, name: a.name, role: a.role, color: a.color, adapter: a.adapter, model: a.model }))}
        hardware={hardware}
        ollamaUp={ollama.up}
        ollamaInstalled={isOllamaInstalled}
        installed={ollama.models}
        llamaUp={llama.up}
        llamaInstalled={isLlamaInstalled}
        llamaModel={llama.model}
      />
    </ViewShell>
  );
}
