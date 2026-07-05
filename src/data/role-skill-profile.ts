/**
 * Role → skill profile. Maps each roster role to the slices of the native skills library it should be
 * auto-linked with, so a Frontend agent carries design + the chosen frontend stack, a Backend agent
 * carries the chosen backend/db/orm, Security carries OWASP, etc. — instead of an arbitrary 40 of ~180.
 *
 * Profiles key off the library's stable `relPath` PREFIXES (e.g. "design/", "stacks/frontend/"), not the
 * frontmatter domain/category (which is inconsistent across skills). Two kinds of prefix:
 *   - `allPrefixes`   → every skill under the folder is linked (stack-agnostic best practice).
 *   - `stackPrefixes` → only the skills the workspace's chosen stack actually selected (gated by the
 *                       stack→skill map) are linked, so a Vue project's Frontend gets `vue`, not react+svelte.
 * `core` lists the role's signature skills to PIN into the prompt (never trimmed); the resolver also pins
 * the chosen stack picks that fall under the role's `stackPrefixes` (so "vue"/"django" pin automatically).
 */
export type RoleSkillProfile = {
  /** Folders gated by the workspace stack picks (stacks/* — only the selected option is linked). */
  stackPrefixes: string[];
  /** Folders linked in full regardless of stack (design/engineering/process best practice). */
  allPrefixes: string[];
  /** Signature skills to PIN for this role (kept even under tight token budget). */
  core: string[];
};

const PROFILES: { match: RegExp; profile: RoleSkillProfile }[] = [
  {
    // CEO — plans, orchestrates: process playbooks, design awareness, high-level architecture.
    match: /\bceo\b|chief exec/i,
    profile: {
      stackPrefixes: [],
      allPrefixes: ["process/", "design/", "front-end/", "engineering/architecture/"],
      core: ["app-planning", "requirements-to-specs", "specs-to-issues", "architecture-before-code"],
    },
  },
  {
    // Product Owner — brief → specs/issues, backlog grooming.
    match: /product owner|\bpo\b|product manager/i,
    profile: {
      stackPrefixes: [],
      allPrefixes: ["process/"],
      core: ["product-discovery", "requirements-to-specs", "specs-to-issues", "prioritization-moscow-rice"],
    },
  },
  {
    // CTO — architecture across the whole chosen stack, security & performance posture.
    match: /\bcto\b|chief tech|tech lead|architect/i,
    profile: {
      stackPrefixes: ["stacks/"],
      allPrefixes: ["engineering/architecture/", "engineering/security/", "engineering/performance/", "process/architecture-before-code", "process/adr-technical-decisions"],
      core: ["system-design-fundamentals", "software-architecture-patterns", "architecture-before-code", "api-design-rest-graphql"],
    },
  },
  {
    // Frontend — design system + the chosen frontend / styling / meta-framework + frontend engineering.
    match: /front\s?end|\bui\b|\bux\b|web designer/i,
    profile: {
      stackPrefixes: ["stacks/frontend/", "stacks/styling/", "stacks/meta/", "stacks/mobile/", "stacks/testing/"],
      allPrefixes: ["design/", "front-end/", "engineering/frontend/", "engineering/performance/web-performance-core-vitals"],
      core: ["design-systems", "ui-ux-principles", "responsive-layout", "color-and-typography", "accessibility-wcag"],
    },
  },
  {
    // Backend — chosen backend framework / database / orm / queue / runtime + backend engineering.
    match: /back\s?end|server|\bapi\b/i,
    profile: {
      stackPrefixes: ["stacks/backend/", "stacks/database/", "stacks/orm/", "stacks/queue/", "stacks/runtime/", "stacks/baas/", "stacks/auth/"],
      allPrefixes: ["engineering/backend/", "engineering/architecture/", "engineering/performance/"],
      core: ["backend-fundamentals", "api-design-rest-graphql", "data-modeling", "auth-and-authorization"],
    },
  },
  {
    // Security / CyberSec — OWASP, ASVS, secrets, supply chain, secure auth; review posture.
    match: /cyber\s?sec|security|appsec|\bsec\b/i,
    profile: {
      stackPrefixes: ["stacks/auth/"],
      allPrefixes: ["engineering/security/", "process/security-by-design", "process/review-code-perf-security"],
      core: ["owasp-top-10", "owasp-asvs", "secrets-management", "secure-auth-sessions"],
    },
  },
  {
    // QA — testing strategy + the chosen test stack.
    match: /\bqa\b|quality|test/i,
    profile: {
      stackPrefixes: ["stacks/testing/"],
      allPrefixes: ["engineering/testing/", "process/testing-before-done"],
      core: ["testing-strategy-pyramid", "tdd-and-coverage", "unit-integration-e2e"],
    },
  },
  {
    // DevOps — infra / container / runtime + reliability; secrets handling.
    match: /devops|\bops\b|infra|platform|sre|deploy/i,
    profile: {
      stackPrefixes: ["stacks/infra/", "stacks/container/", "stacks/runtime/"],
      allPrefixes: ["engineering/architecture/scalability-reliability", "engineering/security/secrets-management"],
      core: ["scalability-reliability", "secrets-management"],
    },
  },
  {
    // Docs — documentation; knows the chosen stack to document it accurately.
    match: /\bdocs?\b|documentation|technical writer/i,
    profile: {
      stackPrefixes: ["stacks/"],
      allPrefixes: ["process/readme-generation"],
      core: ["readme-generation"],
    },
  },
];

const DEFAULT_PROFILE: RoleSkillProfile = {
  stackPrefixes: ["stacks/"],
  allPrefixes: ["process/", "engineering/practices/"],
  core: [],
};

/** Resolve a roster role string (e.g. "Frontend", "CyberSec", "Product Owner") to its skill profile. */
export function roleProfile(role: string | null | undefined): RoleSkillProfile {
  const r = (role ?? "").trim();
  for (const p of PROFILES) if (p.match.test(r)) return p.profile;
  return DEFAULT_PROFILE;
}
