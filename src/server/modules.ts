"use server";

import { randomUUID as uid } from "node:crypto";
import { eq, and, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { routine, plugin, inboxItem, finding, notification, agent, costEntry, workspace as workspaceTable, skill, agentSkill } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";
import { runAgent, runAgentStream, pickBinary, strongestModelFor } from "@/server/adapters/cli";
import { ingestKnowledge, kbQuery } from "@/server/kb";
import { emit } from "@/server/events";
import { notifyOps } from "@/lib/notify";
import { writeDoc } from "@/lib/workspace-doc";

export async function toggleRoutine(id: string, on: boolean) {
  const { workspace } = await requireWorkspace();
  await db.update(routine).set({ enabled: on }).where(and(eq(routine.id, id), eq(routine.workspaceId, workspace.id)));
  revalidatePath("/routines");
}

/** Operator creates a routine (agents also generate them; this lets the operator add their own). */
export async function createRoutine(input: { name: string; cmd: string; freq: string; agentId?: string }) {
  const { workspace } = await requireWorkspace();
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Name the routine." };
  await db.insert(routine).values({
    id: uid(), workspaceId: workspace.id, name: name.slice(0, 120),
    cmd: (input.cmd ?? "").trim().slice(0, 500), freq: (input.freq ?? "Daily").trim() || "Daily",
    agentId: input.agentId || null, enabled: true,
  });
  revalidatePath("/routines");
  return { ok: true };
}

export async function deleteRoutine(id: string) {
  const { workspace } = await requireWorkspace();
  await db.delete(routine).where(and(eq(routine.id, id), eq(routine.workspaceId, workspace.id)));
  revalidatePath("/routines");
}

export async function togglePlugin(id: string, on: boolean) {
  const { workspace } = await requireWorkspace();
  await db.update(plugin).set({ enabled: on }).where(and(eq(plugin.id, id), eq(plugin.workspaceId, workspace.id)));
  revalidatePath("/plugins");
}

export async function resolveInbox(id: string) {
  const { workspace } = await requireWorkspace();
  await db.delete(inboxItem).where(and(eq(inboxItem.id, id), eq(inboxItem.workspaceId, workspace.id)));
  revalidatePath("/inbox");
}

/** Code Review Agent patches a finding and files a report. */
export async function fixFinding(id: string) {
  const { workspace } = await requireWorkspace();
  await db.update(finding).set({ status: "fixed" }).where(and(eq(finding.id, id), eq(finding.workspaceId, workspace.id)));
  await db.insert(notification).values({ id: uid(), workspaceId: workspace.id, kind: "security", text: "Finding patched by the Code Review Agent", detail: "A security finding was fixed and a report was filed." });
  revalidatePath("/security");
}

/** Real code review — the security agent runs the CLI over the workspace and files real findings. */
export async function runReview() {
  const { org, workspace } = await requireWorkspace();
  const agents = await db.select().from(agent).where(eq(agent.workspaceId, workspace.id));
  const cyber = agents.find((a) => a.handle === "whitfield") ?? agents.find((a) => /cyber|sec/i.test(a.role)) ?? agents[0];
  const runId = uid();
  if (!cyber) return { ok: false, count: 0, runId, error: "no agent" };

  // Live feedback: mark the reviewer working + stream its steps to the "security" channel.
  await db.update(agent).set({ status: "working" }).where(eq(agent.id, cyber.id));
  await emit(workspace.id, { runId, channel: "security", agentId: cyber.id, kind: "thinking", target: `${cyber.name} is reviewing the workspace…` });

  // Ground the review in real, current knowledge: the reviewer's security/review skills + the project
  // KB (prior findings, decisions, patterns). Review must consult these before judging anything.
  const SEC_SKILLS = ["owasp-top-10", "owasp-asvs", "appsec-fundamentals", "secrets-management", "secure-auth-sessions", "dependency-supply-chain", "review-code-perf-security", "code-review-practices"];
  const sec = await db.select({ name: skill.name, instructions: skill.instructions, summary: skill.summary })
    .from(agentSkill).innerJoin(skill, eq(agentSkill.skillId, skill.id))
    .where(and(eq(agentSkill.agentId, cyber.id), inArray(skill.name, SEC_SKILLS)));
  const skillsBlock = sec.length ? `\nApply these review skills (consult before judging):\n${sec.map((s) => `- ${s.name}: ${(s.instructions || s.summary).replace(/\s+/g, " ").slice(0, 300)}`).join("\n")}` : "";
  const kb = await kbQuery(org.id, "security review: vulnerabilities, auth, secrets, prior findings and decisions", { agentHandle: cyber.handle, k: 6 });
  const kbBlock = kb.context ? `\nProject knowledge (prior findings, decisions, patterns — do not contradict):\n${kb.context}` : "";

  const prompt = [
    `You are ${cyber.name}, the security reviewer. Review the code in the current workspace directory for vulnerabilities, secret/token exposure, permission & workspace-isolation issues, and risky patterns.`,
    skillsBlock,
    kbBlock,
    `Output ONLY a JSON array (no prose, no markdown fences) of findings:`,
    `[{"sev":"high"|"med"|"low","title":"short title","file":"relative/path","suggestion":"how to fix"}]`,
    `If the workspace is clean or empty, output []. Do not modify any files.`,
  ].filter(Boolean).join("\n");
  const binary = pickBinary(cyber.adapter, cyber.model);
  // Review ALWAYS uses the strongest model of the reviewer's provider — quality over cost here.
  const model = strongestModelFor(cyber.adapter);
  const res = await runAgentStream(prompt, { orgId: org.id, binary, model, timeoutMs: 240_000 },
    (ev) => { void emit(workspace.id, { runId, channel: "security", agentId: cyber.id, kind: ev.kind, target: ev.target, detail: ev.detail }); });

  let arr: { sev?: string; title?: string; file?: string; suggestion?: string }[] = [];
  const m = res.text.match(/\[[\s\S]*\]/);
  if (m) { try { arr = JSON.parse(m[0]); } catch { arr = []; } }

  for (const f of arr.slice(0, 40)) {
    const sev = f.sev === "high" || f.sev === "low" ? f.sev : "med";
    await db.insert(finding).values({
      id: uid(), workspaceId: workspace.id, sev, title: String(f.title ?? "Finding").slice(0, 200),
      file: String(f.file ?? ""), suggestion: String(f.suggestion ?? ""), status: "open",
    });
  }
  // KB capture: each finding becomes durable security knowledge the reviewer (and others) recall.
  if (arr.length) void ingestKnowledge(org.id, arr.slice(0, 40).map((f) => ({
    type: "vuln" as const, title: String(f.title ?? "Finding").slice(0, 120),
    summary: `${f.sev ?? "med"}: ${String(f.suggestion ?? "")}`.slice(0, 1000),
    paths: f.file ? [String(f.file)] : undefined,
    agentHandle: cyber.handle, sourceKind: "review", sourceRef: `${String(f.file ?? "")}::${String(f.title ?? "")}`.slice(0, 200),
  }))).catch(() => {});
  if (res.usd > 0 || res.inputTokens + res.outputTokens > 0) {
    await db.insert(costEntry).values({ id: uid(), workspaceId: workspace.id, agentId: cyber.id, provider: res.binary, model: res.model ?? cyber.model, usd: res.usd, tokens: res.inputTokens + res.outputTokens, at: new Date() });
  }
  await db.update(workspaceTable).set({ settings: { ...(workspace.settings ?? {}), lastSecurityRun: Date.now() } }).where(eq(workspaceTable.id, workspace.id));
  await db.update(agent).set({ status: "idle" }).where(eq(agent.id, cyber.id));

  // Real Report artifact on disk (write-through + indexed → appears in /reports).
  const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
  const body = `# Security review\n\n_By @${cyber.handle} (${cyber.role}) · ${ts}_\n\n` +
    (arr.length
      ? `Filed ${arr.length} finding(s):\n\n` + arr.slice(0, 40).map((f) => `- **${f.sev ?? "med"}** ${f.title ?? "Finding"} — \`${f.file ?? "?"}\`\n  - ${f.suggestion ?? ""}`).join("\n") + "\n"
      : "No findings — the workspace looks clean.\n");
  try { await writeDoc(org.id, "Reports/security-review.md", body); } catch (e) { console.error("[review] security report write failed:", e); }
  await emit(workspace.id, { runId, channel: "security", agentId: cyber.id, kind: res.ok ? "done" : "error", target: res.ok ? `${arr.length} finding(s) filed` : (res.error ?? "review failed").slice(0, 200) });
  await notifyOps(workspace.id, { kind: "security", text: "Security sweep finished", detail: `${cyber.name} filed ${arr.length} finding(s).`, agentId: cyber.id });
  revalidatePath("/security");
  revalidatePath("/", "layout");
  return { ok: res.ok, count: arr.length, runId, error: res.error };
}
