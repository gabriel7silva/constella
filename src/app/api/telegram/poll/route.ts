import { NextResponse, type NextRequest } from "next/server";
import { pollTelegram } from "@/server/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Worker-triggered Telegram poll. Fail-closed: requires the shared worker secret. */
export async function POST(req: NextRequest) {
  const secret = process.env.CONSTELLA_WORKER_SECRET;
  if (!secret || req.headers.get("x-worker-secret") !== secret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  try {
    const r = await pollTelegram();
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
