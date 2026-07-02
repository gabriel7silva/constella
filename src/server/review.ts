import "server-only";
import { randomUUID as uid } from "node:crypto";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/db";
import { agent, finding, skill, agentSkill, costEntry, workspace as workspaceTable } from "@/db/schema";
import { runAgentStream, pickBinary, strongestModelFor } from "@/server/adapters/cli";
import { kbQuery, ingestKnowledge } from "@/server/kb";
import { emit } from "@/server/events";

/**
 * Automated, INDEPENDENT code-review of a finished task's diff — the strongest model of the reviewer's
 * provider, grounded in the reviewer's review skills + the project KB, scoped to the files the task
 * touched. High-severity findings BLOCK (the runner holds the task at `review`); every finding is filed
 * to the `finding` table + captured to the KB. Reuses the runReview pattern (modules.ts). Session-less:
 * the runner picks a reviewer that is NOT the task's author and calls this as a third completion gate.
 */

type Ws = typeof workspaceTable.$inferSelect;
type Ag = typeof agent.$inferSelect;

const REVIEW_SKILLS = ["code-review-practices", "review-code-perf-security", "owasp-top-10", "secrets-management", "appsec-fundamentals"];

export type ReviewFinding = { sev: "high" | "med" | "low"; title: string; file: string; suggestion: string };
export type ReviewResult = { ran: boolean; blocking: boolean; findings: ReviewFinding[] };

export async function reviewTaskChange(orgId: string, ws: Ws, reviewer: Ag, taskTitle: string, touchedPaths: string[]): Promise<ReviewResult> {
  const paths = [...new Set(touchedPaths.filter(Boolean))].slice(0, 40);
  if (!paths.length) return { ran: false, blocking: false, findings: [] };

  const runId = uid();
  await emit(ws.id, { runId, channel: "security", agentId: reviewer.id, kind: "thinking", target: `${reviewer.name} is reviewing ${taskTitle}…` });

  // Ground the review: the reviewer's review/security skills + the project KB (prior findings, decisions).
  const sk = await db.select({ name: skill.name, instructions: skill.instructions, summary: skill.summary })
    .from(agentSkill).innerJoin(skill, eq(agentSkill.skillId, skill.id))
    .where(and(eq(agentSkill.agentId, reviewer.id), inArray(skill.name, REVIEW_SKILLS)));
  const skillsBlock = sk.length ? `\nApply these review skills (consult before judging):\n${sk.map((s) => `- ${s.name}: ${(s.instructions || s.summary).replace(/\s+/g, " ").slice(0, 300)}`).join("\n")}` : "";
  const kb = await kbQuery(orgId, `code review of ${taskTitle}: correctness, security, secret exposure, prior findings, decisions, patterns`, { agentHandle: reviewer.handle, k: 6 });
  const kbBlock = kb.context ? `\nProject knowledge (prior findings, decisions, patterns — do not contradict):\n${kb.context}` : "";

  const prompt = [
    `You are ${reviewer.name}, an INDEPENDENT code reviewer. Review ONLY the files just changed in the current workspace directory for correctness bugs, security / secret-token exposure, permission & workspace-isolation issues, and risky patterns. Files changed:`,
    paths.map((p) => `- ${p}`).join("\n"),
    skillsBlock,
    kbBlock,
    `Output ONLY a JSON array (no prose, no markdown fences) of REAL, specific problems — empty [] if the change is sound:`,
    `[{"sev":"high"|"med"|"low","title":"short title","file":"relative/path","suggestion":"concrete fix"}]`,
    `Be strict but precise — do not invent issues, do not nitpick style. Do NOT modify any files.`,
  ].filter(Boolean).join("\n");

  const binary = pickBinary(reviewer.adapter, reviewer.model);
  const model = strongestModelFor(reviewer.adapter); // quality over cost for review
  const res = await runAgentStream(prompt, { orgId, binary, model, timeoutMs: 240_000 },
    (ev) => { void emit(ws.id, { runId, channel: "security", agentId: reviewer.id, kind: ev.kind, target: ev.target, detail: ev.detail }); });

  let arr: { sev?: string; title?: string; file?: string; suggestion?: string }[] = [];
  const m = res.text.match(/\[[\s\S]*\]/);
  if (m) { try { arr = JSON.parse(m[0]); } catch { arr = []; } }
  const findings: ReviewFinding[] = arr.slice(0, 40).map((f) => ({
    sev: f.sev === "high" || f.sev === "low" ? f.sev : "med",
    title: String(f.title ?? "Finding").slice(0, 200),
    file: String(f.file ?? "").slice(0, 300),
    suggestion: String(f.suggestion ?? "").slice(0, 500),
  }));

  for (const f of findings) {
    await db.insert(finding).values({ id: uid(), workspaceId: ws.id, sev: f.sev, title: f.title, file: f.file, suggestion: f.suggestion, status: "open" });
  }
  if (findings.length) {
    void ingestKnowledge(orgId, findings.map((f) => ({
      type: "vuln" as const, title: f.title.slice(0, 120), summary: `${f.sev}: ${f.suggestion}`.slice(0, 1000),
      paths: f.file ? [f.file] : undefined, agentHandle: reviewer.handle, sourceKind: "review", sourceRef: `${f.file}::${f.title}`.slice(0, 200),
    }))).catch(() => {});
  }
  if (res.usd > 0 || res.inputTokens + res.outputTokens > 0) {
    await db.insert(costEntry).values({ id: uid(), workspaceId: ws.id, agentId: reviewer.id, provider: res.binary, model: res.model ?? reviewer.model, usd: res.usd, tokens: res.inputTokens + res.outputTokens, at: new Date() });
  }
  await emit(ws.id, { runId, channel: "security", agentId: reviewer.id, kind: "done", target: `${findings.length} finding(s)` });

  return { ran: true, blocking: findings.some((f) => f.sev === "high"), findings };
}
