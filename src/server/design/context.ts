import "server-only";
import { readWorkspaceFile, writeWorkspaceFile, listFiles } from "@/lib/fs-workspace";
import { splitStack } from "@/lib/stack-multi";
import { loadLibraryIndex } from "@/server/skills-library";

/** Everything the Design module's frontend agent (Grace) AND the CEO Planner can consult about the
 *  project: brief, mission/objective, stack, attached mock, imported source, design-mock output,
 *  design-skills, and the approved-design reference. One gatherer so both stay in sync. */
export type DesignContext = {
  brief: string;
  mission: string;
  objective: string;
  stackList: string;
  mockFiles: string[];
  designMockFiles: string[];
  designSkills: string[];
  approved: string | null;   // design-mock/APPROVED.md (the official visual reference), if any
  hasImported: boolean;      // a real project was imported/scaffolded beyond the design dirs
};

const APPROVED_PATH = "design-mock/APPROVED.md";

export function gatherDesignContext(orgId: string, ws: { mission?: string | null; objective?: string | null; stack?: Record<string, string> | null }): DesignContext {
  const all = listFiles(orgId);
  const mockFiles = all.filter((p) => p.startsWith("mock/") && p !== "mock/README.md");
  const designMockFiles = all.filter((p) => p.startsWith("design-mock/") && !/\/README\.md$/i.test(p) && p !== APPROVED_PATH);
  const designSkills = all.filter((p) => p.startsWith("design-skills/") && p.endsWith(".md") && p !== "design-skills/README.md");
  const stackRec = (ws.stack ?? {}) as Record<string, string>;
  const stackList = Object.entries(stackRec)
    .flatMap(([k, v]) => splitStack(v).filter((x) => x !== "None").map((x) => `${k}: ${x}`))
    .join(", ");
  // "imported/scaffolded project" = any source file outside the control/design/mock dirs.
  const SKIP = /^(\.claude\/|DOCS\/|PO\/|Reports\/|specs\/|issues\/|mock\/|design-mock\/|design-skills\/|README\.md$)/i;
  const hasImported = all.some((p) => !SKIP.test(p));
  return {
    brief: readWorkspaceFile(orgId, ".claude/BRIEF.md") ?? "",
    mission: ws.mission ?? "",
    objective: ws.objective ?? "",
    stackList,
    mockFiles,
    designMockFiles,
    designSkills,
    approved: readWorkspaceFile(orgId, APPROVED_PATH),
    hasImported,
  };
}

/** A compact, prompt-ready briefing of the design context for the frontend agent. */
export function designContextPrompt(c: DesignContext): string {
  return [
    c.mission ? `Mission: ${c.mission}` : "",
    c.objective ? `Objective: ${c.objective}` : "",
    c.stackList ? `Chosen stack: ${c.stackList}. Generate markup compatible with it — never generic.` : "",
    c.brief ? `\nProject brief:\n${c.brief.slice(0, 3000)}` : "",
    c.mockFiles.length ? `\nAttached mock/prototype (${c.mockFiles.length} files): ${c.mockFiles.slice(0, 14).join(", ")} — read them and match the product precisely.` : "",
    c.designMockFiles.length ? `\nDesign module output so far (design-mock/): ${c.designMockFiles.slice(0, 14).join(", ")}.` : "",
    c.designSkills.length ? `\nDesign skills available (design-skills/): ${c.designSkills.map((p) => p.replace(/^design-skills\//, "")).slice(0, 20).join(", ")} — consult the relevant ones.` : "",
    c.approved ? `\nAn APPROVED design already exists (design-mock/APPROVED.md) — the official visual reference. Honor it; do not drift.` : "",
    c.hasImported ? `\nThere is an existing imported/scaffolded project in this workspace — extend it, preserve its visual identity.` : "",
  ].filter(Boolean).join("\n");
}

// ── Domain + style intelligence ─────────────────────────────────────────────────────────────────────────────
// A salient seed word expands into related design concepts so skill ranking + Grace's focus reflect the PRODUCT
// domain and visual INTENT — not just literal words. Keys are matched as substrings (lowercased).
const DESIGN_LEXICON: Record<string, string[]> = {
  hotel: ["hospitality", "booking", "reservation", "rooms", "travel", "checkin", "premium", "gallery", "amenities"],
  hospedagem: ["hotel", "booking", "reservation", "rooms", "hospitality"], reserva: ["booking", "calendar", "availability", "checkout"],
  restaurant: ["menu", "food", "reservation", "hospitality", "gallery"], restaurante: ["menu", "food", "reservation", "hospitality"],
  ecommerce: ["product", "cart", "checkout", "catalog", "pricing", "payment"], loja: ["ecommerce", "product", "cart", "checkout", "catalog"], shop: ["ecommerce", "product", "cart", "checkout"], store: ["ecommerce", "product", "cart", "checkout"],
  dashboard: ["charts", "dataviz", "tables", "kpi", "analytics", "admin"], saas: ["dashboard", "pricing", "onboarding", "settings", "billing"],
  fintech: ["dashboard", "charts", "security", "transactions", "kpi"], banking: ["fintech", "transactions", "security", "cards", "dashboard"], banco: ["fintech", "transactions", "security", "cards"],
  calculator: ["mobile", "grid", "buttons", "keypad", "ios"], calculadora: ["mobile", "grid", "buttons", "keypad", "ios"],
  apple: ["ios", "glassmorphism", "minimal", "typography", "rounded", "microinteractions"], ios: ["apple", "glassmorphism", "mobile", "rounded", "microinteractions", "minimal"],
  glassmorphism: ["blur", "translucent", "frosted", "depth", "gradient"], neumorphism: ["shadow", "embossed", "monochrome"],
  minimal: ["whitespace", "typography", "restraint", "grid"], minimalista: ["whitespace", "typography", "grid"], brutalist: ["bold", "contrast", "raw", "monospace"],
  landing: ["hero", "cta", "sections", "features", "testimonials", "pricing", "footer"], portfolio: ["gallery", "grid", "casestudy", "minimal", "typography"],
  blog: ["typography", "reading", "article", "content"], social: ["feed", "cards", "avatars", "interactions", "realtime"], chat: ["messages", "bubbles", "realtime", "input", "avatars"],
  mobile: ["responsive", "touch", "ios", "android"], admin: ["dashboard", "tables", "forms", "crud", "data"], dark: ["theme", "contrast"], premium: ["luxury", "typography", "spacing", "motion", "elegant"],
  animation: ["motion", "transitions", "keyframes", "microinteractions"], motion: ["animation", "transitions", "microinteractions"], accessibility: ["a11y", "contrast", "focus", "aria", "wcag"],
};
const STOP = new Set("the a an and or of to for with in on at is are be this that you your our it its build create make page screen app site website using use want need please can grace design quero uma para com que the and dos das uma novo nova".split(/\s+/));
function tokenize(s: string): string[] {
  return (s || "").toLowerCase().replace(/[^a-z0-9çãáéíóúâêôà\s-]/gi, " ").split(/\s+/).filter((w) => w.length >= 3 && !STOP.has(w));
}

/** Salient keywords from the brief/mission/objective/stack/mock + the operator's message, expanded by the
 *  domain+style lexicon. Drives skill ranking and grounds Grace in the product's domain and visual intent. */
export function extractDesignKeywords(c: DesignContext, userMsg?: string): string[] {
  const src = [userMsg || "", c.mission, c.objective, c.brief.slice(0, 1500), c.stackList, c.mockFiles.map((p) => p.split("/").pop() || "").join(" ")].join(" ");
  const toks = tokenize(src);
  const freq: Record<string, number> = {};
  for (const w of toks) freq[w] = (freq[w] || 0) + 1;
  if (userMsg) for (const w of tokenize(userMsg)) freq[w] = (freq[w] || 0) + 3; // the live request weighs most
  const expanded = new Map<string, number>();
  for (const w of Object.keys(freq)) expanded.set(w, (expanded.get(w) || 0) + freq[w]);
  for (const w of Object.keys(freq)) for (const [k, vals] of Object.entries(DESIGN_LEXICON)) if (w.includes(k) || k.includes(w)) for (const v of vals) expanded.set(v, (expanded.get(v) || 0) + 1);
  return Array.from(expanded.entries()).sort((a, b) => b[1] - a[1]).map(([w]) => w).slice(0, 24);
}

/** Rank the seeded native skills (.claude/skills via the library index) by relevance to these keywords, so Grace
 *  reads domain/style/stack-specific skills FIRST — returns `name: description` lines for the top matches. */
export function rankSkillsForKeywords(keywords: string[], limit = 8): { name: string; description: string }[] {
  const kw = keywords.map((k) => k.toLowerCase());
  if (!kw.length) return [];
  const scored: { name: string; description: string; score: number }[] = [];
  for (const sk of loadLibraryIndex().values()) {
    const tags = (sk.tags || []).map((t) => t.toLowerCase());
    const hay = (sk.name + " " + sk.description + " " + sk.domain + " " + sk.category + " " + tags.join(" ")).toLowerCase();
    const nameWords = sk.name.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    let score = 0;
    for (const k of kw) {
      if (nameWords.includes(k) || tags.includes(k)) score += 4;  // skill name OR an exact tag IS the keyword → strongest
      else if (hay.includes(k)) score += 1;                       // appears in description/domain/category/tags
    }
    if (sk.domain === "design" || sk.category === "design") score += 0.5; // mild design bias
    if (score > 0) scored.push({ name: sk.name, description: sk.description, score });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map(({ name, description }) => ({ name, description }));
}

/** A focused skill briefing for Grace: keywords detected from the brief/intent + the seeded skills ranked by
 *  relevance to THIS request — so she grounds the work in the product's domain + style, not a generic look. */
export function designSkillFocus(c: DesignContext, userMsg?: string): string {
  const keywords = extractDesignKeywords(c, userMsg);
  const ranked = rankSkillsForKeywords(keywords, 8);
  return [
    keywords.length ? `\nDETECTED CONTEXT (domain + visual intent): ${keywords.slice(0, 16).join(", ")}. Ground the palette, typography, layout, components and motion in THIS product's domain and style — never a generic AI look.` : "",
    ranked.length ? `\nMOST RELEVANT seeded skills for THIS request — READ the matching \`.claude/skills/<name>.md\` FIRST before building:\n${ranked.map((s) => `- ${s.name}: ${s.description}`).join("\n")}` : "",
  ].filter(Boolean).join("\n");
}

// ── Design gate (Design → Grace → Ada → Execution) ───────────────────────────────────────────────────────────
// Frontend work should be prototyped + APPROVED in the Design module before Ada writes final specs (zero drift).
// A tiny workspace file records the gate so the planner can HOLD a frontend plan until the design is approved and
// RESUME it on approval — and so the operator can bypass ("Generate plan anyway"). No schema/migration needed.
const DESIGN_GATE_PATH = ".claude/design-gate.json";
export type DesignGate = { skip?: boolean; requestedPlanAt?: number; brief?: string; goalTitle?: string; scaffoldedAt?: number; handoffAt?: number };

export function readDesignGate(orgId: string): DesignGate {
  const raw = readWorkspaceFile(orgId, DESIGN_GATE_PATH);
  if (!raw) return {};
  try { return (JSON.parse(raw) as DesignGate) || {}; } catch { return {}; }
}
export function writeDesignGate(orgId: string, gate: DesignGate): void {
  try { writeWorkspaceFile(orgId, DESIGN_GATE_PATH, JSON.stringify(gate, null, 2)); } catch { /* best effort */ }
}
export function clearDesignGate(orgId: string): void { writeDesignGate(orgId, { skip: false }); }

// ── Design promotion state (design becomes the REAL frontend source) ─────────────────────────────────────────
// When a design is approved + handed off, its screens are PROMOTED into the project's served source (static stack =
// public/ served 1:1; framework = staged for a port). A tiny workspace file records what landed where so the planner
// can tell engineers to EXTEND the promoted UI (add backend on top) instead of rebuilding it. No schema/migration.
const DESIGN_PROMOTED_PATH = ".claude/design-promoted.json";
export type DesignPromoted = { at?: number; target?: string; served?: boolean; needsPort?: boolean; files?: string[] };

export function readDesignPromoted(orgId: string): DesignPromoted {
  const raw = readWorkspaceFile(orgId, DESIGN_PROMOTED_PATH);
  if (!raw) return {};
  try { return (JSON.parse(raw) as DesignPromoted) || {}; } catch { return {}; }
}
export function writeDesignPromoted(orgId: string, p: DesignPromoted): void {
  try { writeWorkspaceFile(orgId, DESIGN_PROMOTED_PATH, JSON.stringify(p, null, 2)); } catch { /* best effort */ }
}

/** Frontend project that hasn't been prototyped yet: no APPROVED design AND no screens in design-mock/. */
export function designNeedsPrototype(c: DesignContext): boolean {
  const hasScreens = c.designMockFiles.some((p) => /design-mock\/screens\/.+\.html?$/i.test(p));
  return !c.approved && !hasScreens;
}

/** Does this work involve UI / a screen / a visual surface? Used to route New Work / new features through Grace
 *  BEFORE execution (even when a design already exists). PT+EN keyword heuristic, word-boundary, case-insensitive. */
const VISUAL_RE = /\b(tela|telas|screen|screens|p[áa]gina|pagina|page|pages|web|webapp|web-?app|website|site|app|apps|aplicativo|aplica[çc][ãa]o|spa|single-?page|pwa|ui|ux|interface|frontend|front-?end|layout|component|componente|design|visual|dashboard|form|formul[áa]rio|formulario|bot[ãa]o|botao|button|modal|menu|nav|navbar|sidebar|card|landing|hero|gallery|galeria|theme|tema|palette|paleta|typography|tipografia|style|estilo|css|html|responsive|responsiv[oa]|mobile|desktop|tablet|anima[çc][ãa]o|animation|microintera[çc][õo]es|wizard|onboarding|checkout|perfil|profile|settings|configura[çc][õo]es|view|views|render)\b/i;
export function looksVisual(text?: string): boolean {
  return !!text && VISUAL_RE.test(text);
}

/** Clearly a NON-visual product (API / CLI / service / library / data / infra) AND no visual cue — used so the
 *  design gate can skip pure-backend work while still defaulting an ambiguous, signal-less brief to "visual".
 *  Includes PT+EN dev-environment/infra phrasing (servidor, .env, migrations, database) — a request like
 *  "configure my project to start the dev server" has nothing to do with UI and must never reach Grace. */
const BACKEND_RE = /\b(api|rest|restful|graphql|grpc|cli|command[\s-]?line|terminal|backend|back-?end|micro-?service|microservices|service|library|\bsdk\b|daemon|cron|scheduler|pipeline|etl|database|\bdb\b|banco de dados|infra|infrastructure|devops|webhook|message[\s-]?queue|\bqueue\b|worker|scraper|crawler|\bbot\b|middleware|server[\s-]?side|protocol|compiler|parser|scraping|servidor|dev[\s-]?server|ambiente(?:\s+de\s+desenvolvimento)?|vari[áa]vel(?:eis)?\s+de\s+ambiente|environment\s+variables?|migra[çc][ãa]o|migra[çc][õo]es|migrations?)\b|\.env\b/i;
export function looksBackendOnly(text?: string): boolean {
  return !!text && BACKEND_RE.test(text) && !looksVisual(text);
}

export { APPROVED_PATH };
