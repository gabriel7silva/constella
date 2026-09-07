import "server-only";
import { randomUUID as uid } from "node:crypto";
import { db } from "@/db";
import { agent } from "@/db/schema";
import { writeWorkspaceFile } from "@/lib/fs-workspace";
import { agentFiles, type AgentDef, type ScaffoldCtx } from "@/data/scaffold";

type Persona = { identity: string; ritual: string; tone: string; systemPrompt: string };

/**
 * SINGLE SOURCE of agent-row creation (DB insert + persona files on disk). Used by onboarding, the boot
 * roster-backfill (seed-roster), and the "Hire Agent" UI (hireAgent). It writes `adapter`/`model`
 * EXPLICITLY from the def — fixing the historical bug where onboarding/seed-roster omitted them, so every
 * non-Ada agent silently ran the schema default (`cli_claude_code`/`sonnet`) regardless of its def.
 *
 * Synchronous (better-sqlite3 `.run()`) so it works at BOOT (seed-roster — no request/session) and inside
 * onboarding's synchronous insert sequence. Returns the new agent id.
 *
 * `skipFiles`: onboarding's `scaffoldWorkspace()` already rendered the whole roster's persona files, so it
 * passes `true` to avoid a redundant double-write (which would also double-fire the file watcher). The
 * backfill + hire paths render the files here (their agents have none on disk yet).
 */
export function createAgentRow(
  orgId: string,
  wsId: string,
  def: AgentDef,
  ctx: ScaffoldCtx,
  opts: { origin?: "roster" | "hired"; hiredAt?: Date | null; skipFiles?: boolean; persona?: Persona | null; effort?: "low" | "medium" | "high" | "max" } = {},
): string {
  const id = uid();
  db.insert(agent).values({
    id, workspaceId: wsId, handle: def.handle, name: def.name, role: def.role, color: def.color,
    adapter: def.provider, model: def.model,                              // ← the fix: explicit, never the schema default
    temperature: def.temperature, dailyCapUsd: def.dailyCapUsd,
    tierFloor: def.tier as "light" | "heavy" | "critical", reportsTo: def.reportsTo,
    ...(opts.persona ? { persona: opts.persona } : {}),
    ...(opts.effort ? { effort: opts.effort } : {}),
    origin: opts.origin ?? "roster", hiredAt: opts.hiredAt ?? null,
    status: "idle", lastPulse: new Date(), health: "alive",
  }).run();
  if (!opts.skipFiles) for (const [rel, content] of agentFiles(def, ctx)) writeWorkspaceFile(orgId, rel, content);
  return id;
}
