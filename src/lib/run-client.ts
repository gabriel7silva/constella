/**
 * A client-safe run/abort token (RFC-4122 v4). `crypto.randomUUID()` is ONLY defined in a SECURE
 * CONTEXT (HTTPS, or http on localhost/127.0.0.1). Constella's `--vps` mode is reached over PLAIN
 * HTTP on a Tailscale/LAN IP (e.g. http://100.84.143.4:3000), which is NOT a secure context — there
 * `crypto.randomUUID` is `undefined`, so calling it THROWS. That throw happened right after the
 * operator's message was sent but before `agentRespond`, and the chat's `catch` swallowed it, so on
 * a VPS every chat/design reply silently never fired (worked only via localhost on Windows). Fall
 * back to `crypto.getRandomValues` (which IS available in an insecure context), then Math.random.
 */
export function newRunToken(): string {
  const c: Crypto | undefined = typeof globalThis !== "undefined" ? (globalThis.crypto as Crypto | undefined) : undefined;
  if (c && typeof c.randomUUID === "function") { try { return c.randomUUID(); } catch { /* insecure context — fall through */ } }
  const b = new Uint8Array(16);
  if (c && typeof c.getRandomValues === "function") c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40; // version 4
  b[8] = (b[8] & 0x3f) | 0x80; // variant 10
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0"));
  return `${h[0]}${h[1]}${h[2]}${h[3]}-${h[4]}${h[5]}-${h[6]}${h[7]}-${h[8]}${h[9]}-${h[10]}${h[11]}${h[12]}${h[13]}${h[14]}${h[15]}`;
}

export async function cancelRunClient(token: string): Promise<{ ok: boolean; stopped?: boolean }> {
  if (!token) return { ok: false };
  try {
    const res = await fetch("/api/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
      cache: "no-store",
    });
    return res.ok ? await res.json().catch(() => ({ ok: true })) : { ok: false };
  } catch {
    return { ok: false };
  }
}

export async function stopAllRunsClient(): Promise<{ ok: boolean; stopped?: number }> {
  try {
    const res = await fetch("/api/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ all: true }),
      cache: "no-store",
    });
    return res.ok ? await res.json().catch(() => ({ ok: true })) : { ok: false };
  } catch {
    return { ok: false };
  }
}
