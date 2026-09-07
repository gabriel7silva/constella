/**
 * Seed — migrates the prototype's mock data into the real DB:
 * default organization + workspace, the 9 agents, native skills,
 * connected providers, budget and a few goals/tasks.
 *
 *   pnpm db:seed
 */
import { randomUUID as uid } from "node:crypto";
import { db } from "./index";
import * as s from "./schema";

const WS = "ws_default";
const ORG = "org_default";
const USER = "user_operator";

const AGENTS = [
  { handle: "ada", name: "Ada", role: "CEO", color: "#e0a44e", reportsTo: null, dailyCapUsd: 15, tier: "critical" },
  { handle: "linus", name: "Linus", role: "CTO", color: "#9a5cff", reportsTo: "ada", dailyCapUsd: 40, tier: "critical" },
  { handle: "donald", name: "Donald", role: "Product Owner", color: "#4fc9b0", reportsTo: "ada", dailyCapUsd: 20, tier: "heavy" },
  { handle: "margaret", name: "Margaret", role: "Backend", color: "#3fb98f", reportsTo: "linus", dailyCapUsd: 50, tier: "heavy" },
  { handle: "grace", name: "Grace", role: "Frontend", color: "#5b8def", reportsTo: "linus", dailyCapUsd: 45, tier: "heavy" },
  { handle: "edsger", name: "Edsger", role: "QA", color: "#e8688f", reportsTo: "linus", dailyCapUsd: 25, tier: "heavy" },
  { handle: "werner", name: "Werner", role: "DevOps", color: "#f0a35e", reportsTo: "linus", dailyCapUsd: 20, tier: "heavy" },
  { handle: "barbara", name: "Barbara", role: "Docs", color: "#b3d97a", reportsTo: "ada", dailyCapUsd: 15, tier: "light" },
  { handle: "whitfield", name: "Whitfield", role: "CyberSec", color: "#c4a0ff", reportsTo: "linus", dailyCapUsd: 30, tier: "critical" },
] as const;

const SKILLS = [
  { name: "open-pr", summary: "Branch, commit, open a PR with a test plan and request CTO review.", trigger: "When a work product is ready to merge" },
  { name: "run-suite", summary: "Detect the package manager, run the test task and gate sign-off on red.", trigger: "Before any sign-off" },
  { name: "secret-scan", summary: "Scan for plaintext keys, verify vault references and flag log leaks.", trigger: "On every adapter change" },
  { name: "telegram-notify", summary: "Format a digest and POST it to the Telegram Bot API.", trigger: "When a routine completes", provisional: true },
  { name: "moscow-prioritise", summary: "Score backlog items and re-order them with the MoSCoW method.", trigger: "During backlog grooming" },
  { name: "gguf-validate", summary: "Pull a GGUF from the curated catalog, verify SHA-256 and bind to loopback.", trigger: "When installing a local model", provisional: true },
] as const;

// Providers are seeded as STRUCTURE only — no fabricated "connected" state or model
// counts. Cloud/local providers stay `needs_sync` (0 models) until the user adds a
// real vault key and syncs the real model list. The local Claude Code CLI is the one
// genuinely-available executor on this machine (3 real model aliases), so it ships
// connected; everything else becomes real only after a real sync.
const PROVIDERS = [
  { catalogId: "anthropic", adapter: "http_anthropic", auth: "api_key", status: "needs_sync", sync: "implemented", models: 0 },
  { catalogId: "openai", adapter: "http_openai", auth: "api_key", status: "needs_sync", sync: "implemented", models: 0 },
  { catalogId: "openrouter", adapter: "http_openrouter", auth: "api_key", status: "needs_sync", sync: "implemented", models: 0 },
  { catalogId: "groq", adapter: "http_groq", auth: "api_key", status: "needs_sync", sync: "implemented", models: 0 },
  { catalogId: "ollama", adapter: "local_ollama", auth: "local", kind: "local", status: "needs_sync", sync: "implemented", models: 0 },
  { catalogId: "claude_code", adapter: "cli_claude_code", auth: "cli", kind: "cli", status: "connected", sync: "manual", models: 3 },
] as const;

async function main() {
  console.log("Seeding Constella…");

  db.insert(s.user).values({ id: USER, name: "Operator", email: "operator@constella.dev", emailVerified: true }).onConflictDoNothing().run();
  db.insert(s.organization).values({ id: ORG, name: "Atlas Labs", ownerId: USER, runMode: "start" }).onConflictDoNothing().run();
  db.insert(s.member).values({ id: uid(), orgId: ORG, userId: USER, role: "owner" }).onConflictDoNothing().run();
  db.insert(s.workspace).values({
    id: WS, orgId: ORG, slug: "atlas-labs", name: "Atlas Labs",
    mission: "Ship autonomous developer tooling.", objective: "Reach v1.0.",
    stack: { language: "TypeScript", runtime: "Node.js", frontend: "React", backend: "NestJS", database: "PostgreSQL" },
  }).onConflictDoNothing().run();

  const agentIds: Record<string, string> = {};
  for (const a of AGENTS) {
    const id = "ag_" + a.handle;
    agentIds[a.handle] = id;
    db.insert(s.agent).values({
      id, workspaceId: WS, handle: a.handle, name: a.name, role: a.role, color: a.color,
      reportsTo: a.reportsTo, dailyCapUsd: a.dailyCapUsd, tierFloor: a.tier,
      status: a.handle === "ada" ? "working" : "idle",
      lastPulse: new Date(), health: "alive",
    }).onConflictDoNothing().run();
  }

  const skillIds: string[] = [];
  for (const sk of SKILLS) {
    const id = "sk_" + sk.name;
    skillIds.push(id);
    db.insert(s.skill).values({
      id, workspaceId: WS, name: sk.name, summary: sk.summary, trigger: sk.trigger,
      native: true, provisional: !!(sk as { provisional?: boolean }).provisional,
      indexed: (sk as { provisional?: boolean }).provisional ? "pending" : "indexed",
    }).onConflictDoNothing().run();
    // enable non-provisional natives for every agent
    if (!(sk as { provisional?: boolean }).provisional) {
      for (const h of Object.keys(agentIds)) {
        db.insert(s.agentSkill).values({ agentId: agentIds[h], skillId: id }).onConflictDoNothing().run();
      }
    }
  }

  for (const p of PROVIDERS) {
    db.insert(s.provider).values({
      id: "pr_" + p.catalogId, workspaceId: WS, catalogId: p.catalogId, adapter: p.adapter,
      kind: (p as { kind?: "cloud" | "cli" | "local" }).kind ?? "cloud",
      auth: p.auth, status: p.status, syncStatus: p.sync, modelCount: p.models,
      lastSync: null, // never synced at seed time — a real sync sets this
    }).onConflictDoNothing().run();
  }

  // Budget seeds the cap only. Spend is ALWAYS derived from real costEntry rows —
  // never a fabricated starting number.
  db.insert(s.budget).values({ workspaceId: WS, monthlyCapUsd: 400, monthlySpentUsd: 0 }).onConflictDoNothing().run();
  db.insert(s.plan).values({ workspaceId: WS, approved: false, auto247: false, stage: 4 }).onConflictDoNothing().run();

  // NOTE: no fabricated sprint cards, backlog, reports, findings or cost entries are
  // seeded. The Product Manager board, Planner, Reports, Security and Costs screens
  // start empty (honest empty states) and fill with REAL rows once agents actually
  // run — the CEO Planner generates specs/issues, agents generate reports, the Code
  // Review agent files findings, and every cost entry comes from a real CLI run.

  console.log("✓ Seed complete — org Atlas Labs / workspace atlas-labs (structural only; no fake metrics).");
}

main();
