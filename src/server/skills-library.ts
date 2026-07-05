import "server-only";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { launchDir } from "@/lib/runtime-root";
import { STACK_VALUE_TO_SKILL } from "@/data/stack-skill-map";
import { roleProfile } from "@/data/role-skill-profile";
import { splitStack } from "@/lib/stack-multi";

/**
 * Runtime loader for the root `skills/` library — the official, native skill catalogue that ships
 * with the system. We fs-walk `skills/` for SKILL.md files (the hand-maintained INDEX.json is known
 * to lag behind the files), parse each one's frontmatter, and expose helpers to pick the skills a
 * new workspace should be seeded with (universal + stack-matched). If the dir is missing at runtime,
 * everything degrades to a safe no-op.
 */
export type LibrarySkill = { name: string; relPath: string; description: string; domain: string; category: string; sources: string[]; tags: string[] };

export function skillsLibraryRoot(): string {
  // The skills/ library ships INSIDE the package. In an installed/compiled run it lives under the
  // package root (CONSTELLA_PKG_ROOT, set by the CLI launcher) — NOT under the launch dir, where an
  // earlier version looked and found nothing. In the dev tree it sits at the repo root (= launchDir).
  // Try each candidate and return the first that actually exists.
  const candidates = [process.env.CONSTELLA_PKG_ROOT, launchDir(), process.cwd()]
    .filter(Boolean)
    .map((d) => join(d as string, "skills"));
  for (const c of candidates) { try { if (statSync(c).isDirectory()) return c; } catch { /* try next */ } }
  return candidates[0] ?? join(launchDir(), "skills");
}

/** Minimal YAML-frontmatter value reader (single-line scalars; strips surrounding quotes). */
function fmValue(block: string, key: string): string {
  const m = block.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
  if (!m) return "";
  return m[1].trim().replace(/^["']|["']$/g, "").trim();
}

/** Read a YAML list as EITHER an inline flow array (`key: [a, b, c]`) or a multi-line list — covers both styles. */
function fmAnyList(block: string, key: string): string[] {
  const inline = block.match(new RegExp(`^${key}:\\s*\\[(.*?)\\]\\s*$`, "m"));
  if (inline) return inline[1].split(",").map((v) => v.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
  return fmList(block, key);
}

/** Read a multi-line YAML list (`key:` then indented `- value` lines) from a frontmatter block. */
function fmList(block: string, key: string): string[] {
  const m = block.match(new RegExp(`(?:^|\\n)${key}:\\s*\\n([\\s\\S]*?)(?=\\n\\S|$)`));
  if (!m) return [];
  return m[1].split("\n")
    .map((l) => l.match(/^\s*-\s+(.+?)\s*$/)?.[1]?.replace(/^["']|["']$/g, "").trim())
    .filter((v): v is string => !!v);
}

let cache: Map<string, LibrarySkill> | null = null;

/** Build (once) a name→skill index by walking every SKILL.md under skills/. First occurrence wins on
 *  dup names (e.g. `redis` lives under both stacks/database and stacks/queue). Empty map if absent. */
export function loadLibraryIndex(): Map<string, LibrarySkill> {
  if (cache) return cache;
  const root = skillsLibraryRoot();
  const out = new Map<string, LibrarySkill>();
  function walk(dir: string, depth: number) {
    if (depth > 8) return;
    let entries: import("node:fs").Dirent[];
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const abs = join(dir, e.name);
      if (e.isDirectory()) { walk(abs, depth + 1); continue; }
      if (e.name !== "SKILL.md") continue;
      let md = "";
      try { md = readFileSync(abs, "utf8"); } catch { continue; }
      const fm = md.match(/^---\n([\s\S]*?)\n---/);
      const block = fm?.[1] ?? "";
      // Key by the LEAF FOLDER name — the stable id used by INDEX.json paths, stack-skill-map and
      // UNIVERSAL_SKILL_NAMES. Some skills carry a namespaced frontmatter name (e.g.
      // `testing/testing-strategy-pyramid`) that wouldn't match those ids, so the folder wins.
      const name = abs.split(/[\\/]/).slice(-2, -1)[0] || fmValue(block, "name");
      if (!name || out.has(name)) continue;
      const relPath = abs.slice(root.length).replace(/^[\\/]+/, "").replace(/\\/g, "/");
      out.set(name, {
        name, relPath,
        description: fmValue(block, "description") || `${name} skill.`,
        domain: fmValue(block, "domain") || relPath.split("/")[0] || "",
        category: fmValue(block, "category") || "",
        sources: fmList(block, "official_sources"),
        tags: fmAnyList(block, "tags"),
      });
    }
  }
  try { if (statSync(root).isDirectory()) walk(root, 0); } catch { /* dir missing → empty index */ }
  cache = out;
  return out;
}

export function librarySkillByName(name: string): LibrarySkill | null {
  return loadLibraryIndex().get(name) ?? null;
}

/** Raw SKILL.md content for a library skill (the body fed into the workspace skill file). */
export function readLibrarySkillMd(name: string): string | null {
  const entry = librarySkillByName(name);
  if (!entry) return null;
  try { return readFileSync(join(skillsLibraryRoot(), entry.relPath), "utf8"); } catch { return null; }
}

/** Always-on skills every workspace gets, regardless of stack. Filtered to what exists on disk. */
export const UNIVERSAL_SKILL_NAMES: string[] = [
  // engineering practices
  "clean-code", "git-workflow", "code-review-practices", "refactoring", "code-optimization",
  // security
  "owasp-top-10", "secrets-management", "appsec-fundamentals",
  // testing
  "testing-strategy-pyramid", "tdd-and-coverage", "unit-integration-e2e",
  // design / frontend foundations
  "ui-ux-principles", "responsive-layout", "accessibility-wcag",
  // process rituals
  "architecture-before-code", "requirements-to-specs", "specs-to-issues", "testing-before-done",
  "security-by-design", "review-code-perf-security",
  // web research → knowledge base (P2)
  "research-official-docs",
  // meta
  "authoring-agent-skills",
  // documentation
  "readme-generation",
];

/** Strip the body of a SKILL.md down to just its content (drop the leading frontmatter block). */
export function stripFrontmatter(md: string): string {
  return md.replace(/^---\n[\s\S]*?\n---\n?/, "").trim();
}

/** The library skill names a workspace should seed: universal + the skills matching its stack picks,
 *  deduped and filtered to skills that actually exist in the library. */
export function librarySkillNamesForStack(stack: Record<string, string>): string[] {
  const index = loadLibraryIndex();
  const names: string[] = [...UNIVERSAL_SKILL_NAMES];
  for (const value of Object.values(stack ?? {})) {
    // A category may hold several frameworks ("MUI, Plain CSS") — map EACH pick to its skill.
    for (const pick of splitStack(value)) {
      const id = STACK_VALUE_TO_SKILL[pick];
      if (id) names.push(id);
    }
  }
  return [...new Set(names)].filter((n) => index.has(n));
}

/** EVERY library skill name (all 180+ SKILL.md). Seeded so the whole library shows in the Skills
 *  module; only the stack-relevant subset is auto-linked to agents (the rest are available to enable). */
export function allLibrarySkillNames(): string[] {
  return [...loadLibraryIndex().keys()];
}

/**
 * The library skills to AUTO-LINK for an agent of `role` given the workspace `stack`: the global
 * universals + the role profile's include-all folders (design/engineering/process best practice) + the
 * stack picks that fall under the role's stack folders (so a Vue project's Frontend gets `vue`, not
 * react+svelte). Filtered to skills that actually exist in the library. This is what replaces the old
 * "link all ~180 to everyone" so the RIGHT skills reach the RIGHT agent.
 */
export function skillNamesForRole(stack: Record<string, string>, role: string | null | undefined): string[] {
  const index = loadLibraryIndex();
  const prof = roleProfile(role);
  const stackSet = new Set(librarySkillNamesForStack(stack)); // universal + stack-matched ids (on disk)
  const out = new Set<string>(UNIVERSAL_SKILL_NAMES.filter((n) => index.has(n)));
  for (const [name, sk] of index) {
    if (prof.allPrefixes.some((p) => sk.relPath.startsWith(p))) out.add(name);
    else if (prof.stackPrefixes.some((p) => sk.relPath.startsWith(p)) && stackSet.has(name)) out.add(name);
  }
  return [...out];
}

/** The SIGNATURE skills to PIN for an agent of `role` (kept in the prompt even under a tight budget):
 *  the profile's core skills (that exist) + the chosen stack picks under the role's stack folders
 *  (so "vue"/"django"/"tailwind" pin automatically). A small set — the caller caps it. */
export function coreSkillNamesForRole(stack: Record<string, string>, role: string | null | undefined): string[] {
  const index = loadLibraryIndex();
  const prof = roleProfile(role);
  const stackSet = new Set(librarySkillNamesForStack(stack));
  const core = new Set<string>(prof.core.filter((n) => index.has(n)));
  for (const [name, sk] of index) {
    if (prof.stackPrefixes.some((p) => sk.relPath.startsWith(p)) && stackSet.has(name)) core.add(name);
  }
  return [...core];
}

/** The official-documentation hostnames for the workspace's stack — the `official_sources` of the
 *  universal + stack-matched skills, parsed to hosts. Drives the web-research allowlist (P2). */
export function stackDocHosts(stack: Record<string, string>): string[] {
  const index = loadLibraryIndex();
  const hosts = new Set<string>();
  for (const n of librarySkillNamesForStack(stack)) {
    for (const url of index.get(n)?.sources ?? []) {
      try { hosts.add(new URL(url).host.toLowerCase()); } catch { /* skip bad url */ }
    }
  }
  return [...hosts];
}
