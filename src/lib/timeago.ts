/** Compact relative time, e.g. "now", "5m", "2h", "3d". */
export function timeAgo(at: Date | number | null | undefined): string {
  if (!at) return "";
  const ms = Date.now() - (typeof at === "number" ? at * (at < 1e12 ? 1000 : 1) : at.getTime());
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return "now";
  const m = Math.floor(s / 60); if (m < 60) return m + "m";
  const h = Math.floor(m / 60); if (h < 24) return h + "h";
  const d = Math.floor(h / 24); if (d < 7) return d + "d";
  return Math.floor(d / 7) + "w";
}
