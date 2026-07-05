export function ConstellaMark({ size = 34, rx = 9 }: { size?: number; rx?: number }) {
  const N: [number, number][] = [[66.06, 27.06], [42.75, 22.95], [24.62, 38.17], [24.62, 61.83], [42.75, 77.05], [66.06, 72.94]];
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: "block", flex: `0 0 ${size}px` }} aria-label="Constella">
      <rect x="1" y="1" width="98" height="98" rx={rx} fill="var(--cs-bg)" stroke="var(--cs-border)" strokeWidth="1.5" />
      <path d="M66.06 27.06 L42.75 22.95 L24.62 38.17 L24.62 61.83 L42.75 77.05 L66.06 72.94" fill="none" stroke="var(--cs-line)" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M48 50 L42.75 22.95 M48 50 L24.62 50 M48 50 L42.75 77.05" fill="none" stroke="var(--cs-line)" strokeWidth="1.2" strokeLinecap="round" opacity="0.55" />
      {N.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="3.1" fill="var(--cs-node)" />)}
      <circle cx="48" cy="50" r="8.5" fill="var(--cs-glow)" opacity="0.4" />
      <circle cx="48" cy="50" r="4.3" fill="var(--cs-core)" />
    </svg>
  );
}
