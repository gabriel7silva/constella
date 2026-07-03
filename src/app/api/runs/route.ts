import { NextResponse } from "next/server";
import { getActiveOrg, getSession, getWorkspace } from "@/lib/workspace";
import { cancelRunToken, stopAllRunsForWorkspace } from "@/server/run-control";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireRouteWorkspace() {
  const session = await getSession();
  if (!session) return { ok: false as const, status: 401, error: "unauthorized" };
  const org = await getActiveOrg(session.user.id, session.session.activeOrgId);
  if (!org) return { ok: false as const, status: 404, error: "organization not found" };
  const workspace = await getWorkspace(org.id);
  if (!workspace) return { ok: false as const, status: 404, error: "workspace not found" };
  return { ok: true as const, workspace };
}

export async function POST(req: Request) {
  const scoped = await requireRouteWorkspace();
  if (!scoped.ok) return NextResponse.json({ ok: false, error: scoped.error }, { status: scoped.status });
  const body = (await req.json().catch(() => ({}))) as { token?: unknown; all?: unknown };
  if (body.all === true) {
    const r = await stopAllRunsForWorkspace(scoped.workspace.id);
    return NextResponse.json(r, { headers: { "cache-control": "no-store" } });
  }
  const token = typeof body.token === "string" ? body.token : "";
  if (!token) return NextResponse.json({ ok: false, error: "missing token" }, { status: 400 });
  return NextResponse.json(cancelRunToken(token), { headers: { "cache-control": "no-store" } });
}
