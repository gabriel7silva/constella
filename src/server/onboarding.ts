"use server";

import { randomUUID as uid } from "node:crypto";
import { redirect } from "next/navigation";
import { db } from "@/db";
import * as s from "@/db/schema";
import { getSession, listOrgs, slugify, requireWorkspace } from "@/lib/workspace";
import { getRunMode } from "@/lib/run-mode";
import { reconcileStack } from "@/lib/stack-compat";
import { scaffoldWorkspace, scaffoldProjectStarter, AGENT_DEFS, type ScaffoldCtx } from "@/data/scaffold";
import { createAgentRow } from "@/server/agent-create";
import { cloneRepoIntoWorkspace, scanLocalDir } from "@/server/onboarding-import";
import { readWorkspaceFile, writeWorkspaceFile } from "@/lib/fs-workspace";
import { notifyOps } from "@/lib/notify";
import { setFrontMatter, setSection } from "@/lib/md-patch";
import { putSecret } from "@/lib/vault";
import { catalogById } from "@/data/providers-catalog";
import { allLibrarySkillNames } from "@/server/skills-library";
import { seedLibrarySkills, reconcileStackRoleSkills } from "@/server/seed-library-skills";

/** Does the signed-in user already belong to an org? Drives whether onboarding shows a "Close"
 *  button — a brand-new user (no org) closing would just bounce back here (requireWorkspace
 *  redirects to /onboarding), so the button is only safe once a workspace exists. */
export async function operatorHasOrg(): Promise<boolean> {
  const s = await getSession();
  if (!s) return false;
  const orgs = await listOrgs(s.user.id);
  return orgs.length > 0;
}

const SKILLS = [
  ["open-pr", "Branch, commit, open a PR with a test plan and request CTO review.", "When a work product is ready to merge", false],
  ["run-suite", "Detect the package manager, run the test task and gate sign-off on red.", "Before any sign-off", false],
  ["secret-scan", "Scan for plaintext keys, verify vault references and flag log leaks.", "On every adapter change", false],
  ["telegram-notify", "Format a digest and POST it to the Telegram Bot API.", "When a routine completes", true],
  ["moscow-prioritise", "Score backlog items and re-order them with the MoSCoW method.", "During backlog grooming", false],
  ["gguf-validate", "Pull a GGUF, verify SHA-256 and bind to loopback.", "When installing a local model", true],
] as const;

export type OnboardingInput = {
  company: string; mission: string; objective: string;
  stack: Record<string, string>;
  provider?: string; model?: string;
  systemPrompt?: string; briefText?: string; briefName?: string;
  providerCatalogId?: string; providerKey?: string;
  // An attached HTML mock / prototype folder — written to `mock/` so the CEO + agents read it.
  mockFiles?: { path: string; content: string }[];
  // Existing-project source: import a GitHub repo (clone) or copy a local directory. When set (or a
  // mock is attached), the deterministic runnable starter is SUPPRESSED — agents build on the material.
  source?:
    | { type: "new" }
    | { type: "github"; pat: string; repoFull: string; branch?: string; login?: string }
    // Local import: the operator picks a folder; the browser reads + filters its text source files
    // (deps/build/cache dirs pruned client-side) and uploads them here. `rootName` is the folder name.
    | { type: "local"; rootName?: string; files: { path: string; content: string }[] };
};

/** Onboarding-time check that a typed local directory exists + is importable (no contents leaked). */
export async function validateLocalDir(path: string): Promise<{ ok: boolean; error?: string; fileCount?: number; sample?: string[] }> {
  const sess = await getSession();
  if (!sess) return { ok: false, error: "Not signed in." };
  return scanLocalDir(path);
}

/** Creates the org + workspace + the 9 agents. Returns `{ ok }` — the client navigates to the CEO
 *  Planner on success (a server-side redirect from inside this heavy action was unreliable: any throw
 *  before it left the operator stuck on onboarding with no feedback). */
export async function completeOnboarding(input: OnboardingInput): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (!session) redirect("/login");
  const userId = session.user.id;
  // Final guard: never persist an invalid stack — drop any pick incompatible with the rest.
  input.stack = reconcileStack(input.stack ?? {}).stack;

  const orgId = uid();
  const wsId = uid();
  const slug = slugify(input.company) + "-" + Math.random().toString(36).slice(2, 8);
  // The active run mode (set by the launch command) becomes the org/workspace mode.
  const runMode = getRunMode();

  db.insert(s.organization).values({ id: orgId, name: input.company, ownerId: userId, runMode }).run();
  delete process.env.CONSTELLA_FORCE_ONBOARDING; // one-shot: don't re-trap on the next requireWorkspace
  db.insert(s.member).values({ id: uid(), orgId, userId, role: "owner" }).run();
  db.insert(s.workspace).values({
    id: wsId, orgId, slug, name: input.company,
    mission: input.mission, objective: input.objective, stack: input.stack,
  }).run();

  // a provider registered during onboarding (fallback beyond auto-detected): create the row + vault the key
  if (input.providerCatalogId) {
    const cp = catalogById(input.providerCatalogId);
    if (cp) {
      const provId = uid();
      db.insert(s.provider).values({
        id: provId, workspaceId: wsId, catalogId: cp.id, adapter: cp.defaultAdapter,
        kind: cp.category === "cli" ? "cli" : cp.category === "local_runtime" ? "local" : "cloud",
        auth: input.providerKey ? "api_key" : (cp.connectionTypes[0] as "api_key" | "oauth" | "cli" | "local" | "none"),
        status: "needs_sync", syncStatus: cp.supportsModelSync ? "implemented" : "manual",
      }).run();
      if (input.providerKey) await putSecret(wsId, `${cp.id}_api_key`, input.providerKey, provId);
    }
  }

  // IMPORT existing material (GitHub repo / local dir) BEFORE scaffold, so the repo's own README
  // survives (preserveReadme) and the .claude control layer lands on top of it. Best-effort — a
  // failed import still creates the org; recompute "material" from what actually landed.
  type SourceMeta = { type: "new" | "github" | "local" | "mock"; repo?: string; branch?: string; localPath?: string; importedAt?: number; fileCount?: number; analyzed?: boolean };
  let sourceMeta: SourceMeta = { type: "new" };
  let ghBind: { login?: string; repo?: string; defaultBranch?: string } | null = null;
  const src = input.source;
  if (src?.type === "github") {
    try {
      const r = await cloneRepoIntoWorkspace(orgId, src.repoFull, src.pat, src.branch);
      if (r.ok) {
        await putSecret(wsId, "github_pat", src.pat);
        sourceMeta = { type: "github", repo: src.repoFull, branch: src.branch, importedAt: Date.now(), fileCount: r.copied };
        ghBind = { login: src.login, repo: src.repoFull, defaultBranch: src.branch ?? "main" };
      } else { console.error("[onboarding] github import failed:", r.error); }
    } catch (e) { console.error("[onboarding] github import threw:", e); }
  } else if (src?.type === "local") {
    // The browser already filtered (skipped dep/build dirs, binaries, oversize) and read the text files.
    // Write each into the workspace, path-jailed. Mark the source "local" even if 0 landed, so we never
    // silently overwrite an ATTEMPTED import with a generic starter — the provenance shows the real count.
    let n = 0;
    try {
      for (const f of (src.files ?? []).slice(0, 6000)) {
        const rel = f.path.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\.\.+/g, ".");
        if (!rel || rel.endsWith("/")) continue;
        try { writeWorkspaceFile(orgId, rel, f.content); n++; } catch { /* path escape / unwritable → skip */ }
      }
    } catch (e) { console.error("[onboarding] local import failed:", e); }
    sourceMeta = { type: "local", localPath: src.rootName || "imported project", importedAt: Date.now(), fileCount: n };
  }
  const hasMock = !!input.mockFiles?.length;
  if (sourceMeta.type === "new" && hasMock) sourceMeta = { type: "mock", importedAt: Date.now() };
  const hasMaterial = sourceMeta.type !== "new" || hasMock;
  const importedReadme = readWorkspaceFile(orgId, "README.md") != null;

  // write the filled .claude/ control layer (+ docs) to disk; preserve an imported repo's own README.
  // Best-effort: a file-write hiccup here must NOT abort onboarding (the org/workspace/agents already
  // exist) — agents would otherwise be created but the operator left stranded on the wizard.
  try {
    scaffoldWorkspace(orgId, { company: input.company, mission: input.mission, objective: input.objective, stack: input.stack, slug, runMode, preserveReadme: importedReadme });
  } catch (e) { console.error("[onboarding] scaffold failed:", e); }
  // a deterministic RUNNABLE starter ONLY for a truly-new project (no imported/mock material) — so we
  // never create a second prototype on top of what the operator already brought.
  if (!hasMaterial) {
    try {
      scaffoldProjectStarter({ orgId, slug, company: input.company, mission: input.mission, objective: input.objective, stack: input.stack, runMode });
    } catch (e) { console.error("[onboarding] starter scaffold failed:", e); }
  }
  // persist the project source (+ github binding) so the planner runs the analysis once + Code/GitHub work.
  db.update(s.workspace).set({ settings: { ...(ghBind ? { github: ghBind } : {}), source: { ...sourceMeta, analyzed: false } } }).where(eq(s.workspace.id, wsId)).run();

  // Create the roster from the SINGLE source (AGENT_DEFS via createAgentRow) so every agent's adapter/model
  // land on the row EXPLICITLY — the old loop omitted them, so every non-Ada agent silently ran the schema
  // default cli_claude_code/sonnet. scaffoldWorkspace() above already rendered the persona files, so
  // skipFiles avoids a redundant double-write (which would also double-fire the file watcher).
  const agentCtx: ScaffoldCtx = { orgId, slug, company: input.company, mission: input.mission, objective: input.objective, stack: input.stack };
  const agentIds: Record<string, string> = {};
  for (const def of AGENT_DEFS) {
    const d = def.handle === "ada"
      ? { ...def, provider: input.provider || def.provider, model: input.model || def.model }
      : def;
    const persona = def.handle === "ada" && input.systemPrompt?.trim()
      ? { identity: "", ritual: "", tone: "", systemPrompt: input.systemPrompt.trim() }
      : undefined;
    agentIds[def.handle] = createAgentRow(orgId, wsId, d, agentCtx, { origin: "roster", skipFiles: true, persona });
  }

  // Ada's persona files on disk were scaffolded with the default provider/model + generic prompt — patch
  // them to the operator's CEO choices (the DB row above already carries them).
  if (input.provider || input.model || input.systemPrompt) {
    const rel = ".claude/agents/ada/Agent.md";
    let md = readWorkspaceFile(orgId, rel) ?? "";
    if (md) {
      if (input.provider) md = setFrontMatter(md, "provider", input.provider);
      if (input.model) md = setFrontMatter(md, "model", input.model);
      if (input.systemPrompt?.trim()) md = setSection(md, "System prompt", input.systemPrompt.trim());
      writeWorkspaceFile(orgId, rel, md);
    }
  }
  if (input.briefText?.trim()) {
    writeWorkspaceFile(orgId, ".claude/BRIEF.md", `# Project brief${input.briefName ? ` — ${input.briefName}` : ""}\n\n${input.briefText.trim()}\n`);
  }

  // Attached mock / prototype → written to `mock/`. The CEO + agents read these files
  // directly (cwd = workspace) and via RAG; generatePlan tells Ada to match the mock.
  if (input.mockFiles?.length) {
    let manifest = "";
    for (const f of input.mockFiles.slice(0, 200)) {
      const rel = ("mock/" + f.path).replace(/\.\.+/g, ".").replace(/\/+/g, "/");
      writeWorkspaceFile(orgId, rel, f.content);
      manifest += `- ${f.path}\n`;
    }
    writeWorkspaceFile(orgId, "mock/README.md", `# Attached mock / prototype\n\n_The operator attached this visual prototype at onboarding. Agents must read these files and match the product to them precisely._\n\n## Files\n${manifest}`);
    // Auto-seed the Design module so it opens NON-EMPTY: copy the attached mock into design-mock/import/ as
    // the starting point the frontend agent (Grace) prototypes from. Best-effort.
    try {
      for (const f of input.mockFiles.slice(0, 200)) {
        const rel = ("design-mock/import/" + f.path).replace(/\.\.+/g, ".").replace(/\/+/g, "/");
        writeWorkspaceFile(orgId, rel, f.content);
      }
      writeWorkspaceFile(orgId, "design-mock/import/README.md", `# Imported from the onboarding mock\n\n_These files were attached at onboarding and copied here as the Design module's starting point. The frontend agent uses them to build or improve the prototype before the CEO Planner generates the plan._\n\n## Files\n${manifest}`);
    } catch (e) { console.error("[onboarding] design-mock seed failed:", e); }
    // Notify (in-app + Telegram, if connected) that a visual source was imported → open Design so Grace reconstructs it.
    try { await notifyOps(wsId, { kind: "design-review", text: `Mock imported — ${input.company || "your project"}`, detail: `${input.mockFiles.length} file(s) imported into the Design module. Open Design — Grace will reconstruct the mock on the canvas to prototype + approve before planning.`, tg: true }); } catch { /* best effort */ }
  }

  db.insert(s.budget).values({ workspaceId: wsId, monthlyCapUsd: 400, monthlySpentUsd: 0 }).run();
  db.insert(s.plan).values({ workspaceId: wsId, stage: 4 }).run();

  // seed native skills + enable non-provisional for every agent
  const skillIds: string[] = [];
  for (const [name, summary, trigger, provisional] of SKILLS) {
    const sid = uid(); skillIds.push(sid);
    db.insert(s.skill).values({ id: sid, workspaceId: wsId, name, summary, trigger, native: true, provisional, indexed: provisional ? "pending" : "indexed" }).run();
    if (!provisional) for (const h of Object.keys(agentIds)) db.insert(s.agentSkill).values({ agentId: agentIds[h], skillId: sid }).run();
  }

  // Seed the WHOLE native skills LIBRARY into this workspace (visible in /skills) but link NONE here;
  // reconcileStackRoleSkills then links each agent to the skills its STACK + ROLE actually needs (a Vue
  // Frontend gets vue + design; a Django Backend gets django + db; CyberSec gets OWASP) instead of an
  // arbitrary 40 of ~180. Best-effort — a missing skills/ dir or library skill is a safe no-op (the 6
  // procedural skills above still seed + link).
  try {
    seedLibrarySkills({ orgId, wsId, names: allLibrarySkillNames(), agentIds, linkNames: [] });
    reconcileStackRoleSkills(wsId); // link each agent to the skills its stack + role actually needs
  } catch (e) { console.error("[onboarding] library skill seed failed:", e); }

  // NO fake starters — boards start real-empty. Real goals/tasks/specs/issues/findings
  // are produced by the CEO ritual (operator clicks "Generate plan" on /planner) and by
  // real agent runs. The directory + DB stay honest from the first second.

  // native plugins agents can call (real capabilities, not demo data)
  const plugins: [string, string, boolean][] = [
    ["GitHub", "Commit, push & open PRs from the workspace.", true],
    ["Telegram", "Route reports and alerts to a channel.", true],
    ["Vault", "Encrypted secret storage for provider keys.", true],
    ["Web Search", "Let agents look things up while planning.", true],
  ];
  for (const [name, description, enabled] of plugins)
    db.insert(s.plugin).values({ id: uid(), workspaceId: wsId, name, description, enabled, native: true }).run();

  // welcome notification

  // mark this org active on the session
  db.update(s.session).set({ activeOrgId: orgId }).where(eq(s.session.userId, userId)).run();

  // Done — the client redirects to the CEO Planner, where the operator reviews + clicks "Generate plan"
  // to fire the real CEO ritual (Ada reads the brief/mission/objective/stack).
  return { ok: true };
}

import { eq } from "drizzle-orm";

/** Reset the existing-project analysis so the next plan re-reads the project into specs/SUPER-SPEC.md.
 *  Use after re-importing or if the first pass was thin. The CEO re-analyzes on the next "Generate plan". */
export async function reanalyzeProject(): Promise<{ ok: boolean }> {
  const { workspace } = await requireWorkspace();
  const settings = (workspace.settings ?? {}) as NonNullable<typeof workspace.settings>;
  const src = settings.source;
  if (!src?.type || src.type === "new") return { ok: false };
  db.update(s.workspace).set({ settings: { ...settings, source: { ...src, analyzed: false } } }).where(eq(s.workspace.id, workspace.id)).run();
  return { ok: true };
}
