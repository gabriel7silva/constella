"use server";

import { randomUUID as uid } from "node:crypto";
import { eq, and, lt, isNull, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { provider, providerModel } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";
import { putSecret, getSecret, delSecret } from "@/lib/vault";
import { catalogById } from "@/data/providers-catalog";
import type { CachedModel } from "@/data/models-dev";
import { syncProvider as syncAdapter } from "@/server/adapters/sync";
import { pickBinary, cliVersion, detectCliAuth, CLI_MODELS, type AuthState } from "@/server/adapters/cli";
import { liveModels, enrichModels, defaultModelFor } from "@/server/model-catalog";

/** Connect a provider from the catalog. The API key (if any) goes to the vault, never the provider row. */
export async function connectProvider(catalogId: string, apiKey?: string) {
  const { workspace } = await requireWorkspace();
  const cp = catalogById(catalogId);
  if (!cp) return;
  const id = uid();
  await db.insert(provider).values({
    id, workspaceId: workspace.id, catalogId, adapter: cp.defaultAdapter,
    kind: cp.category === "cli" ? "cli" : cp.category === "local_runtime" ? "local" : "cloud",
    auth: cp.connectionTypes.includes("api_key") ? "api_key" : (cp.connectionTypes[0] as "api_key" | "oauth" | "cli" | "local" | "none"),
    status: "needs_sync", syncStatus: cp.supportsModelSync ? "implemented" : "manual",
  });
  if (apiKey) await putSecret(workspace.id, `${catalogId}_api_key`, apiKey, id);
  revalidatePath("/models");
  // Immediately do a real sync so the count/status reflect reality, then populate the rich,
  // current model catalog (models.dev ∩ live /v1/models). Best-effort — never blocks the connect.
  await syncProvider(id);
}

/** Real sync — hits the live endpoint / CLI for the model count. */
export async function syncProvider(id: string) {
  const { workspace } = await requireWorkspace();
  const [row] = await db.select().from(provider).where(and(eq(provider.id, id), eq(provider.workspaceId, workspace.id)));
  if (!row) return { ok: false, error: "not found" };
  const cp = catalogById(row.catalogId);
  if (!cp) return { ok: false, error: "unknown provider" };
  const key = await getSecret(workspace.id, `${row.catalogId}_api_key`);
  const res = await syncAdapter(cp, key);
  // Rich status: CLI version (CLI providers) + auth state (ready / needs-login / needs-key).
  let cliVer: string | null = null;
  let authState: AuthState;
  if (cp.category === "cli") {
    const bin = pickBinary(cp.defaultAdapter);
    cliVer = await cliVersion(bin).catch(() => null);
    authState = !cliVer ? "needs_login" : await detectCliAuth(bin).catch(() => "unknown" as AuthState);
  } else if (cp.category === "local_runtime") {
    authState = res.ok ? "ready" : "unknown";
  } else {
    authState = key ? (res.ok ? "ready" : "needs_key") : "needs_key";
  }
  await db.update(provider).set({
    status: res.ok ? "connected" : "error",
    modelCount: res.count,
    lastSync: new Date(),
    cliVersion: cliVer,
    authState,
  }).where(eq(provider.id, id));
  // Populate the rich, current model catalog (best-effort; doesn't change the connect verdict).
  if (res.ok) await refreshProviderModels(id).catch(() => {});
  revalidatePath("/models");
  return res;
}

/**
 * Refresh the cached, enriched model catalog for one provider: pull the provider's live model ids
 * (`/v1/models` / `/api/tags`), enrich each from models.dev (context, pricing, capabilities, release),
 * pick a recommended default, and replace the provider_model rows. CLI providers (no live endpoint
 * yet) are wired in Phase 2 — here they no-op cleanly. Never throws.
 */
export async function refreshProviderModels(id: string): Promise<{ ok: boolean; count: number; error?: string }> {
  const { workspace } = await requireWorkspace();
  const [row] = await db.select().from(provider).where(and(eq(provider.id, id), eq(provider.workspaceId, workspace.id)));
  if (!row) return { ok: false, count: 0, error: "not found" };
  const res = await refreshRow(row);
  revalidatePath("/models");
  return res;
}

/** Core refresh for one provider row (workspace already trusted). Shared by the request path and the
 *  background boot/cron sweep — does NOT call requireWorkspace (uses row.workspaceId directly). */
async function refreshRow(row: typeof provider.$inferSelect): Promise<{ ok: boolean; count: number; error?: string }> {
  const cp = catalogById(row.catalogId);
  if (!cp) return { ok: false, count: 0, error: "unknown provider" };
  const key = await getSecret(row.workspaceId, `${row.catalogId}_api_key`);
  const isCli = cp.category === "cli";

  let live;
  try {
    live = await liveModels({ catalogId: row.catalogId, adapter: row.adapter, baseUrl: cp.baseUrl, apiKey: key });
  } catch { live = null; }

  // CLI providers: re-detect the binary version + auth state on every refresh (so the panel's
  // "Refresh models" button actually re-detects, not just the table Sync), and — when the CLI has no
  // live model-list command (claude/codex/copilot/cursor/cline/kilo) — seed the cache from its known
  // model ids/aliases so the rich panel isn't empty.
  let cliVer: string | null | undefined;
  let authState: AuthState | undefined;
  if (isCli) {
    const bin = pickBinary(row.adapter);
    cliVer = await cliVersion(bin).catch(() => null);
    authState = !cliVer ? "needs_login" : await detectCliAuth(bin).catch(() => "unknown" as AuthState);
    if (live === null) {
      live = (CLI_MODELS[row.adapter] ?? []).filter((m) => m !== "(default)").map((id) => ({ id }));
    }
  }
  if (live === null) return { ok: true, count: 0 }; // non-CLI without an endpoint — nothing to cache

  const enriched = await enrichModels(row.catalogId, live);
  const now = new Date();
  const def = enriched.length ? defaultModelFor(row.catalogId, enriched) : null;

  if (enriched.length) {
    // Replace wholesale so removed/renamed models don't linger.
    await db.delete(providerModel).where(eq(providerModel.providerId, row.id));
    await db.insert(providerModel).values(enriched.map((m) => ({
      id: uid(), workspaceId: row.workspaceId, providerId: row.id, catalogId: row.catalogId,
      modelId: m.id, name: m.name, context: m.context, outputLimit: m.outputLimit,
      inputCost: m.inputCost, outputCost: m.outputCost, caps: m.caps, released: m.released,
      isDefault: m.id === def, lastSeen: now,
    })));
  } else if (!isCli) {
    return { ok: false, count: 0, error: "no models returned" }; // keep existing cache (non-CLI)
  }

  // A CLI whose binary isn't on PATH is not really connected → mark needs_sync (avoids the
  // "Connected" + "not detected" contradiction). Everything else that refreshed is connected.
  const status = isCli && !cliVer ? "needs_sync" : "connected";
  await db.update(provider).set({
    status,
    modelCount: enriched.length || (isCli ? row.modelCount : 0),
    lastSync: now,
    defaultModel: def || row.defaultModel,
    ...(isCli ? { cliVersion: cliVer ?? null, authState: authState ?? null } : {}),
  }).where(eq(provider.id, row.id));
  return { ok: true, count: enriched.length };
}

/**
 * Background auto-update: refresh the model catalog for every connected provider not synced within
 * `maxAgeHours`. Called fire-and-forget from boot + the worker cron tick. Workspace-agnostic (operates
 * on stored rows). Best-effort, capped, never throws.
 */
export async function refreshAllStaleProviders(maxAgeHours = 12): Promise<{ refreshed: number }> {
  const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
  let rows;
  try {
    rows = await db.select().from(provider)
      .where(and(eq(provider.status, "connected"), or(isNull(provider.lastSync), lt(provider.lastSync, cutoff))));
  } catch { return { refreshed: 0 }; }
  let refreshed = 0;
  for (const row of rows.slice(0, 50)) { // cap so a boot can't fan out unbounded network calls
    try { const r = await refreshRow(row); if (r.ok && r.count > 0) refreshed++; } catch { /* skip */ }
  }
  return { refreshed };
}

/** The cached, enriched models for a provider (what the UI lists). Empty until first refresh. */
export async function listCatalogModels(id: string): Promise<{ models: CachedModel[] }> {
  const { workspace } = await requireWorkspace();
  const rows = await db.select().from(providerModel).where(and(eq(providerModel.providerId, id), eq(providerModel.workspaceId, workspace.id)));
  const models: CachedModel[] = rows.map((r) => ({
    id: r.modelId, name: r.name, context: r.context, outputLimit: r.outputLimit,
    inputCost: r.inputCost, outputCost: r.outputCost,
    caps: r.caps ?? { reasoning: false, tools: false, vision: false },
    released: r.released, isDefault: r.isDefault,
  }));
  // Default first, then newest, then by name — stable, useful ordering for pickers.
  models.sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || (b.released || "").localeCompare(a.released || "") || a.name.localeCompare(b.name));
  return { models };
}

/** Real connectivity test — does not change the model count, only reports. */
export async function testProvider(id: string) {
  const { workspace } = await requireWorkspace();
  const [row] = await db.select().from(provider).where(and(eq(provider.id, id), eq(provider.workspaceId, workspace.id)));
  if (!row) return { ok: false, error: "not found" };
  const cp = catalogById(row.catalogId);
  if (!cp) return { ok: false, error: "unknown provider" };
  const key = await getSecret(workspace.id, `${row.catalogId}_api_key`);
  const res = await syncAdapter(cp, key);
  await db.update(provider).set({ status: res.ok ? "connected" : "error" }).where(eq(provider.id, id));
  revalidatePath("/models");
  return { ok: res.ok, error: res.error };
}

/** Live model list from the provider's endpoint (real — OpenAI `/v1/models` or Ollama `/api/tags`). */
export async function listProviderModels(id: string): Promise<{ models: string[]; error?: string }> {
  const { workspace } = await requireWorkspace();
  const [row] = await db.select().from(provider).where(and(eq(provider.id, id), eq(provider.workspaceId, workspace.id)));
  if (!row) return { models: [], error: "not found" };
  const cp = catalogById(row.catalogId);
  if (!cp?.baseUrl) return { models: [], error: "no public endpoint for this provider" };
  const key = await getSecret(workspace.id, `${row.catalogId}_api_key`);
  const base = cp.baseUrl.replace(/\/$/, "");
  try {
    const isOllama = /ollama/i.test(row.catalogId) || row.adapter.includes("ollama");
    const url = isOllama ? `${base.replace(/\/v1$/, "")}/api/tags` : `${base}/models`;
    const r = await fetch(url, {
      headers: key ? { authorization: `Bearer ${key}` } : {},
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return { models: [], error: `endpoint ${r.status}` };
    const j = await r.json();
    const raw: { id?: string; name?: string }[] = j.data ?? j.models ?? [];
    return { models: raw.map((m) => m.id ?? m.name ?? "").filter(Boolean).slice(0, 80) };
  } catch (e) {
    const msg = String(e instanceof Error ? e.message : e);
    return { models: [], error: /abort|fetch failed|ECONN/i.test(msg) ? "endpoint unreachable" : msg };
  }
}

export async function removeProvider(id: string) {
  const { workspace } = await requireWorkspace();
  const [row] = await db.select().from(provider).where(and(eq(provider.id, id), eq(provider.workspaceId, workspace.id)));
  if (row) await delSecret(workspace.id, `${row.catalogId}_api_key`);
  await db.delete(provider).where(and(eq(provider.id, id), eq(provider.workspaceId, workspace.id)));
  revalidatePath("/models");
}

/** Revoke the stored API key for a provider — deletes the vault secret, marks it needs-sync. */
export async function revokeProviderToken(id: string) {
  const { workspace } = await requireWorkspace();
  const [row] = await db.select().from(provider).where(and(eq(provider.id, id), eq(provider.workspaceId, workspace.id)));
  if (!row) return;
  await delSecret(workspace.id, `${row.catalogId}_api_key`);
  await db.update(provider).set({ auth: "none", status: "needs_sync", modelCount: 0 }).where(eq(provider.id, id));
  revalidatePath("/models");
}
