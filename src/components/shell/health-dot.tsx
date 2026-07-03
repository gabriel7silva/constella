/**
 * HealthDot — the green/amber/grey status dot driven by an agent's pulse.
 *   alive → green (pulsing)   stale → amber   down → grey
 * Title attribute surfaces the exact state on hover.
 */
const HEALTH = {
  alive: { color: "var(--sx-string, #b3d97a)", label: "alive", pulse: true },
  stale: { color: "#f0a35e", label: "stale", pulse: false },
  down: { color: "var(--text-faint, #6b7280)", label: "down", pulse: false },
} as const;

export function HealthDot({ health, size = 9 }: { health: "alive" | "stale" | "down"; size?: number }) {
  const h = HEALTH[health] ?? HEALTH.down;
  return (
    <span
      title={h.label}
      className={"health-dot" + (h.pulse ? " pulse" : "")}
      style={{ width: size, height: size, background: h.color, ["--hc" as string]: h.color }}
    />
  );
}
