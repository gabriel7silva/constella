import "server-only";
import { currentVersion, PKG_NAME } from "@/lib/version";

export type UpdateInfo = {
  current: string;
  latest: string | null;
  updateAvailable: boolean;
  type: "major" | "minor" | "patch" | null;
  command: string;
  changelog: string | null;
};

// In-memory cache so client polling is cheap and we don't hammer the npm registry.
let cache: { at: number; info: UpdateInfo } | null = null;
const TTL = 6 * 60 * 60 * 1000; // 6h

const num = (v: string) => v.replace(/^v/, "").split("-")[0].split(".").map((n) => parseInt(n, 10) || 0);
const preOf = (v: string) => v.replace(/^v/, "").split("-")[1] ?? ""; // the prerelease suffix, "" for a final release
function isNewer(latest: string, current: string): boolean {
  const a = num(latest), b = num(current);
  for (let i = 0; i < 3; i++) { if ((a[i] || 0) > (b[i] || 0)) return true; if ((a[i] || 0) < (b[i] || 0)) return false; }
  // Same x.y.z: a final release outranks a prerelease of the same version (0.3.5 > 0.3.5-rc.1), so the GA
  // release is still offered when running its own prerelease. (Clean releases have no suffix → unchanged.)
  return !preOf(latest) && !!preOf(current);
}
function bumpType(latest: string, current: string): "major" | "minor" | "patch" | null {
  const a = num(latest), b = num(current);
  if (a[0] > b[0]) return "major";
  if (a[1] > b[1]) return "minor";
  if (a[2] > b[2]) return "patch";
  if (!preOf(latest) && !!preOf(current)) return "patch"; // prerelease → final of the same version
  return null;
}

async function fetchJson(url: string): Promise<unknown | null> {
  try {
    const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 3000);
    const r = await fetch(url, { signal: ac.signal, headers: { "user-agent": "constella" } });
    clearTimeout(t);
    return r.ok ? await r.json() : null;
  } catch { return null; }
}
async function fetchText(url: string): Promise<string | null> {
  try {
    const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 3000);
    const r = await fetch(url, { signal: ac.signal, headers: { "user-agent": "constella" } });
    clearTimeout(t);
    return r.ok ? await r.text() : null;
  } catch { return null; }
}

/** Slice the CHANGELOG section for a version (## [x.y.z] … up to the next ## heading). */
function sliceChangelog(md: string, version: string): string | null {
  const esc = version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = md.match(new RegExp(`(^|\\n)##\\s*\\[?${esc}\\]?[\\s\\S]*?(?=\\n##\\s|$)`));
  if (m) return m[0].trim();
  const first = md.split(/\n##\s/)[1];
  return first ? "## " + first.trim() : null;
}

/**
 * Detect whether a newer Constella is published on npm. Fails closed/silent (offline / unpublished /
 * timeout → latest:null, no update) — never throws, never fabricates "updated".
 */
export async function checkForUpdate(force = false): Promise<UpdateInfo> {
  const current = currentVersion();
  const command = `npm install -g ${PKG_NAME}@latest`;
  if (!force && cache && Date.now() - cache.at < TTL) return cache.info;

  const meta = (await fetchJson(`https://registry.npmjs.org/${PKG_NAME}/latest`)) as { version?: string } | null;
  const latest = meta?.version ?? null;
  const updateAvailable = !!latest && isNewer(latest, current);
  let changelog: string | null = null;
  if (updateAvailable && latest) {
    const md = await fetchText("https://raw.githubusercontent.com/gabriel7silva/constella/main/CHANGELOG.md");
    changelog = md ? sliceChangelog(md, latest) : null;
  }
  const info: UpdateInfo = { current, latest, updateAvailable, type: latest ? bumpType(latest, current) : null, command, changelog };
  cache = { at: Date.now(), info };
  return info;
}
