/** Live agent work-status indicator (server-safe). `working` pulses green (reuses the
 *  `.dotpulse` animation); blocked=pink, review=amber, idle=grey. Optional text label. */
const STATUS: Record<string, { c: string; pulse?: boolean; label: string }> = {
  working: { c: "var(--sx-string)", pulse: true, label: "working" },
  review: { c: "#e0a44e", label: "review" },
  blocked: { c: "#e8688f", label: "blocked" },
  idle: { c: "var(--text-faint)", label: "idle" },
};

export function StatusDot({ status, label = false, size = 8 }: { status: string; label?: boolean; size?: number }) {
  const s = STATUS[status] ?? STATUS.idle;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }} title={s.label}>
      {s.pulse
        ? <span className="dotpulse" />
        : <span style={{ width: size, height: size, borderRadius: "50%", background: s.c, display: "inline-block", flex: `0 0 ${size}px` }} />}
      {label && <span style={{ fontSize: 11, color: s.c, fontWeight: 600 }}>{s.label}</span>}
    </span>
  );
}
