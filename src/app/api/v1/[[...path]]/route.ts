import { NextResponse, type NextRequest } from "next/server";
import { authenticatePAT } from "@/server/api/pat-auth";
import { apiStatus, apiGoals, apiIssues, apiTasks, apiSpecs } from "@/server/api/service";
import { approvePlanFor, setAuto247For, requestPlanChangesFor, reviewSummaryFor } from "@/server/plan-ops";
import { cancelGoalFor, archiveGoalFor } from "@/server/work-ops";
import { startNewWorkFor } from "@/server/planner-core";
import { kbAnswer } from "@/server/kb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public REST API v1 — external systems (scripts, CI, mobile, an MCP server) drive Constella with a
 * Personal Access Token. ONE dispatcher so auth + scope + rate-limit + error envelope live in a
 * single place; mutations reuse the SAME session-less cores the Telegram remote control uses
 * (plan-ops.ts / work-ops.ts). Auth: Authorization: Bearer cn_… ; org choice: X-Constella-Org.
 *
 *   GET  /api/v1            (or /me)        → token + org + workspace + scope
 *   GET  /api/v1/status                     → counts (goals/issues/tasks/plan)
 *   GET  /api/v1/review                     → mobile-style text summary
 *   GET  /api/v1/{goals|issues|tasks|specs} → list
 *   GET  /api/v1/kb?q=…                      → Knowledge Base answer
 *   POST /api/v1/plan/approve     (write)   → approve plan, queue tasks
 *   POST /api/v1/plan/reject      (write)   → send plan back {reason?}
 *   POST /api/v1/execution        (write)   → 24/7 on/off {on}
 *   POST /api/v1/goals/{id}/cancel  (write) → cancel goal
 *   POST /api/v1/goals/{id}/archive (write) → archive goal
 *   POST /api/v1/kb               → Knowledge Base answer {q}
 */

// Best-effort in-memory rate limit per token (sliding 60s). The API runs in the single Next server
// process, so this is shared across requests; a restart resets it (acceptable for a single operator).
const RL = new Map<string, number[]>();
const RL_MAX = 120;
function rateLimited(tokenId: string): boolean {
  const now = Date.now();
  const arr = (RL.get(tokenId) ?? []).filter((t) => now - t < 60_000);
  arr.push(now);
  RL.set(tokenId, arr);
  return arr.length > RL_MAX;
}

const ok = (data: unknown, status = 200) => NextResponse.json({ ok: true, data }, { status });
const fail = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status });

async function dispatch(req: NextRequest, parts: string[], method: "GET" | "POST"): Promise<NextResponse> {
  const a = await authenticatePAT(req.headers.get("authorization"), req.headers.get("x-constella-org"));
  if (!a.ok) return fail(a.status, a.error);
  const { auth } = a;
  if (rateLimited(auth.tokenId)) return fail(429, "rate limit exceeded (120 req/min)");
  const ws = auth.workspace;
  const route = parts.join("/");
  const write = auth.scope === "write";
  const needWrite = () => (write ? null : fail(403, "this token has read scope; a write-scope token is required"));

  if (method === "GET") {
    switch (route) {
      case "":
      case "me":
        return ok({ user: auth.userId, org: { id: auth.org.id, name: auth.org.name }, workspace: { id: ws.id, name: ws.name, slug: ws.slug }, scope: auth.scope });
      case "status": return ok(await apiStatus(ws));
      case "review": return ok({ text: await reviewSummaryFor(ws) });
      case "goals": return ok(await apiGoals(ws.id));
      case "issues": return ok(await apiIssues(ws.id));
      case "tasks": return ok(await apiTasks(ws.id));
      case "specs": return ok(await apiSpecs(ws.id));
      case "kb": {
        const q = req.nextUrl.searchParams.get("q") ?? "";
        if (!q.trim()) return fail(400, "missing ?q=");
        const r = await kbAnswer(auth.org.id, q);
        return ok({ text: r.text, sources: r.sources });
      }
      default: return fail(404, `unknown GET /${route}`);
    }
  }

  // POST — mutations require write scope (KB query is the read-ish exception).
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  switch (route) {
    case "plan/approve": return needWrite() ?? ok(await approvePlanFor(auth.org.id, ws));
    case "plan/reject": {
      const denied = needWrite(); if (denied) return denied;
      await requestPlanChangesFor(ws.id, typeof body.reason === "string" ? body.reason : undefined);
      return ok({ rejected: true });
    }
    case "execution": {
      const denied = needWrite(); if (denied) return denied;
      const on = body.on !== false; // default true
      await setAuto247For(ws.id, on);
      return ok({ auto247: on });
    }
    case "work": {
      const denied = needWrite(); if (denied) return denied;
      const brief = typeof body.brief === "string" ? body.brief : "";
      const title = typeof body.title === "string" ? body.title : undefined;
      const r = await startNewWorkFor(auth.org.id, ws, { brief, title });
      return r.ok ? ok(r) : fail(400, r.error ?? "could not start work");
    }
    case "kb": {
      const q = typeof body.q === "string" ? body.q : "";
      if (!q.trim()) return fail(400, "missing body.q");
      const r = await kbAnswer(auth.org.id, q);
      return ok({ text: r.text, sources: r.sources });
    }
    default: {
      // goals/{id}/cancel | goals/{id}/archive
      if (parts[0] === "goals" && parts.length === 3) {
        const denied = needWrite(); if (denied) return denied;
        const id = parts[1];
        if (parts[2] === "cancel") { const r = await cancelGoalFor(ws.id, id); return r.ok ? ok(r) : fail(404, "goal not found"); }
        if (parts[2] === "archive") { const r = await archiveGoalFor(auth.org.id, ws.id, id); return r.ok ? ok(r) : fail(404, "goal not found"); }
      }
      return fail(404, `unknown POST /${route}`);
    }
  }
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  try { const { path } = await ctx.params; return await dispatch(req, path ?? [], "GET"); }
  catch (e) { return fail(500, String(e instanceof Error ? e.message : e)); }
}
export async function POST(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  try { const { path } = await ctx.params; return await dispatch(req, path ?? [], "POST"); }
  catch (e) { return fail(500, String(e instanceof Error ? e.message : e)); }
}
