/** Shared date+time formatting for Goals / Specs / Issues / pipeline / execution, matching the
 *  chat dock's `clock()` style: "16 Jun, 14:32". Tolerant of Date | epoch | ISO string | null. */
export function formatWhen(d?: Date | string | number | null): string {
  if (d == null) return "";
  const dt = d instanceof Date ? d : new Date(typeof d === "number" ? d : d);
  if (isNaN(dt.getTime())) return "";
  const date = dt.toLocaleDateString([], { day: "2-digit", month: "short" });
  const time = dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `${date}, ${time}`;
}

/** Date only — "16 Jun 2026". */
export function formatDate(d?: Date | string | number | null): string {
  if (d == null) return "";
  const dt = d instanceof Date ? d : new Date(typeof d === "number" ? d : d);
  if (isNaN(dt.getTime())) return "";
  return dt.toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" });
}
