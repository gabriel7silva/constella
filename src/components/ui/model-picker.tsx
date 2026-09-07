"use client";

import { useEffect, useState } from "react";
import { Dropdown } from "@/components/ui/dropdown";
import { useT } from "@/lib/i18n-context";
import { cliModelOptions, LIVE_CLI_ADAPTERS, type ModelOpt } from "@/data/model-options";
import { versionsFor } from "@/data/model-versions";
import { listCatalogModels, listProviderModels } from "@/server/providers";
import type { CachedModel } from "@/data/models-dev";

export type ConnectedProvider = { id: string; adapter: string };

/** CLI options enriched with the concrete version each alias resolves to ("Claude Opus 4.8"). */
function cliOptsWithVersion(adapter: string): ModelOpt[] | null {
  const base = cliModelOptions(adapter);
  if (!base) return null;
  const vers = versionsFor(adapter);
  if (!vers) return base;
  return base.map((o) => {
    const v = vers.find((x) => x.id === o.value);
    return v ? { value: o.value, label: `${v.label} ${v.version}${v.note ? " · " + v.note : ""}` } : o;
  });
}

/** Compact context + price hint appended to a model label ("· 1M ctx · $3/$15"). */
function hint(m: CachedModel): string {
  const bits: string[] = [];
  if (m.context) bits.push(m.context >= 1e6 ? `${(m.context / 1e6).toFixed(m.context % 1e6 ? 1 : 0)}M ctx` : `${Math.round(m.context / 1000)}K ctx`);
  if (m.inputCost || m.outputCost) bits.push(`$${m.inputCost}/${m.outputCost}`);
  return bits.length ? " · " + bits.join(" · ") : "";
}

/**
 * Model selector that adapts to the agent's provider:
 *  - CLI adapters (cli_*) → the runtime's real aliases (opus/sonnet/haiku, gpt-5-codex…).
 *  - HTTP/router/local providers → the cached, enriched catalog (models.dev ∩ live /v1/models,
 *    with context + pricing), falling back to a bare live `/v1/models` list if the cache is cold.
 * Always emits a real model value; never free-text. Auto-selects the provider's recommended default
 * when no model is chosen yet.
 */
export function ModelPicker({ adapter, value, onChange, providers }: {
  adapter: string; value: string; onChange: (v: string) => void; providers: ConnectedProvider[];
}) {
  const t = useT();
  const cli = cliOptsWithVersion(adapter);
  const isLocal = adapter.startsWith("local_");
  const [live, setLive] = useState<ModelOpt[] | null>(null);
  const [note, setNote] = useState("");
  const conn = providers.find((p) => p.adapter === adapter);
  // aider/opencode expose a real model list their binary accepts → pull live from the cache. claude/codex
  // keep their fixed aliases (the CLI rejects full ids).
  const liveCli = !!cli && LIVE_CLI_ADAPTERS.has(adapter) && !!conn;

  useEffect(() => {
    // Skip the live fetch for: local runtimes, no connected provider, or a fixed-alias CLI (claude/codex).
    // HTTP/router providers + live-capable CLIs (aider/opencode) fetch the real list from the cache.
    if (isLocal || !conn || (cli && !liveCli)) { setLive(null); setNote(isLocal || cli ? "" : t("modelpicker.connectProvider")); return; }
    let on = true;
    setNote(t("modelpicker.loading"));
    // Prefer the rich, current catalog cache; fall back to a bare live list if it's cold.
    listCatalogModels(conn.id).then(async ({ models }) => {
      if (!on) return;
      if (models.length) {
        setLive(models.map((m) => ({ value: m.id, label: m.name + hint(m) + (m.isDefault ? " · " + t("modelpicker.recommended") : "") })));
        setNote("");
        if (!value) { const def = models.find((m) => m.isDefault) ?? models[0]; if (def) onChange(def.id); }
        return;
      }
      const r = await listProviderModels(conn.id);
      if (!on) return;
      setLive(r.models.map((m) => ({ value: m, label: m })));
      setNote(r.error ? r.error : r.models.length ? t("modelpicker.syncProvider") : (cli ? "" : t("modelpicker.noModels")));
    }).catch(() => { if (on) { setLive(cli ? null : []); setNote(cli ? "" : t("modelpicker.loadError")); } });
    return () => { on = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adapter, conn?.id, !!cli, isLocal, liveCli]);

  const localOpts: ModelOpt[] | null = isLocal ? [{ value: value || "local", label: t("modelpicker.localGguf") }] : null;
  // Prefer the live (real, from-binary) list when present; else the curated CLI aliases; else live/value.
  const options: ModelOpt[] = localOpts ?? ((live && live.length) ? live : (cli ?? live ?? (value ? [{ value, label: value }] : [])));
  // keep the current value selectable even if it isn't in the fetched list
  const opts = value && !options.some((o) => o.value === value) ? [{ value, label: value }, ...options] : options;

  return (
    <>
      <Dropdown mono value={value} options={opts} placeholder={t("modelpicker.placeholder")} onChange={onChange} />
      {note && <div className="form-hint" style={{ marginTop: 4 }}>{note}</div>}
    </>
  );
}
