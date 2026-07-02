import "server-only";
import { randomUUID as uid } from "node:crypto";
import { db } from "@/db";
import { costEntry } from "@/db/schema";
import { runAgentStream, type CliBinary } from "@/server/adapters/cli";
import { emit } from "@/server/events";
import { readWorkspaceFile, writeWorkspaceFile } from "@/lib/fs-workspace";

/**
 * First-run analysis of an EXISTING project (imported repo / copied local dir / attached mock).
 * Runs a real agent pass (cwd = workspace, reads files literally), streamed to the "planner"
 * channel, that writes a growing `specs/SUPER-SPEC.md` describing the current system. Called once
 * per project by generatePlan BEFORE it drafts specs/issues, so the plan is grounded in reality and
 * the agents extend the existing system instead of building a second separate prototype.
 */
const SUPER_SPEC = "specs/SUPER-SPEC.md";

export async function analyzeExistingProject(opts: {
  orgId: string; wsId: string; ada: { id: string; name: string }; binary: CliBinary; model?: string;
}): Promise<{ ok: boolean; bytes: number; error?: string }> {
  const { orgId, wsId, ada, binary, model } = opts;
  const prompt = [
    `You are ${ada.name}, analyzing an EXISTING project that is ALREADY present in this workspace (the current directory). Do NOT write any product code, do NOT scaffold anything — your ONLY job is to UNDERSTAND the project and write a thorough "super spec".`,
    ``,
    `Read in THIS order, then go deeper:`,
    `1. Docs first: README*, CHANGELOG*, docs/**, any install/setup/usage guides, CONTRIBUTING.`,
    `2. Manifests + config: package.json, pyproject.toml, go.mod, Cargo.toml, requirements.txt, tsconfig, .env.example, *.config.*, docker/compose files, CI files.`,
    `3. Then SCAN THE SOURCE FILE-BY-FILE (skip node_modules, dist, build, .next, .git, vendor): read the actual code to understand it — do not guess.`,
    ``,
    `Then WRITE the file specs/SUPER-SPEC.md (create/overwrite it) with these sections, filled with REAL, concrete detail grounded in what you read:`,
    `## Overview & purpose · ## Architecture & layers · ## Tech stack & dependencies · ## Directory / module map · ## Frontend (components, routes, state) · ## Backend (services, APIs, jobs) · ## Data model & database · ## Auth & security · ## Integrations / external services · ## Business rules & key flows · ## What is mock/stubbed vs real · ## Gaps to make it production-real.`,
    ``,
    `If this is a visual mock/prototype (only \`mock/\` files — markup/styles/scripts, no real backend), INFER the intended tech stack from its HTML/CSS/JS and state it EXPLICITLY in the "Tech stack & dependencies" section (e.g. plain HTML/CSS/JS static, React, Next.js, Vue, Tailwind) so the plan adopts it.`,
    `CRITICAL framing for the team that will plan next: explicitly call out which UI/UX, behavior and visual identity MUST be PRESERVED, and where real backend, data and integrations must be ADDED. Constella will EXTEND this exact system — never build a second separate prototype, never replace what exists.`,
    `If the repo is large, prioritize breadth: read every manifest + entry point and sample representative files per module; never read generated/vendored dirs. Keep writing into specs/SUPER-SPEC.md as you learn (it is a living document).`,
    `When done, reply with a 2-3 sentence summary of the system.`,
  ].join("\n");

  const runId = uid();
  await emit(wsId, { runId, channel: "planner", agentId: ada.id, kind: "thinking", target: `${ada.name} is reading the existing project…` });
  let res;
  try {
    res = await runAgentStream(prompt, { orgId, binary, model, timeoutMs: 600_000 },
      (ev) => { void emit(wsId, { runId, channel: "planner", agentId: ada.id, kind: ev.kind, target: ev.target, detail: ev.detail }); });
  } catch (e) {
    return { ok: false, bytes: 0, error: String(e instanceof Error ? e.message : e) };
  }

  if (res.usd > 0 || res.inputTokens + res.outputTokens > 0) {
    await db.insert(costEntry).values({ id: uid(), workspaceId: wsId, agentId: ada.id, provider: res.binary, model: res.model ?? model ?? "", usd: res.usd, tokens: res.inputTokens + res.outputTokens, at: new Date() });
  }

  // Ensure the deliverable exists even if the agent forgot to write the file.
  let existing = readWorkspaceFile(orgId, SUPER_SPEC);
  if ((!existing || existing.trim().length < 80) && res.text.trim()) {
    writeWorkspaceFile(orgId, SUPER_SPEC, `# Super Spec — existing system analysis\n\n${res.text.trim()}\n`);
    existing = readWorkspaceFile(orgId, SUPER_SPEC);
  }
  const bytes = existing?.length ?? 0;
  return { ok: bytes > 0, bytes };
}
