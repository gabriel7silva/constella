import { and, eq, gt, gte, asc } from "drizzle-orm";
import { db } from "@/db";
import { event, message } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";
import { onWake } from "@/server/bus";

// Node runtime (better-sqlite3 is not edge-safe); never cache a live stream.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Server-Sent Events stream for one chat channel. The browser opens ONE connection
 * per visible dock and the server TAILS SQLite for new rows since the client's
 * cursors — so it surfaces BOTH this process's writes and the headless worker's
 * writes (a separate process). An in-process `bus` nudges an immediate flush for
 * same-process writes; a 1s interval covers cross-process (worker) writes. The
 * client dedupes by id, so an occasional boundary repeat is harmless.
 */
export async function GET(req: Request) {
  const { workspace } = await requireWorkspace();
  const wsId = workspace.id;
  const url = new URL(req.url);
  const channel = url.searchParams.get("channel") || "room";
  let evCursor = Number(url.searchParams.get("evCursor") || 0);           // event.seq (ms)
  let msgCursorMs = Number(url.searchParams.get("msgCursor") || 0);        // message.createdAt epoch ms

  const encoder = new TextEncoder();
  let running = false;
  let closed = false;
  let timer: ReturnType<typeof setInterval> | null = null;
  let lifeTimer: ReturnType<typeof setTimeout> | null = null;
  let unsub: (() => void) | null = null;
  // message.createdAt is second-resolution; keep the ids at the cursor boundary so
  // the next `gte` query doesn't re-emit them (the client also dedupes by id).
  let boundaryIds = new Set<string>();

  let teardown = () => {};
  const stream = new ReadableStream({
    async start(controller) {
      // Self-teardown if the client vanished. Next dev's req.signal `abort` is NOT
      // reliable on EventSource close/reconnect/HMR — if writing to the stream throws,
      // the client is gone, so we stop the interval + unsubscribe right here instead of
      // leaking a 1s SQLite poller + bus listener forever.
      const enqueue = (chunk: string): boolean => {
        if (closed) return false;
        try { controller.enqueue(encoder.encode(chunk)); return true; }
        catch { teardown(); return false; }
      };
      const send = (name: string, data: unknown) => enqueue(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`);

      async function tail() {
        if (running || closed) return;
        running = true;
        try {
          const evs = await db.select().from(event)
            .where(and(eq(event.workspaceId, wsId), eq(event.channel, channel), gt(event.seq, evCursor)))
            .orderBy(asc(event.seq)).limit(300);
          for (const e of evs) { send("ev", e); if (e.seq > evCursor) evCursor = e.seq; }

          const msgs = await db.select().from(message)
            .where(and(eq(message.workspaceId, wsId), eq(message.channel, channel), gte(message.createdAt, new Date(msgCursorMs))))
            .orderBy(asc(message.createdAt)).limit(300);
          let maxMs = msgCursorMs;
          for (const m of msgs) {
            const ms = (m.createdAt as Date).getTime();
            if (!boundaryIds.has(m.id)) send("msg", m);
            if (ms > maxMs) maxMs = ms;
          }
          const next = new Set<string>();
          for (const m of msgs) if ((m.createdAt as Date).getTime() === maxMs) next.add(m.id);
          boundaryIds = next;
          msgCursorMs = maxMs;
        } catch { /* transient read error — try again next tick */ } finally { running = false; }
      }

      await tail();           // flush anything since the client's cursors
      send("ready", { channel });

      unsub = onWake(wsId, () => { void tail(); });                 // same-process: instant
      timer = setInterval(() => { if (!closed) { void tail(); enqueue(": ping\n\n"); } }, 1000); // worker + keepalive; ping detects a dead client → teardown
      // Absolute lifetime cap: close after 4 min so any orphaned stream self-expires;
      // the client's EventSource transparently reconnects (resuming from its cursors).
      lifeTimer = setTimeout(() => teardown(), 4 * 60_000);

      teardown = () => {
        if (closed) return;
        closed = true;
        if (timer) { clearInterval(timer); timer = null; }
        if (lifeTimer) { clearTimeout(lifeTimer); lifeTimer = null; }
        if (unsub) { unsub(); unsub = null; }
        try { controller.close(); } catch { /* already closed */ }
      };
      req.signal.addEventListener("abort", teardown);
    },
    cancel() { teardown(); },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "connection": "keep-alive",
      "x-accel-buffering": "no", // disable proxy buffering so frames flush immediately
    },
  });
}
