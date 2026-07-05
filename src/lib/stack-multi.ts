/**
 * Multi-pick stack representation. The project stack is stored as `Record<string, string>` where each
 * category's value is a comma+space joined list of selected options (e.g. styling = "MUI, Plain CSS") —
 * so a category can hold MULTIPLE frameworks, not just one. Keeping the value a STRING means no DB
 * migration and every existing consumer that just prints/compares the joined text keeps working; the
 * split-sensitive ones (skills mapping, compatibility checks) use the helpers below.
 *
 * "None" is the explicit "skip this category" sentinel and is EXCLUSIVE: picking it clears the rest, and
 * picking a real option drops "None". Shared by the onboarding picker and the Config stack editor.
 */

/** A category's joined value → its individual picks (trimmed, empties dropped). */
export function splitStack(value: string | undefined | null): string[] {
  return value ? value.split(",").map((s) => s.trim()).filter(Boolean) : [];
}

/** Individual picks → the joined value stored on the workspace. */
export function joinStack(opts: string[]): string {
  return opts.join(", ");
}

/** The first/primary pick of a category — used by the family-based compatibility checks. */
export function primaryStack(value: string | undefined | null): string {
  return splitStack(value)[0] ?? "";
}

/** Is `opt` currently selected in this category's joined value? */
export function hasStack(value: string | undefined | null, opt: string): boolean {
  return splitStack(value).includes(opt);
}

/** Toggle `opt` in a category's joined value. "None" is exclusive in both directions. */
export function toggleStack(value: string | undefined | null, opt: string): string {
  const cur = splitStack(value);
  if (opt === "None") return cur.includes("None") ? "" : "None";
  const next = cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur.filter((x) => x !== "None"), opt];
  return joinStack(next);
}
