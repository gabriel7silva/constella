import "server-only";
import { randomUUID as uid } from "node:crypto";
import { eq, and, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { plan, spec, issue, agent, costEntry, message, goal, event, workspace as workspaceTable } from "@/db/schema";
import { runAgentStream, pickBinary, setWebResearch } from "@/server/adapters/cli";
import { detectProject } from "@/server/devserver";
import { analyzeExistingProject } from "@/server/analyze";
import { emit } from "@/server/events";
import { notifyOps } from "@/lib/notify";
import { pushInbox } from "@/server/inbox";
import { writeWorkspaceFile, readWorkspaceFile, listFiles } from "@/lib/fs-workspace";
import { loadLibraryIndex, librarySkillNamesForStack, coreSkillNamesForRole } from "@/server/skills-library";
import { getTelegramConfig, sendTelegramButtons } from "@/lib/telegram";
import { gatherDesignContext, readDesignGate, writeDesignGate, designNeedsPrototype, looksVisual, looksBackendOnly, readDesignPromoted } from "@/server/design/context";

/**
 * Session-LESS planner kickoff — the shared core behind the session action `generatePlan`
 * (planner.ts) AND the channels with no session (the public API; later the CLI/MCP). `server-only`,
 * NOT `"use server"`, so it's never an unauthenticated RPC endpoint: every caller must already be
 * authorized for the workspace. The heavy `runPlanJob` lives here (it can't be a `"use server"`
 * export — that would expose it as an action).
 */

type AdaRow = typeof agent.$inferSelect;

/** Session-less: turn the recent conversation in a channel into a delivery plan (a CEO planning run).
 *  The off-session counterpart to planner.ts `planFromConversation` — used by the Telegram remote so a
 *  "build X" message there actually drafts specs/issues (not just a chat reply). */
export async function planFromConversationFor(orgId: string, ws: typeof workspaceTable.$inferSelect, channel: string): Promise<{ ok: boolean; started?: boolean; error?: string }> {
  const msgs = await db.select().from(message).where(and(eq(message.workspaceId, ws.id), eq(message.channel, channel))).orderBy(desc(message.createdAt)).limit(30);
  const convo = msgs.reverse().map((m) => (m.fromKind === "operator" ? "Operator" : "@" + (m.fromHandle ?? "agent")) + ": " + m.text).join("\n");
  if (!convo.trim()) return { ok: false, error: "No conversation to plan from yet." };
  return generatePlanFor(orgId, ws, { brief: `Turn the operator's request from this chat into a delivery plan. Conversation:\n\n${convo}` });
}

/** Kick off a CEO planning run for an explicit (orgId, workspace). Returns immediately; the heavy
 *  analysis runs detached in `runPlanJob` and streams to the "planner" channel. */
export async function generatePlanFor(orgId: string, workspace: typeof workspaceTable.$inferSelect, opts?: { brief?: string; goalTitle?: string }): Promise<{ ok: boolean; started?: boolean; error?: string }> {
  const agents = await db.select().from(agent).where(eq(agent.workspaceId, workspace.id));
  const ada = agents.find((a) => a.handle === "ada") ?? agents.find((a) => /ceo|chief exec/i.test(a.role)) ?? agents[0];
  if (!ada) return { ok: false, error: "no CEO agent" };
  // Don't start a second CEO run while one is GENUINELY in flight — judge that by the live planner
  // STREAM (a fresh, non-terminal event), NOT by Ada's status flag (which sticks on "working" forever
  // if a prior job's process died before its `finally`). A stale flag with no live run self-recovers.
  // Also bail if a first-plan ANALYSIS is in progress: that phase can stream-silently run up to 10 min
  // (past the 6-min event window below), so the marker is the reliable "a job owns this workspace" signal.
  const gSettings = (workspace.settings ?? {}) as NonNullable<typeof workspaceTable.$inferSelect["settings"]>;
  if (gSettings.source?.analyzing && Date.now() - (gSettings.source?.analyzingAt ?? 0) < 12 * 60_000) {
    return { ok: true, started: false };
  }
  if (ada.status === "working") {
    const [latest] = await db.select({ seq: event.seq, kind: event.kind }).from(event)
      .where(and(eq(event.workspaceId, workspace.id), eq(event.channel, "planner")))
      .orderBy(desc(event.seq)).limit(1);
    const live = !!latest && latest.kind !== "done" && latest.kind !== "error" && Date.now() - latest.seq < 6 * 60_000;
    if (live) return { ok: true, started: false };
    console.warn("[planner] Ada was stuck 'working' with no live run — recovering (a prior plan job died before it reset her).");
  }

  const runId = uid();
  await db.update(agent).set({ status: "working" }).where(eq(agent.id, ada.id));
  await emit(workspace.id, { runId, channel: "planner", agentId: ada.id, kind: "thinking", target: `${ada.name} is analyzing the brief…` });
  try { revalidatePath("/planner"); } catch { /* off-request (API/Telegram) — no-op */ }
  // Heavy CEO analysis runs detached on the persistent node server: survives the response + a client
  // refresh; completion reaches the UI via the "done" event on the planner channel.
  void runPlanJob({ orgId, workspace, ada, agents, runId, opts }).catch((e) => console.error("[planner] background plan job crashed:", e));
  return { ok: true, started: true };
}

/** Start a NEW unit of work for an explicit (orgId, workspace) — validates the brief, then kicks off
 *  a plan run that APPENDS a Goal + specs + issues for approval. */
export async function startNewWorkFor(orgId: string, workspace: typeof workspaceTable.$inferSelect, input: { title?: string; brief: string }): Promise<{ ok: boolean; started?: boolean; error?: string }> {
  const brief = input.brief?.trim();
  if (!brief) return { ok: false, error: "Describe what you want to implement, fix or change." };
  return generatePlanFor(orgId, workspace, { brief, goalTitle: input.title?.trim() || undefined });
}

/** The heavy plan run — analyze (if needed) → CEO drafts specs/issues → persist + emit. Detached from
 *  the request (see generatePlanFor); streams to the "planner" channel and ALWAYS resets Ada to idle. */
async function runPlanJob(ctx: { orgId: string; workspace: typeof workspaceTable.$inferSelect; ada: AdaRow; agents: AdaRow[]; runId: string; opts?: { brief?: string; goalTitle?: string } }): Promise<void> {
  const { orgId, workspace, ada, agents, runId, opts } = ctx;
  const org = { id: orgId };
 try {
  const by = (role?: string) => (role ? agents.find((a) => a.role.toLowerCase() === role.toLowerCase())?.id ?? null : null);
  const binary = pickBinary(ada.adapter, ada.model);
  const model = binary === "claude" ? (ada.model.includes("opus") ? "opus" : ada.model.includes("haiku") ? "haiku" : "sonnet") : undefined;
  setWebResearch(workspace.settings?.agents?.webResearch ?? null); // let Ada research official docs while planning (workspace-gated)
  const roles = Array.from(new Set(agents.map((a) => a.role)));
  // `opts.brief` = a NEW unit of work the operator asked for (CEO Planner "New work" / a DM).
  // Otherwise the workspace's standing brief (the first plan).
  const isNewWork = !!opts?.brief?.trim();
  const brief = (opts?.brief?.trim() || readWorkspaceFile(org.id, ".claude/BRIEF.md") || "");
  const mockFiles = listFiles(org.id).filter((p) => p.startsWith("mock/") && p !== "mock/README.md");
  const stackRec = (workspace.stack ?? {}) as Record<string, string>;
  const stackList = Object.entries(stackRec).map(([k, v]) => `${k}: ${v}`).filter((s) => !s.endsWith(": None")).join(", ");
  const hasFrontend = !!stackRec.frontend && stackRec.frontend !== "None";
  // STACK PLAYBOOK: the seeded native skills (.claude/skills/<name>.md) relevant to this stack across
  // CEO/Frontend/Backend/Security/CTO — so the CEO plans grounded in the chosen technologies + design
  // system, not generically. Names + one-line descriptions; the CEO reads the files it needs.
  const skillIdx = loadLibraryIndex();
  const playbookNames = [...new Set([
    ...librarySkillNamesForStack(stackRec),
    ...coreSkillNamesForRole(stackRec, "Frontend"),
    ...coreSkillNamesForRole(stackRec, "Backend"),
    ...coreSkillNamesForRole(stackRec, "CyberSec"),
    ...coreSkillNamesForRole(stackRec, "CTO"),
  ])].filter((n) => skillIdx.has(n));
  const playbook = playbookNames.map((n) => `- ${n}: ${skillIdx.get(n)!.description}`).join("\n");
  // FIRST-PLAN ANALYSIS: when an existing project is present (imported repo, copied local dir, or
  // attached mock), the very first plan must first UNDERSTAND it — read it file-by-file into a super
  // spec — before drafting specs/issues. Runs once per project (settings.source.analyzed).
  const wsSettings = (workspace.settings ?? {}) as NonNullable<typeof workspaceTable.$inferSelect["settings"]>;
  const srcType = wsSettings.source?.type ?? "new";
  const hasMaterial = srcType !== "new" || mockFiles.length > 0 || !!detectProject(org.id);
  // Re-entrancy guard: the file-by-file analysis runs ONCE per project. Skip if already analyzed, OR if
  // one is in progress and was started recently (< 12 min) — so an impatient re-click, a mid-run restart,
  // or a stream-silent analyze can never double-run the read or clobber a half-written SUPER-SPEC.
  const analyzingFresh = !!wsSettings.source?.analyzing && Date.now() - (wsSettings.source?.analyzingAt ?? 0) < 12 * 60_000;
  if (!isNewWork && hasMaterial && !wsSettings.source?.analyzed && !analyzingFresh) {
    // Mark in-progress BEFORE the slow call so a concurrent kickoff sees it and bails.
    await db.update(workspaceTable).set({ settings: { ...wsSettings, source: { ...(wsSettings.source ?? {}), type: srcType, analyzing: true, analyzingAt: Date.now() } } }).where(eq(workspaceTable.id, workspace.id));
    try {
      await analyzeExistingProject({ orgId: org.id, wsId: workspace.id, ada: { id: ada.id, name: ada.name }, binary, model });
      await db.update(workspaceTable).set({ settings: { ...wsSettings, source: { ...(wsSettings.source ?? {}), type: srcType, analyzed: true, analyzing: false } } }).where(eq(workspaceTable.id, workspace.id));
    } catch (e) {
      console.error("[planner] project analysis failed:", e);
      // Clear the in-progress flag so a real failure can retry on the next kickoff (analyzed stays false).
      try { await db.update(workspaceTable).set({ settings: { ...wsSettings, source: { ...(wsSettings.source ?? {}), type: srcType, analyzing: false } } }).where(eq(workspaceTable.id, workspace.id)); } catch { /* best effort */ }
    }
  }
  const superSpec = !isNewWork ? readWorkspaceFile(org.id, "specs/SUPER-SPEC.md") : null;
  // APPROVED design (Design module) — the official visual reference the operator approved BEFORE planning.
  // When present, every frontend spec/issue must follow it exactly (zero drift).
  const approvedDesign = readWorkspaceFile(org.id, "design-mock/APPROVED.md");
  // Was the approved design PROMOTED into the real source? Then the UI already EXISTS in the project — engineers
  // extend it (add backend on top), they do NOT rebuild it. Changes the whole tone of the frontend issues.
  const promoted = readDesignPromoted(org.id);
  const designClause = !approvedDesign ? ""
    : promoted.at && promoted.served
      ? `\nAPPROVED DESIGN — ALREADY PROMOTED INTO THE SOURCE. The operator approved the UI in the Design module and it was promoted into the project's REAL served frontend (\`${promoted.target}/\` — see design-mock/PROMOTED.md; the dev server already renders these exact screens). Read design-mock/APPROVED.md + design-mock/handoff.md IN FULL. The UI is DONE and is the source of truth — engineers must NOT rebuild, recreate or restyle it. Every frontend issue EXTENDS the promoted screens: wire real data + backend + interactivity + states ON TOP, preserving the markup/CSS exactly (zero drift). Do NOT plan any "build the UI / recreate the screens" issue. Summary:\n${approvedDesign.slice(0, 6000)}`
      : promoted.at && promoted.needsPort
        ? `\nAPPROVED DESIGN — STAGED FOR PORT. The operator approved the UI; it's staged as HTML/CSS in \`${promoted.target}/\` (see design-mock/PROMOTED.md). Plan ONE FIRST frontend issue: PORT these exact screens into ${stackRec.frontend || "the chosen framework"} components 1:1 (zero drift — same markup/layout/tokens), then EXTEND with real data/backend/states ON TOP. Never redesign or invent a different look. Read design-mock/APPROVED.md + handoff.md IN FULL. Summary:\n${approvedDesign.slice(0, 6000)}`
      : promoted.at
        ? `\nAPPROVED DESIGN — PROMOTED (server not yet wired). The approved screens (HTML/CSS) are in \`${promoted.target}/\` (see design-mock/PROMOTED.md). Plan ONE FIRST frontend issue: wire the backend server to SERVE \`${promoted.target}/\` (e.g. static middleware) so the dev server renders these exact screens, then EXTEND with real data/backend/states ON TOP — preserving the markup/CSS exactly. Do NOT recreate the UI. Read design-mock/APPROVED.md + handoff.md IN FULL. Summary:\n${approvedDesign.slice(0, 6000)}`
        : `\nAPPROVED DESIGN — the operator prototyped and APPROVED the product's UI/UX in the Design module BEFORE planning. This is the OFFICIAL VISUAL REFERENCE (design-mock/APPROVED.md). Read it IN FULL now. Every frontend spec/issue MUST follow it EXACTLY — same screens, layout, components, design system, palette, typography, spacing, states and behavior (ZERO drift). Derive the design-system + screen issues straight from it. Summary:\n${approvedDesign.slice(0, 6000)}`;

  // ── DESIGN GATE (Design → Grace → Ada → Execution) ───────────────────────────────────────────────────────
  // A frontend product should be prototyped + APPROVED in the Design module before Ada writes final specs. If
  // there's a frontend, no approved design and no screens yet, and the operator hasn't bypassed, HOLD here:
  // surface "Design step pending", notify the operator (in-app + Telegram) to open Design, and stop. Runs AFTER
  // any existing-project analysis (so SUPER-SPEC exists for Grace to extract the frontend). The plan RESUMES from
  // "Send to execution" (handoffToExecution) once the design is approved. The detached job has no request
  // context, so Grace's foundation scaffold is triggered from the Design module on open — not here.
  {
    const dctx = gatherDesignContext(org.id, workspace);
    const gate = readDesignGate(org.id);
    // Is this a VISUAL product? An explicit frontend stack is the strong signal, but many visual products (a web
    // calculator, a static site, a vanilla-JS app) carry NO `frontend` framework — so also treat a styling stack OR
    // a brief/mission/objective that reads visual (web/app/page/UI/screen…) as visual. When there's NO stack signal
    // at all (everything "None") and the brief isn't clearly backend (API/CLI/service), DEFAULT to visual so a
    // product still routes through Grace. Pure backend/API/CLI briefs skip the gate; the operator can always bypass.
    const visualBlob = [brief, workspace.mission ?? "", workspace.objective ?? "", stackList].join(" ");
    const hasAnyStack = stackList.trim().length > 0;
    const isVisualProduct = hasFrontend
      || (!!stackRec.styling && stackRec.styling !== "None")
      || looksVisual(visualBlob)
      || (!hasAnyStack && !looksBackendOnly(visualBlob)); // no stack + not clearly backend → assume a visual product
    // Hold for Grace when: not prototyped yet (first plan), OR a NEW visual unit of work (New Work / feature) — so
    // every visual request routes through Grace even when a design already exists.
    const needsDesign = designNeedsPrototype(dctx) || (isNewWork && looksVisual(brief));
    if (isVisualProduct && !gate.skip && needsDesign) {
      writeDesignGate(org.id, { requestedPlanAt: Date.now(), brief: opts?.brief, goalTitle: opts?.goalTitle });
      const grace = agents.find((a) => a.handle === "grace") ?? agents.find((a) => /front\s?end|\bui\b|\bux\b|design/i.test(a.role));
      await emit(workspace.id, { runId, channel: "planner", agentId: ada.id, kind: "done", target: "Design step pending — prototype & approve the design, then Send to execution to continue the plan." });
      await notifyOps(workspace.id, {
        kind: "design-pending",
        text: `Design needed before the plan — ${workspace.name}`,
        detail: "This is a frontend product: prototype & approve the UI in the Design module first (fewer reworks, zero drift). Open Design — Grace sets up the foundation — then Send to execution to continue.",
        agentId: grace?.id ?? ada.id, tg: true,
      });
      try { revalidatePath("/planner"); revalidatePath("/design"); } catch { /* no request ctx */ }
      return; // held — the finally block resets Ada to idle
    }
    // "Generate plan anyway" is a ONE-SHOT bypass: if it would have gated but skip was set, consume the skip so the
    // NEXT visual request (this plan's New Work / a later feature) routes through Grace again — never permanently off.
    if (isVisualProduct && needsDesign && gate.skip) { try { writeDesignGate(org.id, { skip: false }); } catch { /* best effort */ } }
  }

  const prompt = [
    `You are ${ada.name} (@${ada.handle}), the CEO of ${workspace.name}.`,
    workspace.mission ? `Mission: ${workspace.mission}` : "",
    workspace.objective ? `Objective: ${workspace.objective}` : "",
    stackList ? `Chosen stack: ${stackList}. Honor it.` : "",
    `If the stack above is missing or partial, INFER the stack from the project brief and the attached mock/prototype (and any imported project) — e.g. a plain HTML/CSS/JS static site, React, Next.js, Node, Laravel — and use it CONSISTENTLY. When the brief or the mock explicitly names technologies, they take precedence over the chosen stack. Record the resolved stack in ARCHITECTURE.md and reflect it in every spec and issue.`,
    playbook ? `\nSTACK PLAYBOOK — these native skills are already seeded in this workspace as .claude/skills/<name>.md. READ the ones relevant to each part of the plan and GROUND every spec, issue and architecture decision in them — plan specifically for the chosen technologies, never generically:\n${playbook}` : "",
    hasFrontend ? `\nThis project has a FRONTEND (${stackRec.frontend}${stackRec.styling && stackRec.styling !== "None" ? " + " + stackRec.styling : ""}). Plan the UI as a real product, not a generic AI look: ${isNewWork ? "ensure the existing design system covers" : "WRITE specs/DESIGN-SYSTEM.md now (in the workspace) covering"} the design system, colour palette, typography, spacing scale, components, responsiveness, accessibility (WCAG), UI/UX patterns, motion & microinteractions, screen behaviour & flows, visual docs, backend integration, tests and performance — grounded in the design + frontend skills in the playbook. Include a dedicated design-system issue assigned to the Frontend role.` : "",
    hasMaterial
      ? `An EXISTING project is already in this workspace (an imported repo, a copied local directory, or an attached mock — see specs/SUPER-SPEC.md). BUILD ON IT: every issue EXTENDS the existing code; PRESERVE the working UI/UX, behavior and visual identity; ADD the missing real backend, data and integrations. Never scaffold a fresh app, never replace what's there, and never create a second separate prototype. When the work is done there must be ONE real, functional version of the project.`
      : `A deterministic RUNNABLE starter for this stack has ALREADY been generated in the workspace (a configured dev server with a themed landing page that boots out of the box). Plan so engineers BUILD THE PRODUCT ON THIS EXISTING STARTER — extend it; never plan to scaffold a new app from scratch or replace the starter. Every issue that touches code must keep the dev server bootable.`,
    superSpec ? `\nThe existing project has been analyzed — read specs/SUPER-SPEC.md IN FULL now. Summary:\n${superSpec.slice(0, 6000)}` : "",
    designClause,
    `Your team roles: ${roles.join(", ")}.`,
    brief ? `\nProject brief:\n${brief.slice(0, 4000)}` : "",
    mockFiles.length ? `\nA visual prototype/mock is attached in the \`mock/\` directory (${mockFiles.length} files: ${mockFiles.slice(0, 14).join(", ")}). READ those files now and design the product to MATCH the mock precisely — same layout, components, copy and flows. Specs/issues should reference the mock.` : "",
    ``,
    isNewWork
      ? `Produce a focused delivery plan for THIS NEW unit of work, grounded in the brief above. Do NOT rewrite ARCHITECTURE.md or RITUALS.md — they belong to the whole company and already exist; only ADD what this work needs.`
      : `Produce the delivery plan grounded in the brief + stack. In the current workspace directory, WRITE two files: ARCHITECTURE.md (system design) and RITUALS.md (team cadences & process).`,
    `Then output ONLY a single JSON object (no markdown fences, no prose):`,
    `{"specs":[{"key":"SPEC-01","title":"...","summary":"...","authorRole":"<one of the team roles>"}],"issues":[{"specKey":"SPEC-01","key":"1","title":"...","prio":"high|med|low","assigneeRole":"<one of the team roles>","skills":["the .claude/skills the assignee must consult, picked from the STACK PLAYBOOK, e.g. vue, design-systems"],"todos":["concrete sub-step","another sub-step"]}]}`,
    `Each issue MUST include 2-5 concrete TODO sub-steps in "todos" (the checklist that tracks progress) AND "skills": the seeded skill names from the STACK PLAYBOOK its assignee will consult before building. Set "prio" honestly (the Product Owner sizes story points + MoSCoW from it later).`,
    `The FIRST spec is the MAIN spec — it defines the overall objective (the Goal). Keep to 3-6 specs and 4-12 issues, grounded in the mission. Use the real team roles above for authorRole/assigneeRole.`,
  ].filter(Boolean).join("\n");

  // Phase marker before the model call — gives a visible "what's happening" line even for CLIs that
  // don't stream tool/text events (only claude streams; codex et al. emit a single final event).
  await emit(workspace.id, { runId, channel: "planner", agentId: ada.id, kind: "thinking", target: hasMaterial ? `${ada.name} is studying the project, brief & mock…` : `${ada.name} is reading the brief, mission & stack…` });
  const res = await runAgentStream(prompt, { orgId: org.id, binary, model, timeoutMs: 300_000 },
    (ev) => { void emit(workspace.id, { runId, channel: "planner", agentId: ada.id, kind: ev.kind, target: ev.target, detail: ev.detail }); });

  if (res.usd > 0 || res.inputTokens + res.outputTokens > 0) {
    await db.insert(costEntry).values({ id: uid(), workspaceId: workspace.id, agentId: ada.id, provider: res.binary, model: res.model ?? ada.model, usd: res.usd, tokens: res.inputTokens + res.outputTokens, at: new Date() });
  }

  let parsed: { specs?: { key: string; title: string; summary?: string; authorRole?: string }[]; issues?: { specKey: string; key: string; title: string; prio?: string; assigneeRole?: string; skills?: string[]; todos?: string[] }[] } | null = null;
  const m = res.text.match(/\{[\s\S]*\}/);
  if (m) { try { parsed = JSON.parse(m[0]); } catch { parsed = null; } }

  if (!parsed || !parsed.specs?.length) {
    await emit(workspace.id, { runId, channel: "planner", agentId: ada.id, kind: "error", target: (res.error ?? "Ada returned no structured plan — try again.").slice(0, 200) });
    await notifyOps(workspace.id, { kind: "info", text: "Planning run produced no parseable plan", detail: (res.error ?? "Ada returned no structured specs — try again.").slice(0, 300), agentId: ada.id });
    return;
  }

  const specList = parsed.specs.slice(0, 8);
  await emit(workspace.id, { runId, channel: "planner", agentId: ada.id, kind: "thinking", target: `Drafting ${specList.length} spec(s) & ${(parsed.issues ?? []).length} issue(s), writing files…` });
  const specIds: Record<string, string> = {};
  // The Goal is the unit of WORK born from the MAIN (first) spec — parent of every issue.
  const mainSpec = specList[0];
  const goalId = uid();
  await db.insert(goal).values({
    id: goalId, workspaceId: workspace.id,
    title: (opts?.goalTitle || (isNewWork ? mainSpec?.title : workspace.objective) || mainSpec?.title || workspace.name).slice(0, 200),
    description: (mainSpec?.summary || workspace.mission || "").slice(0, 600),
    ownerId: ada.id, status: "active", progress: 0,
  });
  // Renumber spec keys CONTINUING from existing specs so a second "New work" plan's SPEC-01
  // can't overwrite the first work's specs/SPEC-01.md on disk (disk is the source of truth).
  const existingSpecCount = (await db.select({ id: spec.id }).from(spec).where(eq(spec.workspaceId, workspace.id))).length;
  const specKeyMap: Record<string, string> = {};
  specList.forEach((sp, idx) => { specKeyMap[sp.key] = `SPEC-${String(existingSpecCount + idx + 1).padStart(2, "0")}`; });
  for (const sp of specList) {
    const id = uid(); specIds[sp.key] = id;
    await db.insert(spec).values({ id, workspaceId: workspace.id, key: specKeyMap[sp.key], title: String(sp.title).slice(0, 200), summary: String(sp.summary ?? "").slice(0, 600), authorId: by(sp.authorRole) ?? ada.id, goalId });
  }
  // The main spec is what the goal was born from.
  if (mainSpec) await db.update(goal).set({ specId: specIds[mainSpec.key] }).where(eq(goal.id, goalId));
  // Sequential issue keys CONTINUING from existing ones (so a second "New work" plan doesn't
  // collide on key "1") — ignore whatever numbering the model emitted.
  const existingCount = (await db.select({ id: issue.id }).from(issue).where(eq(issue.workspaceId, workspace.id))).length;
  const issueList = (parsed.issues ?? []).slice(0, 20).map((it, idx) => ({ ...it, seq: String(existingCount + idx + 1) }));
  // PO grooming (deterministic): sizing is the Product Owner's job, not the CEO's. The CEO sets each
  // issue's PRIORITY; here we derive the story points + MoSCoW from it (high → Must / 8 pts, med →
  // Should / 5, low → Could / 3) so they're never a meaningless 0/blank. The PO/operator refines on
  // the board; this is also where a future real PO estimation pass would write its numbers.
  const PRIO_POINTS: Record<string, number> = { high: 8, med: 5, low: 3 };
  const PRIO_MOSCOW: Record<string, "Must" | "Should" | "Could"> = { high: "Must", med: "Should", low: "Could" };
  let issues = 0;
  for (const it of issueList) {
    const prio = it.prio === "high" || it.prio === "low" ? it.prio : "med";
    await db.insert(issue).values({ id: uid(), workspaceId: workspace.id, specId: specIds[it.specKey] ?? null, goalId, key: it.seq, title: String(it.title).slice(0, 200), prio, points: PRIO_POINTS[prio], moscow: PRIO_MOSCOW[prio], col: "todo", assigneeId: by(it.assigneeRole) });
    issues++;
  }

  // Write the plan artifacts to disk (the directory is the source of truth; feeds RAG + Code).
  for (const sp of specList) {
    const dispKey = specKeyMap[sp.key];
    const its = issueList.filter((i) => i.specKey === sp.key);
    const md = `# ${dispKey} — ${sp.title}\n\n**Author:** ${sp.authorRole ?? "CEO"}\n**Status:** draft (pending approval)\n\n## Summary\n${sp.summary ?? ""}\n\n## Issues\n${its.map((i) => `- ${i.seq} (${i.prio ?? "med"} · ${i.assigneeRole ?? "?"}): ${i.title}`).join("\n") || "_none_"}\n`;
    writeWorkspaceFile(org.id, `specs/${dispKey}.md`, md);
  }
  for (const it of issueList) {
    const todos = (it.todos ?? []).slice(0, 6).map((t) => String(t).slice(0, 160)).filter(Boolean);
    const checklist = todos.length ? `\n## Checklist\n${todos.map((t) => `- [ ] ${t}`).join("\n")}\n` : "";
    const skillNames = (it.skills ?? []).map((sk) => String(sk).trim().toLowerCase()).filter(Boolean).slice(0, 8);
    const skillsMd = skillNames.length ? `**Skills to consult:** ${skillNames.join(", ")}\n` : "";
    writeWorkspaceFile(org.id, `issues/${it.seq}.md`, `# ${it.seq} — ${it.title}\n\n**Spec:** ${specKeyMap[it.specKey] ?? it.specKey}\n**Priority:** ${it.prio ?? "med"}\n**Owner:** ${it.assigneeRole ?? "?"}\n${skillsMd}**Status:** todo (pending approval)\n${checklist}`);
  }
  // The org-wide ritual doc is written once (the first plan); new work must not clobber it.
  if (!isNewWork) writeWorkspaceFile(org.id, "ritual.md", `# Team ritual — ${workspace.name}\n\nHow this organization operates. Agents follow this order; code starts only after the operator approves.\n\n1. CEO (@ada) turns the brief + stack into a plan and specs.\n2. CTO (@linus) writes the architecture (ARCHITECTURE.md → DOCS/Reports).\n3. Product Owner (@donald) grooms the backlog into the sprint board.\n4. Operator reviews & approves the plan, specs and issues (reject → DM the owner to revise).\n5. CEO confirms all approved and asks to start execution.\n6. Engineers pull approved issues; QA gates sign-off; CyberSec reviews every change.\n7. Routines + reports keep the operator informed.\n`);

  // The FIRST plan resets the approval gate. NEW work must NOT un-approve the existing plan
  // — that would halt work already running. Its new issues get approved on the next approve.
  if (!isNewWork) await db.update(plan).set({ stage: 4, approved: false }).where(eq(plan.workspaceId, workspace.id));
  await emit(workspace.id, { runId, channel: "planner", agentId: ada.id, kind: "done", target: `${Object.keys(specIds).length} specs · ${issues} issues drafted` });
  // CEO narrates the plan in the team room.
  await db.insert(message).values({
    id: uid(), workspaceId: workspace.id, channel: "room", fromKind: "agent", fromHandle: ada.handle,
    text: `Plan ready for review: ${Object.keys(specIds).length} specs and ${issues} issues drafted from the brief. Open the CEO Planner and approve to start execution.`,
    createdAt: new Date(),
  });
  // tg:false — the plan-ready push below carries the action buttons; don't also send a plain alert.
  await notifyOps(workspace.id, { kind: "done", text: `${ada.name} drafted ${isNewWork ? "a new work plan" : "the delivery plan"}`, detail: `${Object.keys(specIds).length} specs · ${issues} issues.`, agentId: ada.id, tg: false });
  // The plan needs the operator's approval before any code runs → surface it in the Inbox as
  // an actionable decision (Approve → runs approvePlan). Deduped on (plan, workspace).
  await pushInbox(workspace.id, {
    kind: "approval", refType: "plan", refId: workspace.id, goalId, fromAgentId: ada.id, channel: "room",
    title: `Approve plan — ${workspace.name}`,
    detail: `${Object.keys(specIds).length} spec(s) · ${issues} issue(s) drafted from the brief. Approve to start execution.`,
  });
  // P4 — Telegram remote control: push the plan to the phone with REAL action buttons (approve /
  // start 24/7 / review / reject). Plain text (no Markdown) so an issue title can't break the send.
  // Best-effort + gated on Telegram being configured; the callbacks are handled in server/telegram.ts.
  try {
    const tg = await getTelegramConfig(workspace.id);
    if (tg) {
      await sendTelegramButtons(tg.botToken, tg.chatId,
        `📋 Plan ready — ${workspace.name}\n${Object.keys(specIds).length} spec(s) · ${issues} issue(s) drafted from the brief.\n\nApprove to queue tasks, or Start execution to also run 24/7.`,
        [[{ text: "✅ Approve", data: "approve_plan" }, { text: "▶️ Start execution", data: "start_exec" }],
         [{ text: "📝 Review", data: "review" }, { text: "↩️ Reject", data: "reject_plan" }]]);
    }
  } catch (e) { console.error("[planner] telegram plan-ready push failed:", e); }
  // Best-effort revalidation — this job is detached from a request, so it may no-op (the client also
  // refreshes on the "done" event emitted above).
  try { revalidatePath("/planner"); revalidatePath("/inbox"); revalidatePath("/pm"); revalidatePath("/goals"); } catch { /* no request context */ }
 } catch (e) {
  console.error("[planner] plan job failed:", e);
  try { await emit(workspace.id, { runId, channel: "planner", agentId: ada.id, kind: "error", target: ((e as Error)?.message ?? "Planning failed.").slice(0, 200) }); } catch { /* ignore */ }
  try { await notifyOps(workspace.id, { kind: "info", text: "Planning run failed", detail: ((e as Error)?.message ?? "").slice(0, 300), agentId: ada.id }); } catch { /* ignore */ }
 } finally {
  try { await db.update(agent).set({ status: "idle" }).where(eq(agent.id, ada.id)); } catch { /* best effort */ }
 }
}
