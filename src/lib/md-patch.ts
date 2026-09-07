/**
 * Minimal Markdown patchers — update specific fields/sections of a generated `.md`
 * IN PLACE so UI edits write back to disk without clobbering surrounding (possibly
 * enriched) content. The directory stays the source of truth.
 */

/** Set/insert a `key: value` line inside the YAML front-matter block. */
export function setFrontMatter(md: string, key: string, value: string | number): string {
  const fm = md.match(/^---\n([\s\S]*?)\n---/);
  if (!fm) return md;
  const lines = fm[1].split("\n");
  let found = false;
  const out = lines.map((l) => (l.startsWith(key + ":") ? ((found = true), `${key}: ${value}`) : l));
  if (!found) out.push(`${key}: ${value}`);
  // Replacer FUNCTION (not a template string) — the joined front-matter is literal, so any `$` in a value
  // is not interpreted as a String.replace replacement pattern ($1, $&, $$).
  return md.replace(/^---\n[\s\S]*?\n---/, () => `---\n${out.join("\n")}\n---`);
}

/** Replace the text after a `**Label:**` inline field on its line. */
export function setInlineField(md: string, label: string, value: string): string {
  const re = new RegExp(`(\\*\\*${label}:\\*\\*\\s*).*`);
  // Replacer function so a `$` in `value` stays literal (not a replacement pattern); p1 keeps the label prefix.
  return re.test(md) ? md.replace(re, (_m, p1) => `${p1}${value}`) : md;
}

/** Replace the body of a `## Heading` section (up to the next `## ` or EOF). Appends if absent. */
export function setSection(md: string, heading: string, body: string): string {
  const re = new RegExp(`(^|\\n)##\\s+${heading}\\s*\\n[\\s\\S]*?(?=\\n##\\s|$)`);
  // Replacer function so a `$` in `body`/`heading` stays literal (not a $1/$&/$$ replacement pattern); p1 keeps
  // the leading boundary (start-of-string or newline) the regex captured.
  if (re.test(md)) return md.replace(re, (_m, p1) => `${p1}## ${heading}\n${body}`);
  return md.replace(/\s*$/, "") + `\n\n## ${heading}\n${body}\n`;
}
