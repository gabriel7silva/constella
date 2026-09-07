/** File-type colored glyph (small mono badge). Ported from the mock. */
export function FileGlyph({ name }: { name: string }) {
  const ext = name.split(".").pop() ?? "";
  const map: Record<string, { t: string; c: string }> = {
    ts: { t: "TS", c: "#3178c6" }, tsx: { t: "TS", c: "#3178c6" },
    js: { t: "JS", c: "#f0c000" }, jsx: { t: "JS", c: "#f0c000" },
    json: { t: "{}", c: "#cbab35" }, md: { t: "M↓", c: "#7d8590" }, css: { t: "#", c: "#42a5f5" },
  };
  const m = map[ext] || { t: "·", c: "#7d8590" };
  return (
    <span style={{ fontSize: 9, fontWeight: 700, fontFamily: "var(--mono-font, monospace)", color: m.c, lineHeight: 1, letterSpacing: "-.5px" }}>{m.t}</span>
  );
}
