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
