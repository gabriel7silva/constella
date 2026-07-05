/**
 * Tiny dependency-free SVG charts for the cockpit. Pure presentational (no hooks) so they render in
 * server or client trees; all colors come from theme CSS vars so light/dark "just work", and the CSS
 * entrance transitions are gated by the global `html.anim-off` rule. Generalizes the ContextDonut ring.
 */

export type Seg = { value: number; color: string; label?: string };

/** A semantic series palette derived from the syntax colors (no dedicated chart palette exists). */
export const CHART_PALETTE = [
  "var(--sx-property)", "var(--sx-type)", "var(--sx-function)", "var(--sx-number)",
  "var(--sx-string)", "var(--sx-operator)", "var(--sx-keyword)", "var(--accent)",
];

/** Radial-progress ring with a big center number. `color` defaults to a green→amber→red threshold. */
export function Donut({ value, max = 100, size = 64, thickness = 7, color, track = "var(--bg-active)", center, sub, className }: {
  value: number; max?: number; size?: number; thickness?: number; color?: string; track?: string; center?: string; sub?: string; className?: string;
}) {
  const r = (size - thickness) / 2;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const len = pct * circ;
  const col = color ?? (pct >= 0.85 ? "var(--sx-keyword)" : pct >= 0.6 ? "var(--sx-number)" : "var(--sx-string)");
  return (
    <div className={"donut-wrap" + (className ? " " + className : "")} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={c} cy={c} r={r} fill="none" stroke={track} strokeWidth={thickness} />
        <circle cx={c} cy={c} r={r} fill="none" stroke={col} strokeWidth={thickness} strokeLinecap="round"
          strokeDasharray={`${len} ${circ}`} transform={`rotate(-90 ${c} ${c})`} className="donut-arc" />
      </svg>
      <div className="donut-center">
        <div className="donut-num" style={{ color: col, fontSize: Math.round(size * 0.26) }}>{center ?? Math.round(pct * 100) + "%"}</div>
        {sub && <div className="donut-sub">{sub}</div>}
      </div>
    </div>
  );
}

/** Multi-arc donut (e.g. knowledge-by-type, status share). */
export function DonutSegments({ segments, size = 96, thickness = 12, center, sub, className }: {
  segments: Seg[]; size?: number; thickness?: number; center?: string; sub?: string; className?: string;
}) {
  const r = (size - thickness) / 2;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  let offset = 0;
  const arcs = segments.filter((s) => s.value > 0).map((s, i) => {
    const len = (s.value / total) * circ;
    const el = (
      <circle key={i} cx={c} cy={c} r={r} fill="none" stroke={s.color} strokeWidth={thickness}
        strokeDasharray={`${len} ${circ - len}`} strokeDashoffset={-offset} transform={`rotate(-90 ${c} ${c})`} className="donut-arc" />
    );
    offset += len;
    return el;
  });
  return (
    <div className={"donut-wrap" + (className ? " " + className : "")} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={c} cy={c} r={r} fill="none" stroke="var(--bg-active)" strokeWidth={thickness} />
        {arcs}
      </svg>
      {(center || sub) && (
        <div className="donut-center">
          {center && <div className="donut-num" style={{ fontSize: Math.round(size * 0.2) }}>{center}</div>}
          {sub && <div className="donut-sub">{sub}</div>}
        </div>
      )}
    </div>
  );
}

/** Line + optional area sparkline. Flat baseline for 0/1-point inputs (never NaN). */
export function Sparkline({ data, color = "var(--accent)", width = 120, height = 34, fill = true, className }: {
  data: number[]; color?: string; width?: number; height?: number; fill?: boolean; className?: string;
}) {
  const d = data.length === 0 ? [0, 0] : data.length === 1 ? [data[0], data[0]] : data;
  const n = d.length;
  const max = Math.max(...d);
  const min = Math.min(...d);
  const span = max - min || 1;
  const pad = 2;
  const xw = (width - pad * 2) / (n - 1);
  const y = (v: number) => height - pad - ((v - min) / span) * (height - pad * 2);
  const pts = d.map((v, i) => `${(pad + i * xw).toFixed(1)},${y(v).toFixed(1)}`);
  const line = "M" + pts.join(" L");
  const area = `${line} L${(pad + (n - 1) * xw).toFixed(1)},${height - pad} L${pad},${height - pad} Z`;
  return (
    <svg className={"spark" + (className ? " " + className : "")} width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      {fill && <path d={area} fill={color} opacity={0.12} />}
      <path d={line} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** Horizontal stacked segmented bar. */
export function SegBar({ segments, height = 10, rounded = true, className }: {
  segments: Seg[]; height?: number; rounded?: boolean; className?: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  return (
    <div className={"segbar" + (className ? " " + className : "")} style={{ height, borderRadius: rounded ? height : 4 }}>
      {total === 0
        ? <span className="segbar-empty" />
        : segments.filter((s) => s.value > 0).map((s, i) => (
            <span key={i} className="segbar-seg" style={{ width: `${(s.value / total) * 100}%`, background: s.color }} title={s.label} />
          ))}
    </div>
  );
}

/** Thin progress bar (reuses .pbar). */
export function ProgressBar({ pct, color = "var(--accent)", height = 8, className }: { pct: number; color?: string; height?: number; className?: string }) {
  return <div className={"pbar" + (className ? " " + className : "")} style={{ height }}><span style={{ width: Math.min(100, Math.max(0, pct)) + "%", background: color }} /></div>;
}
