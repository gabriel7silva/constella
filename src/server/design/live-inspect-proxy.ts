import "server-only";
import http from "node:http";
import net from "node:net";
import zlib from "node:zlib";
import { LIVE_INSTRUMENT } from "@/lib/design/live-instrument";

/**
 * Phase 3b — the LIVE-app inspect PROXY. The project's dev server is a raw child process (no middleware), and
 * the Live-canvas iframe is CROSS-origin to the Constella app, so the host can't reach into it to inject the
 * inspector. This thin proxy sits in front of the dev server: it forwards every request, INJECTS the
 * live-instrument (lib/design/live-instrument.ts) into HTML responses, and passes WebSocket upgrades straight
 * through so the dev server's HMR keeps working. Framework-agnostic (any stack). One proxy per workspace.
 *
 * Used only while the operator toggles "Inspect" in the Live canvas; with Inspect off the iframe points at the
 * raw dev URL (zero proxy overhead). Honest limits: HMR-over-WS behind a proxy can be finicky per framework
 * (host/origin checks) — if it doesn't auto-repaint, the operator reloads the frame; the click→Grace targeting
 * works regardless. Local only (binds 127.0.0.1, forwards to 127.0.0.1).
 */

type Proxy = { server: http.Server; port: number; devUrl: string; host: string; tport: number };
const PROXIES = new Map<string, Proxy>(); // workspaceId → proxy
const TAG = `<script data-cstla-live-instrument>${LIVE_INSTRUMENT}</script>`;

function freePort(start = 5100, end = 5400): Promise<number> {
  return new Promise((resolve, reject) => {
    const tryPort = (p: number) => {
      if (p > end) return reject(new Error("no free port"));
      const srv = net.createServer();
      srv.once("error", () => tryPort(p + 1));
      srv.once("listening", () => srv.close(() => resolve(p)));
      srv.listen(p, "127.0.0.1");
    };
    tryPort(start);
  });
}

function injectHtml(body: string): string {
  return /<\/body>/i.test(body) ? body.replace(/<\/body>/i, `${TAG}</body>`) : body + TAG;
}

/** Ensure an inspect proxy is running in front of `devUrl` for this workspace; returns its local URL. */
export async function ensureInspectProxy(workspaceId: string, devUrl: string): Promise<{ url: string; port: number } | null> {
  const existing = PROXIES.get(workspaceId);
  if (existing && existing.devUrl === devUrl && existing.server.listening) return { url: `http://127.0.0.1:${existing.port}`, port: existing.port };
  if (existing) { try { existing.server.close(); } catch { /* ignore */ } PROXIES.delete(workspaceId); }

  let host: string, tport: number;
  try { const u = new URL(devUrl); host = u.hostname; tport = Number(u.port) || (u.protocol === "https:" ? 443 : 80); }
  catch { return null; }

  const server = http.createServer((req, res) => {
    const headers: Record<string, string | string[] | undefined> = { ...req.headers };
    delete headers["accept-encoding"];                 // force uncompressed so we can inject into HTML
    headers["host"] = `${host}:${tport}`;
    const preq = http.request({ host, port: tport, method: req.method, path: req.url, headers }, (pres) => {
      const ct = String(pres.headers["content-type"] || "");
      if (/text\/html/i.test(ct)) {
        const chunks: Buffer[] = [];
        pres.on("data", (c: Buffer) => chunks.push(c));
        pres.on("end", () => {
          // We drop accept-encoding upstream to get plain HTML, but some dev servers/CDNs force-compress
          // anyway. Decompress before injecting (and before we strip content-encoding below) so the browser
          // doesn't receive undecoded bytes → a blank/broken Inspect canvas.
          let body = Buffer.concat(chunks);
          const enc = String(pres.headers["content-encoding"] || "").toLowerCase();
          try {
            if (enc.includes("br")) body = zlib.brotliDecompressSync(body);
            else if (enc.includes("gzip")) body = zlib.gunzipSync(body);
            else if (enc.includes("deflate")) body = zlib.inflateSync(body);
          } catch { /* header lied / not actually compressed — inject the raw bytes */ }
          const out = injectHtml(body.toString("utf8"));
          const h: Record<string, string | string[] | undefined> = { ...pres.headers };
          delete h["content-length"]; delete h["content-encoding"]; delete h["transfer-encoding"];
          try { res.writeHead(pres.statusCode || 200, h as http.OutgoingHttpHeaders); res.end(out); } catch { /* client gone */ }
        });
        pres.on("error", () => { try { res.destroy(); } catch { /* ignore */ } });
      } else {
        try { res.writeHead(pres.statusCode || 200, pres.headers); } catch { /* ignore */ }
        pres.pipe(res);
      }
    });
    preq.on("error", () => { try { res.writeHead(502); res.end("inspect proxy: upstream error"); } catch { /* ignore */ } });
    req.pipe(preq);
  });

  // WebSocket / HMR passthrough: tunnel the upgrade to the dev server, then pipe both directions.
  server.on("upgrade", (req, socket, head) => {
    const up = net.connect(tport, host, () => {
      const lines = [`${req.method} ${req.url} HTTP/1.1`];
      for (const [k, v] of Object.entries(req.headers)) {
        if (v == null) continue;
        if (Array.isArray(v)) for (const vv of v) lines.push(`${k}: ${vv}`);
        else lines.push(`${k}: ${v}`);
      }
      up.write(lines.join("\r\n") + "\r\n\r\n");
      if (head && head.length) up.write(head);
      up.pipe(socket); socket.pipe(up);
    });
    up.on("error", () => { try { socket.destroy(); } catch { /* ignore */ } });
    socket.on("error", () => { try { up.destroy(); } catch { /* ignore */ } });
  });

  let port: number;
  try { port = await freePort(); } catch { return null; }
  try {
    await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(port, "127.0.0.1", () => { server.removeListener("error", reject); resolve(); }); });
  } catch { return null; }

  PROXIES.set(workspaceId, { server, port, devUrl, host, tport });
  return { url: `http://127.0.0.1:${port}`, port };
}

export function stopInspectProxy(workspaceId: string): void {
  const p = PROXIES.get(workspaceId);
  if (p) { try { p.server.close(); } catch { /* ignore */ } PROXIES.delete(workspaceId); }
}

export function stopAllInspectProxies(): void {
  for (const id of [...PROXIES.keys()]) stopInspectProxy(id);
}
