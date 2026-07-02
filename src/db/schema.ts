import { sqliteTable, text, integer, real, primaryKey, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/* ============================================================
   better-auth tables
   ============================================================ */
export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  twoFactorEnabled: integer("two_factor_enabled", { mode: "boolean" }).notNull().default(false),
  addressAs: text("address_as").notNull().default(""),
  lang: text("lang").notNull().default("English (US)"),
  tz: text("tz").notNull().default("UTC"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  activeOrgId: text("active_org_id"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

/* ============================================================
   Tenancy: organization → workspace (isolated)
   ============================================================ */
export const organization = sqliteTable("organization", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ownerId: text("owner_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  runMode: text("run_mode", { enum: ["start", "auth", "vps", "portable"] }).notNull().default("start"),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export const member = sqliteTable("member", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["owner", "admin", "member"] }).notNull().default("owner"),
});

export const workspace = sqliteTable("workspace", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  mission: text("mission").notNull().default(""),
  objective: text("objective").notNull().default(""),
  stack: text("stack", { mode: "json" }).$type<Record<string, string>>().notNull().default({}),
  runMode: text("run_mode", { enum: ["off", "start", "auth", "vps", "portable"] }).notNull().default("start"),
  // Bootstrap content lifecycle: templates are always written (never empty); an optional
  // Claude pass may later tailor them. "template-only" = baseline, no LLM enrichment yet.
  bootstrap: text("bootstrap", { enum: ["pending", "template-only", "enriching", "done"] }).notNull().default("template-only"),
  settings: text("settings", { mode: "json" }).$type<{ editor?: { tabSize?: number; formatOnSave?: boolean; wordWrap?: boolean; minimap?: boolean }; integrations?: Record<string, boolean>; lastSecurityRun?: number; telegram?: { offset?: number }; github?: { repo?: string; login?: string; defaultBranch?: string }; source?: { type: "new" | "github" | "local" | "mock"; repo?: string; branch?: string; localPath?: string; importedAt?: number; fileCount?: number; analyzed?: boolean; analyzing?: boolean; analyzingAt?: number }; agents?: { maxConcurrent?: number; fileLocks?: boolean; webResearch?: boolean; autoReview?: boolean; cmdGuard?: boolean } }>(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

/* ============================================================
   Agents
   ============================================================ */
export const agent = sqliteTable("agent", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspace.id, { onDelete: "cascade" }),
  handle: text("handle").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  color: text("color").notNull().default("#e0a44e"),
  image: text("image"), // optional avatar image path (uploads/<id>/<name>); falls back to initials+color
  // Default to the working CLI runtime + a real CLI alias (the keyless HTTP path can't run).
  adapter: text("adapter").notNull().default("cli_claude_code"),
  model: text("model").notNull().default("sonnet"),
  temperature: real("temperature").notNull().default(0.4),
  // Reasoning/thinking effort — mapped to each CLI's native reasoning control where one exists.
  effort: text("effort", { enum: ["low", "medium", "high", "max"] }).notNull().default("medium"),
  dailyCapUsd: real("daily_cap_usd").notNull().default(25),
  tierFloor: text("tier_floor", { enum: ["light", "heavy", "critical"] }).notNull().default("heavy"),
  reportsTo: text("reports_to"),
  status: text("status", { enum: ["idle", "working", "review", "blocked"] }).notNull().default("idle"),
  health: text("health", { enum: ["alive", "stale", "down"] }).notNull().default("alive"),
  lastPulse: integer("last_pulse", { mode: "timestamp" }),
  // How this agent joined the workspace: "roster" = a native member (scaffold/backfill), "hired" = added
  // at runtime via the "Hire Agent" UI. hiredAt is set only for hired agents.
  origin: text("origin", { enum: ["roster", "hired"] }).notNull().default("roster"),
  hiredAt: integer("hired_at", { mode: "timestamp" }),
  // Reserved/dormant: a remote-gateway transport was prototyped then pulled (the OpenClaw Gateway's
  // device-auth made it impractical). Columns kept (default "cli"/null) to avoid a migration rollback.
  connectionMode: text("connection_mode", { enum: ["cli", "gateway"] }).notNull().default("cli"),
  gatewayHandle: text("gateway_handle"),
  persona: text("persona", { mode: "json" }).$type<{ identity: string; ritual: string; tone: string; systemPrompt: string }>(),
  rag: text("rag", { mode: "json" }).$type<{ repo: boolean; room: boolean; reports: boolean; skills: boolean; external: boolean; sources?: string[] }>(),
  orgX: real("org_x"),
  orgY: real("org_y"),
}, (t) => ({ wsIdx: index("agent_ws_idx").on(t.workspaceId) }));

export const pulse = sqliteTable("pulse", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspace.id, { onDelete: "cascade" }),
  agentId: text("agent_id").notNull().references(() => agent.id, { onDelete: "cascade" }),
  at: integer("at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  ok: integer("ok", { mode: "boolean" }).notNull().default(true),
  latencyMs: integer("latency_ms").notNull().default(0),
  note: text("note").notNull().default(""),
}, (t) => ({ agentIdx: index("pulse_agent_idx").on(t.agentId) }));

/* ============================================================
   Skills (Markdown procedures) + per-agent enablement
   ============================================================ */
export const skill = sqliteTable("skill", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspace.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  summary: text("summary").notNull().default(""),
  instructions: text("instructions").notNull().default(""),
  trigger: text("trigger").notNull().default(""),
  native: integer("native", { mode: "boolean" }).notNull().default(false),
  provisional: integer("provisional", { mode: "boolean" }).notNull().default(false),
  indexed: text("indexed", { enum: ["pending", "indexed"] }).notNull().default("pending"),
  // For a Vannevar-proposed skill (P3): the team role it targets, so approving it links to those agents.
  proposedRole: text("proposed_role"),
}, (t) => ({ wsIdx: index("skill_ws_idx").on(t.workspaceId) }));

export const agentSkill = sqliteTable("agent_skill", {
  agentId: text("agent_id").notNull().references(() => agent.id, { onDelete: "cascade" }),
  skillId: text("skill_id").notNull().references(() => skill.id, { onDelete: "cascade" }),
  // true = system-managed link (stack/role auto-link, reconciled on boot/stack-change);
  // false = the operator toggled it by hand in the UI → reconcile must never touch it.
  auto: integer("auto", { mode: "boolean" }).notNull().default(true),
}, (t) => ({ pk: primaryKey({ columns: [t.agentId, t.skillId] }) }));

/* ============================================================
   Providers + vault (secrets encrypted at rest) + local models
   ============================================================ */
export const provider = sqliteTable("provider", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspace.id, { onDelete: "cascade" }),
  catalogId: text("catalog_id").notNull(),
  adapter: text("adapter").notNull(),
  kind: text("kind", { enum: ["cloud", "cli", "local"] }).notNull().default("cloud"),
  auth: text("auth", { enum: ["api_key", "oauth", "cli", "local", "none"] }).notNull().default("api_key"),
  status: text("status", { enum: ["connected", "needs_sync", "error"] }).notNull().default("needs_sync"),
  syncStatus: text("sync_status", { enum: ["implemented", "manual", "not_implemented"] }).notNull().default("not_implemented"),
  modelCount: integer("model_count").notNull().default(0),
  lastSync: integer("last_sync", { mode: "timestamp" }),
  // Phase 3 rich status (additive nullable → clean ADD COLUMN). cliVersion: the installed CLI's
  // version string (CLI providers). defaultModel: the recommended/default model id. authState:
  // ready | needs_login | needs_key | unknown — drives the ready-vs-needs-config badge.
  cliVersion: text("cli_version"),
  defaultModel: text("default_model"),
  authState: text("auth_state"),
}, (t) => ({ wsIdx: index("provider_ws_idx").on(t.workspaceId) }));

// Secrets are NEVER stored on provider rows. Encrypted blob keyed by provider.
export const vault = sqliteTable("vault", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspace.id, { onDelete: "cascade" }),
  providerId: text("provider_id").references(() => provider.id, { onDelete: "cascade" }),
  ref: text("ref").notNull(),              // e.g. "openai_api_key", "github_pat"
  ciphertext: text("ciphertext").notNull(), // AES-GCM encrypted with CONSTELLA_VAULT_KEY
  iv: text("iv").notNull(),
});

// Cached, enriched per-provider model catalog (what the UI reads). Populated by
// refreshProviderModels from models.dev ∩ the provider's live /v1/models — never hardcoded.
// Replaced wholesale per refresh; additive table (db:push).
export const providerModel = sqliteTable("provider_model", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspace.id, { onDelete: "cascade" }),
  providerId: text("provider_id").notNull().references(() => provider.id, { onDelete: "cascade" }),
  catalogId: text("catalog_id").notNull(),
  modelId: text("model_id").notNull(),
  name: text("name").notNull().default(""),
  context: integer("context").notNull().default(0),
  outputLimit: integer("output_limit").notNull().default(0),
  inputCost: real("input_cost").notNull().default(0),   // USD / 1M input tokens (0 = unknown)
  outputCost: real("output_cost").notNull().default(0), // USD / 1M output tokens
  caps: text("caps", { mode: "json" }).$type<{ reasoning: boolean; tools: boolean; vision: boolean }>(),
  released: text("released").notNull().default(""),
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
  lastSeen: integer("last_seen", { mode: "timestamp" }).$defaultFn(() => new Date()),
}, (t) => ({ provIdx: index("provider_model_prov_idx").on(t.providerId) }));

export const localModel = sqliteTable("local_model", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspace.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  file: text("file").notNull(),
  quant: text("quant").notNull().default("Q4_K_M"),
  params: text("params").notNull().default(""),
  sizeBytes: integer("size_bytes").notNull().default(0),
  sha256: text("sha256").notNull().default(""),
  bind: text("bind").notNull().default("127.0.0.1:8080"),
  loaded: integer("loaded", { mode: "boolean" }).notNull().default(false),
});

/* ============================================================
   Goals, Tasks, Specs, Issues (CEO Planner pipeline)
   ============================================================ */
export const goal = sqliteTable("goal", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspace.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  ownerId: text("owner_id").references(() => agent.id),
  progress: integer("progress").notNull().default(0),       // cached rollup (recomputed by the runner)
  parentId: text("parent_id"),
  // A Goal is a unit of WORK born from a main spec, parent of the issues that complete it.
  status: text("status", { enum: ["active", "cancelled", "archived", "done"] }).notNull().default("active"),
  specId: text("spec_id"),                                  // the main spec this goal was born from
  archivePath: text("archive_path").notNull().default(""),  // ZIP path when archived (Phase 6)
  // Lifecycle timestamps. Nullable + app-side defaults so they ADD COLUMN cleanly (SQLite
  // rejects a non-constant DEFAULT like unixepoch() on ALTER). Backfilled for existing rows.
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()).$onUpdateFn(() => new Date()),
  doneAt: integer("done_at", { mode: "timestamp" }),
  cancelledAt: integer("cancelled_at", { mode: "timestamp" }),
  archivedAt: integer("archived_at", { mode: "timestamp" }),
  reopenedAt: integer("reopened_at", { mode: "timestamp" }),
}, (t) => ({ wsIdx: index("goal_ws_idx").on(t.workspaceId) }));

// Durable provenance: which workspace files a goal's tasks CREATED or EDITED. Captured
// from the runner's create/edit stream events (which are pruned, so we can't rely on them
// at archive time). Lets a Work archive ZIP ONLY that goal's produced source files.
export const goalFile = sqliteTable("goal_file", {
  workspaceId: text("workspace_id").notNull().references(() => workspace.id, { onDelete: "cascade" }),
  goalId: text("goal_id").notNull(),
  path: text("path").notNull(),
  op: text("op").notNull().default("edit"),               // created | edit
  at: integer("at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => ({ pk: primaryKey({ columns: [t.goalId, t.path] }) }));

export const task = sqliteTable("task", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspace.id, { onDelete: "cascade" }),
  key: text("key").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  col: text("col", { enum: ["triage", "todo", "doing", "blocked", "review", "done"] }).notNull().default("triage"),
  prio: text("prio", { enum: ["low", "med", "high"] }).notNull().default("med"),
  assigneeId: text("assignee_id").references(() => agent.id),
  goalId: text("goal_id").references(() => goal.id),
  // Links a task back to the issue it was materialized from (approvePlan bridge); lets the
  // runner mirror task progress onto the issue + makes the issues→tasks conversion idempotent.
  issueId: text("issue_id").references(() => issue.id),
  createdBy: text("created_by", { enum: ["operator", "agent"] }).notNull().default("operator"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()).$onUpdateFn(() => new Date()),
}, (t) => ({ wsIdx: index("task_ws_idx").on(t.workspaceId) }));

export const taskStep = sqliteTable("task_step", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspace.id, { onDelete: "cascade" }),
  taskId: text("task_id").notNull().references(() => task.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  done: integer("done", { mode: "boolean" }).notNull().default(false),
  active: integer("active", { mode: "boolean" }).notNull().default(false),
  ord: integer("ord").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()).$onUpdateFn(() => new Date()),
}, (t) => ({ taskIdx: index("task_step_idx").on(t.taskId) }));

export const spec = sqliteTable("spec", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspace.id, { onDelete: "cascade" }),
  key: text("key").notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull().default(""),
  authorId: text("author_id").references(() => agent.id),
  body: text("body").notNull().default(""),
  approved: integer("approved", { mode: "boolean" }).notNull().default(false),
  goalId: text("goal_id"),                                  // the work/goal this spec belongs to
  // Lifecycle independent of `approved`: a cancelled/archived goal cascades to its specs so the
  // Planner stops showing them as pending. Constant default → ADD COLUMN is clean.
  status: text("status", { enum: ["active", "cancelled", "archived"] }).notNull().default("active"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()).$onUpdateFn(() => new Date()),
});

export const issue = sqliteTable("issue", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspace.id, { onDelete: "cascade" }),
  specId: text("spec_id").references(() => spec.id, { onDelete: "cascade" }),
  goalId: text("goal_id"),                                  // parent goal (the work this issue completes)
  key: text("key").notNull(),
  title: text("title").notNull(),
  prio: text("prio", { enum: ["low", "med", "high"] }).notNull().default("med"),
  col: text("col", { enum: ["todo", "doing", "blocked", "review", "done"] }).notNull().default("todo"),
  moscow: text("moscow", { enum: ["Must", "Should", "Could", "Won't"] }),
  points: integer("points").notNull().default(0),
  assigneeId: text("assignee_id").references(() => agent.id),
  approved: integer("approved", { mode: "boolean" }).notNull().default(false),
  // Lifecycle independent of the workflow `col`: cancel/archive of the parent goal cascades here
  // so the Planner stops showing the issue as pending. Constant default → ADD COLUMN is clean.
  status: text("status", { enum: ["active", "cancelled", "archived"] }).notNull().default("active"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()).$onUpdateFn(() => new Date()),
});

export const plan = sqliteTable("plan", {
  workspaceId: text("workspace_id").primaryKey().references(() => workspace.id, { onDelete: "cascade" }),
  approved: integer("approved", { mode: "boolean" }).notNull().default(false),
  auto247: integer("auto_247", { mode: "boolean" }).notNull().default(false),
  stage: integer("stage").notNull().default(4),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()).$onUpdateFn(() => new Date()),
});

/* ============================================================
   Reports (.md), Notifications, Costs / Budget
   ============================================================ */
export const report = sqliteTable("report", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspace.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  type: text("type").notNull().default("Report"),
  authorId: text("author_id").references(() => agent.id),
  body: text("body").notNull().default(""),
  goalId: text("goal_id"),                                  // the work/goal this report belongs to (Phase 6 archive)
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export const notification = sqliteTable("notification", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspace.id, { onDelete: "cascade" }),
  kind: text("kind").notNull().default("info"),
  text: text("text").notNull(),
  detail: text("detail").notNull().default(""),
  agentId: text("agent_id").references(() => agent.id),
  // Link a notification to the exact message + channel that triggered it → "jump to point".
  messageId: text("message_id"),
  channel: text("channel").notNull().default(""),
  read: integer("read", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => ({ wsIdx: index("notif_ws_idx").on(t.workspaceId) }));

// Per-channel read cursor (operator) → drives accurate live unread badges.
export const channelRead = sqliteTable("channel_read", {
  workspaceId: text("workspace_id").notNull().references(() => workspace.id, { onDelete: "cascade" }),
  channel: text("channel").notNull(),
  lastReadAt: integer("last_read_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => ({ pk: primaryKey({ columns: [t.workspaceId, t.channel] }) }));

export const budget = sqliteTable("budget", {
  workspaceId: text("workspace_id").primaryKey().references(() => workspace.id, { onDelete: "cascade" }),
  monthlyCapUsd: real("monthly_cap_usd").notNull().default(400),
  monthlySpentUsd: real("monthly_spent_usd").notNull().default(0),
});

export const costEntry = sqliteTable("cost_entry", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspace.id, { onDelete: "cascade" }),
  agentId: text("agent_id").references(() => agent.id),
  provider: text("provider"),
  model: text("model"),
  // The chat channel this spend belongs to (room / dm:<handle> / telegram / design) so the context donut
  // can show real per-agent $ for THAT conversation. Null for non-chat runs (tasks, planning, kb, review…).
  // Added to existing DBs via a guarded ALTER ADD COLUMN in ensureKbTables (db:push is UNSAFE here).
  channel: text("channel"),
  usd: real("usd").notNull().default(0),
  tokens: integer("tokens").notNull().default(0),
  at: integer("at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => ({ wsIdx: index("cost_ws_idx").on(t.workspaceId) }));

/* ============================================================
   Code workspace files (editor)
   ============================================================ */
export const message = sqliteTable("message", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspace.id, { onDelete: "cascade" }),
  channel: text("channel").notNull().default("room"),
  fromKind: text("from_kind", { enum: ["operator", "agent"] }).notNull(),
  fromHandle: text("from_handle"),
  text: text("text").notNull(),
  // Workspace files an agent retrieved (RAG) to produce this reply — shown as source chips.
  sources: text("sources", { mode: "json" }).$type<string[]>(),
  // Operator-uploaded attachments (photos/PDF/docs), saved under uploads/ in the workspace so the
  // agent can read them with its file tools. ≤10/message.
  attachments: text("attachments", { mode: "json" }).$type<{ name: string; type: string; size: number; path: string }[]>(),
  // DM sessions: which session (chat_session) this message belongs to. NULL for room/Telegram and
  // for legacy DM messages (backfilled to "Session 1" on first session access). Additive nullable col.
  sessionId: text("session_id"),
  // The board task this message reports on (set when the runner posts a task's result), so the
  // Team Room can show a traceability chip → task / issue / goal. Additive nullable col.
  taskId: text("task_id"),
  // A render hint for special messages (e.g. "kb-card" = the structured Knowledge answer card with
  // action buttons + collapsible sources). NULL = a normal message. Additive nullable col.
  kind: text("kind"),
  // Synced-block slugs this reply proposed an edit to ([[KB-BLOCK …]]), shown as block chips on the
  // message so the room can see which canonical blocks a conversation touched. Additive nullable col.
  blocks: text("blocks", { mode: "json" }).$type<string[]>(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => ({ wsChanIdx: index("msg_ws_chan_idx").on(t.workspaceId, t.channel) }));

// Multiple conversation sessions per DM channel (fresh session = fresh agent context). DM only;
// the room + Telegram stay single-thread (no session rows). Additive table (surgical CREATE TABLE).
export const chatSession = sqliteTable("chat_session", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspace.id, { onDelete: "cascade" }),
  channel: text("channel").notNull(),                 // dm:<handle>
  title: text("title").notNull().default("Session"),
  active: integer("active", { mode: "boolean" }).notNull().default(false), // one active per (ws, channel)
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
}, (t) => ({ wsChanIdx: index("chat_session_ws_chan_idx").on(t.workspaceId, t.channel) }));

// Live runtime events streamed from agent runs (tool_use → action cards). One row
// per step; the UI replays them grouped by runId into Team Room work-blocks.
export const event = sqliteTable("event", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspace.id, { onDelete: "cascade" }),
  runId: text("run_id").notNull(),
  channel: text("channel").notNull().default("room"),
  agentId: text("agent_id").references(() => agent.id),
  seq: integer("seq").notNull(),
  kind: text("kind").notNull(),          // read | create | edit | run | search | thinking | text | done
  target: text("target").notNull().default(""),
  detail: text("detail").notNull().default(""),
  at: integer("at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => ({ chanIdx: index("event_chan_seq_idx").on(t.workspaceId, t.channel, t.seq), runIdx: index("event_run_idx").on(t.runId) }));

// The LATEST production-prep pipeline run per workspace (one row, upserted by workspaceId).
// Drives the Prepare-Deploy center: visual pipeline (steps JSON), the auto checklist, the last
// build log + export snapshot. Created via surgical boot DDL (ensureDeployTables) — never db:push.
export const deployRun = sqliteTable("deploy_run", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspace.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("idle"),     // idle | running | done | failed | blocked
  runId: text("run_id").notNull().default(""),           // ties to event rows / AgentRunLive resume
  steps: text("steps").notNull().default("[]"),          // JSON PipelineStep[]
  summary: text("summary").notNull().default(""),
  buildLog: text("build_log").notNull().default(""),
  checklist: text("checklist").notNull().default("[]"),  // JSON ChecklistItem[]
  lastExport: text("last_export"),                       // JSON ExportSnapshot | null
  startedAt: integer("started_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => ({ wsIdx: index("deploy_run_ws_idx").on(t.workspaceId) }));

// One compacted summary per (workspace, channel) — older messages are folded into
// this when the conversation outgrows the active model's context window.
export const messageSummary = sqliteTable("message_summary", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspace.id, { onDelete: "cascade" }),
  channel: text("channel").notNull(),
  sessionId: text("session_id"),    // DM session this summary covers (NULL for room/Telegram). Additive.
  summary: text("summary").notNull().default(""),
  throughId: text("through_id").notNull().default(""),
  msgCount: integer("msg_count").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => ({ wsChanIdx: index("msgsum_ws_chan_idx").on(t.workspaceId, t.channel) }));

// Structured decision log — the durable "source of truth" the Context Manager surfaces
// so agents (any model) keep continuity. Appended at decision moments (plan approved,
// issue blocked, spec rejected, task done, operator instruction).
export const decision = sqliteTable("decision", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspace.id, { onDelete: "cascade" }),
  goalId: text("goal_id"),                              // Phase 5/6 link (nullable for now)
  text: text("text").notNull(),
  rationale: text("rationale").notNull().default(""),
  by: text("by").notNull().default(""),                 // agent handle or "operator"
  source: text("source").notNull().default(""),         // plan-approve | issue-block | spec-reject | task-done | operator-instruction
  refKey: text("ref_key").notNull().default(""),        // issue/spec/task key for jump-back
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => ({ wsIdx: index("decision_ws_idx").on(t.workspaceId, t.createdAt) }));

export const file = sqliteTable("file", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspace.id, { onDelete: "cascade" }),
  path: text("path").notNull(),
  lang: text("lang").notNull().default("ts"),
  content: text("content").notNull().default(""),
  gitStatus: text("git_status", { enum: ["", "M", "A", "U", "D"] }).notNull().default(""),
}, (t) => ({ wsPathIdx: index("file_ws_path_idx").on(t.workspaceId, t.path) }));

export const routine = sqliteTable("routine", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspace.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  agentId: text("agent_id").references(() => agent.id),
  cmd: text("cmd").notNull().default(""),
  freq: text("freq").notNull().default("Daily"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
});

export const cronJob = sqliteTable("cron_job", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspace.id, { onDelete: "cascade" }),
  task: text("task").notNull(),
  agentId: text("agent_id").references(() => agent.id),
  at: text("at").notNull().default("00:00"),
});

export const cronRun = sqliteTable("cron_run", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspace.id, { onDelete: "cascade" }),
  task: text("task").notNull(),
  agentId: text("agent_id").references(() => agent.id),
  at: integer("at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  ok: integer("ok", { mode: "boolean" }).notNull().default(true),
});

export const finding = sqliteTable("finding", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspace.id, { onDelete: "cascade" }),
  sev: text("sev", { enum: ["high", "med", "low"] }).notNull().default("med"),
  title: text("title").notNull(),
  file: text("file").notNull().default(""),
  suggestion: text("suggestion").notNull().default(""),
  status: text("status", { enum: ["open", "fixed"] }).notNull().default("open"),
});

export const inboxItem = sqliteTable("inbox_item", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspace.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: ["approval", "budget", "question", "review", "block", "validation"] }).notNull().default("approval"),
  title: text("title").notNull(),
  detail: text("detail").notNull().default(""),
  fromAgentId: text("from_agent_id").references(() => agent.id),
  resolved: integer("resolved", { mode: "boolean" }).notNull().default(false),
  // What decision this item is about, so the Inbox can EXECUTE the real action (approve the
  // plan/spec/issue, open the channel) and auto-resolve when it's handled elsewhere.
  refType: text("ref_type"),   // plan | spec | issue | task | validation | question | goal
  refId: text("ref_id"),       // the row id (or workspaceId for the singleton plan)
  goalId: text("goal_id"),
  channel: text("channel"),    // jump target for chat-linked items
  messageId: text("message_id"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const plugin = sqliteTable("plugin", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspace.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
  native: integer("native", { mode: "boolean" }).notNull().default(false),
});

// Test Dev — a run of the project test harness (boot the project dev server, navigate it with
// Playwright, capture console/security findings, agent verdict). `findings` is a JSON array.
export const testRun = sqliteTable("test_run", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspace.id, { onDelete: "cascade" }),
  goalId: text("goal_id"),
  issueId: text("issue_id"),
  status: text("status", { enum: ["running", "pass", "fail", "inconclusive"] }).notNull().default("running"),
  summary: text("summary").notNull().default(""),
  findings: text("findings").notNull().default("[]"),   // JSON: { severity, kind, route, message }[]
  by: text("by", { enum: ["operator", "agent"] }).notNull().default("operator"),
  startedAt: integer("started_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  finishedAt: integer("finished_at", { mode: "timestamp" }),
}, (t) => ({ wsIdx: index("test_run_ws_idx").on(t.workspaceId) }));

export const activity = sqliteTable("activity", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspace.id, { onDelete: "cascade" }),
  agentId: text("agent_id").references(() => agent.id),
  action: text("action").notNull(),
  target: text("target").notNull().default(""),
  at: integer("at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => ({ wsIdx: index("activity_ws_idx").on(t.workspaceId) }));

/* ============================================================
   Product Manager: backlog (sprint cards reuse `issue`)
   ============================================================ */
export const backlogItem = sqliteTable("backlog_item", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspace.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  moscow: text("moscow", { enum: ["Must", "Should", "Could", "Won't"] }).notNull().default("Should"),
  points: integer("points").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => ({ wsIdx: index("backlog_ws_idx").on(t.workspaceId) }));

/* ============================================================
   RAG index — per-org embedding chunks over workspace .md (Ollama).
   Vectors are best-effort; retrieval falls back to keyword heuristic.
   ============================================================ */
export const ragChunk = sqliteTable("rag_chunk", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspace.id, { onDelete: "cascade" }),
  path: text("path").notNull(),
  chunk: text("chunk").notNull(),
  vector: text("vector"), // JSON float array; null when not embedded
  // KB layer: chunks emitted by a kb_entry carry its id + a lifecycle flag. State-aware retrieval
  // filters `obsolete = 1` so superseded/obsolete (or cancelled/archived) knowledge stops surfacing.
  // Both columns are added at boot via ensureKbTables (ALTER ADD COLUMN) for existing DBs.
  kbEntryId: text("kb_entry_id"),
  obsolete: integer("obsolete", { mode: "boolean" }).notNull().default(false),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => ({ wsIdx: index("rag_ws_idx").on(t.workspaceId, t.path) }));

/* ============================================================
   Doc index — DOCS/ + PO/ markdown live on disk (source of truth);
   this table only indexes them for listing + search. Content stays on disk.
   ============================================================ */
export const docIndex = sqliteTable("doc_index", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspace.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: ["docs", "po"] }).notNull(),
  path: text("path").notNull(),
  title: text("title").notNull().default(""),
  summary: text("summary").notNull().default(""),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => ({ wsIdx: index("docidx_ws_path_idx").on(t.workspaceId, t.path) }));

/* ============================================================
   Knowledge Base — the curated, classified, state-aware knowledge layer
   the Knowledge agent (Vannevar) owns on top of rag_chunk. A kb_entry is one
   unit of REUSABLE knowledge (a decision, a code-change, a finding, a spec…),
   classified by type + work/file refs, deduped by content hash, lifecycle-
   tracked (active → superseded → obsolete → archived) and emitting its own
   rag_chunk(s) (path `kb/<type>/<id>`) for semantic retrieval. Created at boot
   via ensureKbTables (CREATE TABLE IF NOT EXISTS). See docs/KB_RAG.md.
   ============================================================ */
export const kbEntry = sqliteTable("kb_entry", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspace.id, { onDelete: "cascade" }),
  // The knowledge taxonomy (docs/KB_RAG.md): decision | spec | issue | goal | plan | architecture |
  // business-rule | code-change | dependency | integration | bug | fix | test | review | vuln | doc |
  // user-context | history | command | file-structure | ui-pattern | stack | env-config | note
  type: text("type").notNull().default("note"),
  title: text("title").notNull(),
  summary: text("summary").notNull().default(""),     // technical summary (the KB Agent curates this)
  body: text("body").notNull().default(""),
  status: text("status", { enum: ["active", "superseded", "obsolete", "archived"] }).notNull().default("active"),
  // Classification refs (nullable) — the work/file this knowledge belongs to.
  goalId: text("goal_id"),
  specId: text("spec_id"),
  issueId: text("issue_id"),
  taskId: text("task_id"),
  module: text("module").notNull().default(""),
  paths: text("paths", { mode: "json" }).$type<string[]>(),  // files this knowledge concerns
  agentHandle: text("agent_handle").notNull().default(""),   // who produced it
  sourceKind: text("source_kind").notNull().default(""),     // task | goal | review | test | decision | spec | issue | note
  sourceRef: text("source_ref").notNull().default(""),       // origin id/key (jump-back)
  supersedesId: text("supersedes_id"),                       // the kb_entry this one replaces
  hash: text("hash").notNull().default(""),                  // content hash → dedup / update-in-place
  confidence: integer("confidence").notNull().default(70),   // 0..100
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => ({
  wsTypeIdx: index("kb_ws_type_idx").on(t.workspaceId, t.type),
  wsGoalIdx: index("kb_ws_goal_idx").on(t.workspaceId, t.goalId),
}));

// Per-file lock so two agents (or the same agent in two tasks) never edit the same file at once when
// agents run in parallel. Acquired just-in-time by the spawned CLI's PreToolUse hook (opt-in via
// CONSTELLA_AGENT_LOCK_HOOK=1); released on task completion / reclaimed by TTL. Created at boot.
export const fileLock = sqliteTable("file_lock", {
  workspaceId: text("workspace_id").notNull(),
  path: text("path").notNull(),                                  // workspace-relative, normalized fwd-slash
  taskId: text("task_id").notNull().default(""),
  agentId: text("agent_id").notNull().default(""),
  agentHandle: text("agent_handle").notNull().default(""),
  acquiredAt: integer("acquired_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  heartbeatAt: integer("heartbeat_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => ({ pk: primaryKey({ columns: [t.workspaceId, t.path] }) }));

// Audit trail of agent KB consultations — feeds the visual KB module's "agent query history".
export const kbQueryLog = sqliteTable("kb_query_log", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspace.id, { onDelete: "cascade" }),
  agentHandle: text("agent_handle").notNull().default(""),
  query: text("query").notNull().default(""),
  hits: integer("hits").notNull().default(0),
  mode: text("mode").notNull().default(""),                  // semantic | heuristic | none
  refs: text("refs", { mode: "json" }).$type<string[]>(),
  answeredAt: integer("answered_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => ({ wsIdx: index("kb_query_ws_idx").on(t.workspaceId, t.answeredAt) }));

// Synced knowledge blocks — one canonical, named knowledge unit (slug + body) edited in a single place
// and surfaced by reference everywhere (agent prompts, the welcome home, docs). Edited once → every
// surface reflects the latest. Distinct from kb_entry (auto-captured). Created at boot via ensureKbTables.
export const syncedBlock = sqliteTable("synced_block", {
  workspaceId: text("workspace_id").notNull().references(() => workspace.id, { onDelete: "cascade" }),
  slug: text("slug").notNull(),                            // stable handle, e.g. "official-stack"
  kind: text("kind").notNull().default("note"),            // mission | objective | stack | architecture | business-rule | ui-pattern | security | commands | deploy-checklist | review-checklist | glossary | policy | note
  title: text("title").notNull().default(""),
  body: text("body").notNull().default(""),                // canonical Markdown — the single source of truth
  version: integer("version").notNull().default(1),
  updatedBy: text("updated_by").notNull().default(""),     // agent handle or "operator"
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => ({ pk: primaryKey({ columns: [t.workspaceId, t.slug] }) }));

// Agent-proposed edits to a synced block — the operator / KB agent approves (merges) or rejects them.
export const blockProposal = sqliteTable("block_proposal", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspace.id, { onDelete: "cascade" }),
  slug: text("slug").notNull(),
  kind: text("kind").notNull().default("note"),
  title: text("title").notNull().default(""),
  body: text("body").notNull().default(""),
  byAgentHandle: text("by_agent_handle").notNull().default(""),
  status: text("status", { enum: ["pending", "merged", "rejected"] }).notNull().default("pending"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  decidedAt: integer("decided_at", { mode: "timestamp" }),
  decidedBy: text("decided_by").notNull().default(""),
}, (t) => ({ wsIdx: index("block_prop_ws_idx").on(t.workspaceId, t.status) }));

/* ============================================================
   Profile: notification prefs, personal access tokens, 2FA, passkeys
   ============================================================ */
export const notificationPref = sqliteTable("notification_pref", {
  userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  email: integer("email", { mode: "boolean" }).notNull().default(true),
  telegram: integer("telegram", { mode: "boolean" }).notNull().default(true),
  inapp: integer("inapp", { mode: "boolean" }).notNull().default(true),
  weekly: integer("weekly", { mode: "boolean" }).notNull().default(false),
  // Added via ALTER TABLE at boot (ensureKbTables) — constant DEFAULT 0 → clean ADD COLUMN.
  reducedMotion: integer("reduced_motion", { mode: "boolean" }).notNull().default(false),
});

// Real personal access tokens — only a SHA-256 hash is stored; plaintext shown once.
export const personalAccessToken = sqliteTable("personal_access_token", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  scope: text("scope").notNull().default("read"),
  tokenHash: text("token_hash").notNull(),
  prefix: text("prefix").notNull(),          // e.g. "cn_a1b2" — for display
  lastUsedAt: integer("last_used_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => ({ userIdx: index("pat_user_idx").on(t.userId) }));

// better-auth twoFactor plugin table (TOTP secret + backup codes per user).
export const twoFactor = sqliteTable("two_factor", {
  id: text("id").primaryKey(),
  secret: text("secret").notNull(),
  backupCodes: text("backup_codes").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
}, (t) => ({ userIdx: index("twofactor_user_idx").on(t.userId) }));

// WebAuthn passkeys (real, via @simplewebauthn). One row per registered credential.
export const passkey = sqliteTable("passkey", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull().default("Passkey"),
  credentialId: text("credential_id").notNull().unique(),
  publicKey: text("public_key").notNull(),   // base64url COSE public key
  counter: integer("counter").notNull().default(0),
  deviceType: text("device_type").notNull().default(""),
  backedUp: integer("backed_up", { mode: "boolean" }).notNull().default(false),
  transports: text("transports").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => ({ userIdx: index("passkey_user_idx").on(t.userId) }));

/* ============================================================
   Design module — visual prototyping before the plan
   (tables also created via ensureDesignTables() raw SQL at boot; db:push is UNSAFE here)
   ============================================================ */
export const designSession = sqliteTable("design_session", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspace.id, { onDelete: "cascade" }),
  title: text("title").notNull().default("Design session"),
  status: text("status", { enum: ["building", "approved"] }).notNull().default("building"),
  tokens: text("tokens", { mode: "json" }).$type<{ accent?: string; accentName?: string; theme?: "dark" | "light"; font?: string; fontName?: string; radius?: number; density?: number; fontScale?: number }>().notNull().default({}),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => ({ wsIdx: index("design_session_ws_idx").on(t.workspaceId, t.createdAt) }));

export const designPage = sqliteTable("design_page", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => designSession.id, { onDelete: "cascade" }),
  key: text("key").notNull(),              // landing, dashboard, pricing, login
  name: text("name").notNull(),
  tree: text("tree", { mode: "json" }),    // optional instrumented markup/structure
}, (t) => ({ sessIdx: index("design_page_sess_idx").on(t.sessionId) }));

export const designVersion = sqliteTable("design_version", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => designSession.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  note: text("note").notNull().default(""),
  patch: text("patch", { mode: "json" }),  // diff applied by the agent
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => ({ sessIdx: index("design_version_sess_idx").on(t.sessionId, t.createdAt) }));

export const designComment = sqliteTable("design_comment", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => designSession.id, { onDelete: "cascade" }),
  pageKey: text("page_key").notNull(),
  xp: real("xp").notNull(),                // % of the frame
  yp: real("yp").notNull(),
  body: text("body").notNull(),
  reply: text("reply").notNull().default(""),   // Grace's reply/action
  selection: text("selection", { mode: "json" }), // optional CanvasSelection
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => ({ sessIdx: index("design_comment_sess_idx").on(t.sessionId) }));

export type DesignSession = typeof designSession.$inferSelect;
export type DesignPage = typeof designPage.$inferSelect;
export type DesignVersion = typeof designVersion.$inferSelect;
export type DesignComment = typeof designComment.$inferSelect;

export type Agent = typeof agent.$inferSelect;
export type Skill = typeof skill.$inferSelect;
export type Task = typeof task.$inferSelect;
export type Goal = typeof goal.$inferSelect;
export type Provider = typeof provider.$inferSelect;
export type ProviderModel = typeof providerModel.$inferSelect;
export type ChatSession = typeof chatSession.$inferSelect;
export type Workspace = typeof workspace.$inferSelect;
export type Organization = typeof organization.$inferSelect;
export type BacklogItem = typeof backlogItem.$inferSelect;
export type Issue = typeof issue.$inferSelect;
export type PersonalAccessToken = typeof personalAccessToken.$inferSelect;
export type Passkey = typeof passkey.$inferSelect;
