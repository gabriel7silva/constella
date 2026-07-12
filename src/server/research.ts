import "server-only";
import { ingestKnowledge } from "@/server/kb";
import { stackDocHosts } from "@/server/skills-library";

/**
 * Server-side web research: fetch a TRUSTED documentation page and cache it into the knowledge base
 * (RAG) with its source + context. This is the path for LOCAL-model agents (no native WebFetch) and a
 * central, allowlisted fetch — agents emit `[[RESEARCH: <url>]]` and the runner calls this. CLI agents
 * use the native WebSearch/WebFetch tools instead (see cli.ts + the research-official-docs skill).
 *
 * The allowlist = a base set of universally-trusted doc hosts + every `official_sources` host of the
 * workspace's stack skills (so a Vue/Django workspace can reach vuejs.org / docs.djangoproject.com).
 */
const BASE_DOC_HOSTS = [
  "developer.mozilla.org", "web.dev", "owasp.org", "cheatsheetseries.owasp.org", "www.w3.org",
  "docs.python.org", "nodejs.org", "go.dev", "doc.rust-lang.org", "kubernetes.io", "docs.docker.com",
  "www.npmjs.com", "pypi.org",
];

function hostAllowed(host: string, allow: Set<string>): boolean {
  const h = host.toLowerCase().replace(/\.$/, "");
  for (const a of allow) if (h === a || h.endsWith("." + a)) return true;
  return false;
}

/** Crude but dependency-free HTML → readable text (drop scripts/styles/tags, decode the common entities). */
function htmlToText(html: string): { title: string; text: string } {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim() ?? "";
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#39;|&rsquo;|&lsquo;/g, "'").replace(/&quot;|&ldquo;|&rdquo;/g, '"')
    .replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return { title, text };
}

/**
 * Fetch `url` (must be on the official-docs allowlist), extract its text, and cache it into the KB as a
 * `doc`/`research` entry keyed by URL (re-fetching the same URL updates in place). Best-effort: returns a
 * reason on any refusal/failure and never throws.
 */
export async function researchDocs(
  orgId: string,
  stack: Record<string, string>,
  url: string,
  ctx?: { agentHandle?: string; goalId?: string | null; issueId?: string | null; taskId?: string | null },
): Promise<{ ok: boolean; reason?: string; chars?: number; title?: string }> {
  let u: URL;
  try { u = new URL(url); } catch { return { ok: false, reason: "invalid url" }; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return { ok: false, reason: "non-http url" };
  const allow = new Set([...BASE_DOC_HOSTS, ...stackDocHosts(stack)].map((h) => h.toLowerCase()));
  if (!hostAllowed(u.hostname, allow)) return { ok: false, reason: `host not on the official-docs allowlist (${u.hostname})` };

  let html = "";
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15_000);
    const r = await fetch(u.toString(), {
      signal: ctrl.signal, redirect: "follow",
      headers: { "user-agent": "Constella-Research/1.0", accept: "text/html,application/xhtml+xml,*/*" },
    });
    clearTimeout(timer);
    if (!r.ok) return { ok: false, reason: `http ${r.status}` };
    // Re-validate the FINAL url after redirects — an allowlisted (but open-redirect-prone or compromised)
    // doc host could 302 to an arbitrary host, and its body would otherwise be ingested under the original url.
    let landed = u.hostname;
    try { landed = new URL(r.url).hostname; } catch { /* keep original */ }
    if (!hostAllowed(landed, allow)) return { ok: false, reason: `redirected off the official-docs allowlist (${landed})` };
    if (!/text\/|html|xml|json/i.test(r.headers.get("content-type") ?? "")) return { ok: false, reason: "non-text content" };
    html = (await r.text()).slice(0, 1_500_000);
  } catch (e) { return { ok: false, reason: String(e instanceof Error ? e.message : e).slice(0, 120) }; }

  const { title, text } = htmlToText(html);
  if (text.length < 80) return { ok: false, reason: "empty page" };

  await ingestKnowledge(orgId, [{
    type: "doc",
    title: (title || `${u.host}${u.pathname}`).slice(0, 200),
    summary: text.slice(0, 1000),
    body: `Official documentation — researched and cached for reuse.\nSource: ${u.toString()}\n\n${text.slice(0, 8000)}`,
    sourceKind: "research", sourceRef: u.toString(), confidence: 60,
    agentHandle: ctx?.agentHandle, goalId: ctx?.goalId ?? null, issueId: ctx?.issueId ?? null, taskId: ctx?.taskId ?? null,
  }]).catch(() => {});
  return { ok: true, chars: text.length, title };
}
