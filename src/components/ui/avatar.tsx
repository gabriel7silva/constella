/** Agent/user avatar — an uploaded image when present, else a colored rounded square + initial.
 *  Optional health dot. Server-safe. `image` is normally a DB-stored data URL; legacy values may be a
 *  workspace upload path (uploads/<id>/<name>), which is served through /api/upload. */
export function Avatar({ name, color, size = 24, health, image }: {
  name: string;
  color: string;
  size?: number;
  health?: "alive" | "stale" | "down" | null;
  image?: string | null;
}) {
  const dot = Math.max(6, Math.round(size * 0.3));
  const hc = health === "alive" ? "var(--sx-string)" : health === "stale" ? "var(--sx-number)" : "var(--text-faint)";
  const radius = Math.round(size * 0.28);
  const src = !image ? null : /^(data:|https?:|\/)/.test(image) ? image : `/api/upload?path=${encodeURIComponent(image)}`;
  return (
    <span style={{ position: "relative", width: size, height: size, flex: `0 0 ${size}px`, display: "inline-block" }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} width={size} height={size}
          style={{ width: size, height: size, borderRadius: radius, objectFit: "cover", display: "block" }} />
      ) : (
      <span style={{
        width: size, height: size, borderRadius: radius, background: color, color: "#fff",
        display: "grid", placeItems: "center", fontSize: Math.round(size * 0.42), fontWeight: 700,
      }}>{(name[0] || "?").toUpperCase()}</span>
      )}
      {health && (
        <span style={{
          position: "absolute", right: -1, bottom: -1, width: dot, height: dot, borderRadius: "50%",
          background: hc, border: "1.5px solid var(--bg-elevated)",
        }} />
      )}
    </span>
  );
}
