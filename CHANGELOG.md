<!-- ✦ ⋆ ｡˚ Constella — Changelog ˚｡ ⋆ ✦ -->
# Changelog

All notable changes to **Constella** are documented here — the complete construction history of the
control plane, from the first scaffold (December 2025) to the current consolidated release.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project aims to
follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Constella is **pre-1.0**: minor versions
may still introduce breaking changes while the platform stabilises.

🇧🇷 Versão em português: [CHANGELOG.pt-BR.md](CHANGELOG.pt-BR.md)

---

## [0.9.0] — "Grok Build (xAI CLI) agents"

### Added
- **Grok Build — xAI's terminal-native coding agent — is now a hireable CLI adapter.** Grok Build (powered by
  Grok 4.5) runs headless over its ACP (Agent Client Protocol) JSON-RPC stdio interface (`grok agent stdio`) —
  the prompt travels in the JSON body over stdin (no command-line length limit) and it edits files + runs shell
  like the other agentic CLIs; Constella services its fs read/write + permission requests (auto-approved, jailed
  to the workspace). It is
  auto-detected on the machine at onboarding, appears in the provider catalog and the Hire / Agent Studio model
  pickers (models: `grok-code-fast-1`, `grok-4.5`, `grok-build-0.1`), and authenticates via the `grok` browser
  sign-in (SuperGrok / X Premium+) or the `GROK_CODE_XAI_API_KEY` env var. Install:
  `curl -fsSL https://x.ai/cli/install.sh | bash` (or `irm https://x.ai/cli/install.ps1 | iex` on Windows). No
  token/cost is emitted by the CLI, so those are recorded as 0 (honest). Distinct from the existing HTTP `xAI /
  Grok` provider (the REST API) — this is the local agent CLI.

## [0.8.0] — "One Grace chat: her DM builds the canvas"

### Changed
- **The Design module no longer has its own chat column — you talk to Grace in her DM (AGENTS dock), and
  that DM builds/updates the canvas.** Previously there were two separate Grace conversations (the Design
  module's left chat on the `design` channel + a generic `dm:grace` DM), which was redundant. Now Grace's DM
  rides the same `design` channel and each send runs the real prototype build (`askDesign`) — one thread,
  shown both in the dock and on the `/design` canvas, which paints live as she works. The Design chat was
  physically **moved** into her DM (a self-contained `design-chat.tsx`) with **identical** behavior — token
  streaming, suggestion chips, image attach/paste/drop, canvas element-attach, context donut + compact, Stop —
  and removed from the module (a thin left strip opens the DM). Opening `/design` auto-opens her DM alongside
  the canvas; picking a canvas element opens her DM scoped to that element. The canvas, Screens/Docs/Versions/
  Styles rail, comments and approve/handoff flow are unchanged.

### Fixed
- **Grace's Design replies were shown as `(couldn't respond: <her actual reply>)` and could be cut off.** On a
  long build the CLI run ended non-clean (turn cap / the 10-min timeout) while still producing her real final
  summary — the code treated that as a failure and wrapped the real reply in the error template. Now the reply
  text is delivered whenever it exists (the `(couldn't respond …)` template is reserved for a genuine no-output
  failure), the design build timeout is raised to 20 min so long builds finish instead of being truncated, and
  the run's result `subtype` is surfaced for diagnostics. Same fix applied to the handoff-docs run and the
  Team-Room/DM/Telegram reply path.

## [0.7.4] — "The worker can reach its own endpoints"

### Fixed
- **The background worker's endpoints were being redirected to `/login`, silently breaking the 24/7 tick,
  the Telegram inbound poll, and the disk→DB file-sync.** The session proxy (`src/proxy.ts`) only exempted
  the auth + health routes, so the worker's cookie-less `POST`s to `/api/cron/tick`, `/api/telegram/poll`
  and `/api/sync/file` were 307-redirected to `/login`; the worker's `fetch` followed the redirect, got the
  login HTML, and `res.json()` turned it into `{}` — logging a misleading `tick 200 {}` while nothing
  actually ran. Symptom the operator hit: **messages sent to the bot from Telegram never reached Constella**
  (outbound replies worked, since those don't go through the worker). These four routes already authenticate
  themselves with `CONSTELLA_WORKER_SECRET` (fail-closed 401 without it), so they're now exempted from the
  session gate — the secret still guards them. Also covers the agent lock-hook route `/api/locks/acquire`.
  Most visible on a network deployment (`--vps`), where the worker and browser are the same-origin but the
  worker carries no session.

## [0.7.3] — "Agents reply on a VPS"

### Fixed
- **On a network deployment (`--vps`) over plain HTTP, no agent ever replied — total silence.** Reaching the
  server on a Tailscale/LAN IP (e.g. `http://100.84.143.4:3000`) is **not** a browser *secure context*, where
  `crypto.randomUUID()` is `undefined`. The Stop-run feature generated the per-run token with it **client-side**,
  right after the operator's message was posted but before `agentRespond`; the call threw and the chat's
  `catch` swallowed it, so the reply never fired — no agent message, no server error, no DB row, the agent kept
  showing "idle". It only worked on `localhost`/`127.0.0.1` (a secure context), i.e. the local Windows box.
  Run tokens now come from a `newRunToken()` helper that falls back to `crypto.getRandomValues` (available in an
  insecure context) when `crypto.randomUUID` is missing. Affected the Team Room, DMs, the Welcome-Home chat and
  the Design (Grace) chat.
- The chat send/reply `catch` blocks now `console.error` client-side failures instead of swallowing them, so a
  browser-side error can never again silently kill a reply with no trace.

## [0.7.2] — "Design chat send fix"

### Fixed
- **Messages to Grace in the Design module silently didn't send.** The composer's "Grace is running" lock
  (`pending`) was cleared only by the live SSE message handler; on an SSE reconnect (tab refocus / dropped
  connection) `loadHistory()` repopulated the transcript without firing that handler, so the lock stuck `true`
  and every subsequent send was a no-op ("as if nothing was sent"). Added a safety net that clears the lock as
  soon as Grace's reply lands in the transcript — keyed to the run token (so it can't race an operator send),
  with a newest-agent-message fallback for the tokenless gate-scaffold / handoff runs.

## [0.7.1] — "Security triage"

### Security
- **SSRF (Critical) — the dev-server frameability probe.** `previewFrameableAction` guarded its `fetch` with a
  prefix-only regex (`^https?://(127\.0\.0\.1|localhost)`) that had no host-end anchor, so
  `http://127.0.0.1.evil.com/` slipped through. Replaced with structured `new URL()` parsing that requires an
  http(s) scheme AND an **exact** loopback hostname; anything else skips the probe entirely.
- **git argument-injection — GitHub import.** `cloneRepoIntoWorkspace` passed the branch straight into
  `git clone --branch <branch>`; a `--upload-pack=…`-style value was argument-injection (even under
  `shell:false`), and the `owner/repo` regex allowed a leading `-`. Now validates both, uses `--branch=<b>`,
  and adds git's `--end-of-options` before the positional args.
- **Preview URL scheme guard.** The Live-app and Test-Dev preview address bars now resolve through `new URL()`
  and accept **http/https only** (a pasted `javascript:`/`data:` URL falls back to the trusted dev-server
  URL) before the value reaches an `iframe src` / `href`.
- **Defense-in-depth.** `deleteOrg` now runs `assertOrgId()` before its recursive on-disk delete (already gated
  by DB ownership); workspace regex search caps an operator-supplied pattern's length to bound ReDoS.
- Triaged the repo's CodeQL alerts: fixed the genuinely-reachable ones above; the remaining path-injection
  reports are false positives — every workspace path already flows through the `safe()` + `assertOrgId()` FS
  jail (lexical **and** symlink containment) that CodeQL doesn't model as a sanitizer.

## [0.7.0] — "Stop, live updates, and honest planning"

### Added
- **Stop button in every chat.** While an agent is replying (Team Room, DM, Telegram, and the Design
  module's Grace chat), the Send button morphs into **Stop** in the same spot — one click interrupts the
  in-flight run immediately, kills its process, and frees the agent for the next message. A stopped run
  reads "⏹ Stopped by operator" instead of a fake error. Each run carries a client-generated token so the
  Stop targets exactly that run.
- **Global "Stop All" on Pulse.** A single control interrupts every running agent at once — parks each
  active goal's tasks (resumable per-task via the board's existing Unblock), aborts every other in-flight
  run (chat / Design / planner drafting / review / deploy / grooming), and frees every busy agent. Confirms
  first via the styled in-app dialog.
- **Live UI refresh when a plan finishes.** The Planner, Goals and PM boards now update on their own the
  moment a background plan job completes — no more leaving the page and coming back. Reuses the existing
  global heartbeat with a client-tracked planner cursor (survives a backgrounded/throttled tab; also
  re-checks on tab refocus).
- **Design Gate — "Skip and continue" + a persistent default.** The Design module's own "Ada is waiting on
  the design" banner now has a **Skip and continue** button (previously only the Planner page had one), and
  a new **Config → Design Gate** toggle ("Always skip design") lets you set the default once instead of
  skipping every time.

### Fixed
- **Chatting with Ada now actually creates the work.** When Ada said she'd turn a request into specs/issues,
  nothing was created and the DM went silent — two causes: the chat handler ignored whether a plan actually
  started, and the Design Gate silently held every chat-originated request on a never-designed project
  without ever posting back to the channel. Both fixed: the originating chat (DM or room) now always gets an
  honest outcome message — "plan ready", "sent to Grace for a design pass first", or a clear failure — and a
  DM-triggered plan's "Plan ready" now lands back in that DM, not only the Team Room.
- **A backend request no longer gets a fake UI mockup.** Asking Ada to "configure the dev server" (or any
  pure backend/infra/`.env`/migration/database request) is now correctly kept out of the Design module —
  the gate classifies the operator's actual latest message (not the whole conversation, which used to be
  contaminated by Ada's own reply mentioning "settings/") and a broadened backend vocabulary (`servidor`,
  `dev server`, `.env`, `ambiente`, `migração`, `banco de dados`, …) routes it straight to a plan. Grace
  also gained a third response mode: a concrete non-visual request is declined and sent back to the team,
  never prototyped.
- **Stop actually kills the process now.** Three real bugs behind "clicked Stop, agent still answered":
  on Windows `child.kill()` only killed the `cmd.exe` wrapper (the real `claude`/`codex` lived on) — now a
  `taskkill /T` tree-kill; a `detached` spawn flag flashed a visible console window and broke the piped
  stdin (every run failed "no output") — dropped on Windows; and the run registry was instantiated
  separately in the server-action vs `/api/runs` route bundles, so Stop looked in an empty map — the
  registry is now pinned to `globalThis` (one instance per process).
- **Dashboard hydration error.** The "updated Ns ago" relative times read `Date.now()` during render,
  mismatching server vs client — now computed from a single post-mount clock (no hydration diff).

### Notes
- **Stop / cancellation validated on Windows, Linux and a native VPS; macOS validation pending.** On
  macOS/Linux it uses the standard POSIX path (a detached process group signalled `SIGINT`, then `SIGKILL`
  after 5 s); the Windows-specific `taskkill /T` tree-kill exists because Windows has no equivalent process
  groups. The per-run token, `/api/runs` route and `globalThis` registry are identical across platforms.
- New `workspace.settings.design.autoSkip` flag — lives inside the existing settings JSON, no migration.

## [0.6.1] — "Fire agents, real model IDs, reasoning Effort"

### Added
- **Fire agent.** A hired agent (anyone added via "Hire an agent" — the native roster can't be fired,
  it's defined in code) can now be removed from the Org Chart card or Agent Studio's model tab. Firing
  re-points its direct reports to its own manager, clears the agent from every table that references it
  (history rows like cost/events/reports survive, attributed to nobody), and deletes its on-disk persona
  files.
- **Reasoning Effort.** A new per-agent **Effort** control (Low / Medium / High / Max) next to Temperature,
  in both Agent Studio and the Hire modal. On CLIs with a native reasoning-effort control (e.g. Codex) it's
  passed through on every run; elsewhere it's a no-op. New `agent.effort` column (default `medium`).
- **Real model IDs from the binary.** Agent Studio's model picker now pulls the **live, real model list**
  from the CLI itself for providers whose binary exposes one (Aider `--list-models`, OpenCode `models`),
  instead of a hand-curated guess — falling back to the curated list when the provider isn't connected/synced.
  The Codex curated list was corrected (it was missing real ids).

### Changed
- **Retired OpenClaw, Hermes and Gemini CLI everywhere** — every provider picker (Hire, Agent Studio, the
  Models screen, onboarding's detected-provider grid) now consistently hides them (a shared list replaces
  four independent, inconsistent filters — Hermes had actually been missed by the previous filter, and
  Gemini CLI was never filtered at all). Gemini CLI is discontinued upstream; OpenClaw/Hermes proved
  impractical to drive reliably. Existing agents already on those adapters keep running.

### Fixed
- **Stale Claude model label + a missing alias.** The Claude Code picker's "Sonnet" entry still labeled
  itself version 4.6 — cosmetic only, since the CLI's `sonnet` alias always resolves server-side to the
  current model (agents were already running Sonnet 5, the label just hadn't caught up). Corrected the
  label, and added the **`fable`** alias (`claude --help` lists it alongside `opus`/`sonnet`/`haiku`) as a
  4th selectable Claude Code model.
- **"Fire agent" used the native browser `confirm()`/`alert()`** — an unstyled OS dialog ("localhost:3000
  says…"), out of place next to every other action in the app. Replaced with an in-app `ConfirmDialog`
  (matches the app's modal styling) on both the Org Chart card and Agent Studio, with the error shown
  inline instead of a second `alert()`.

### Notes
- Jumps straight to `0.6.1` — an earlier `0.6.0` publish attempt was unpublished from npm before this
  content was finalized, and npm permanently blocks reusing a version string once it's been published.

## [0.5.1] — "Trim the Hire roster + org-chart fix"

### Changed
- **Dropped OpenClaw and Hermes from the Hire Agent picker.** Both runtimes proved impractical to drive
  reliably (OpenClaw's Gateway device-auth deadlocks a local CLI; Hermes' login flow), so they're no longer
  offered when hiring. The remaining CLI providers (Claude Code, Codex, Gemini, Aider, OpenCode, Copilot,
  Cursor, Cline, Kilo) are unchanged. Existing agents already on those adapters keep working.

### Fixed
- **Org-chart drag crash on a just-hired agent.** Dragging the card of an agent added after the page loaded
  threw `Cannot read properties of undefined (reading 'x')` — the canvas seeded its position map once at
  mount. New agents are now merged into the position state, and the drag handler guards a missing slot.

### Notes
- A remote-gateway transport was prototyped this cycle (briefly published to npm as **0.5.0**) and then
  **pulled** — the OpenClaw Gateway's per-connection device-auth makes a local CLI client impractical. `0.5.1`
  supersedes it. The dormant `agent.connectionMode` / `gatewayHandle` columns are kept (default `cli`) to
  avoid a migration rollback.

## [0.4.0] — "Hire Agent: add OpenClaw/Hermes from the Org Chart"

### Added
- **Hire Agent.** A "+ Hire agent" button on the Org Chart opens a modal to add a runtime agent (e.g.
  OpenClaw or Hermes) reporting to the CEO — provider + model from the CLI allowlist, role, budget tier,
  daily cap and persona. A **blocking pre-flight** checks the chosen CLI is installed AND signed in (an
  agent whose CLI isn't logged in would just fail on its first tick); the adapter/model are validated
  against the allowlist (no arbitrary command). New `agent.origin` (`roster` | `hired`) + `hiredAt` columns.

### Fixed
- **Roster agents silently ran the default model.** Onboarding and the boot roster-backfill inserted every
  agent WITHOUT its `adapter`/`model`, so each one fell to the schema default (`cli_claude_code`/`sonnet`)
  regardless of its definition — only the CEO (Ada) got the chosen provider. Agent creation is now a single
  source (`createAgentRow` / `hireAgent`) that writes adapter + model explicitly.
- **Profile "Save changes" gave no feedback** outside the Account tab — the header button was a silent no-op
  on Notifications / Connections / Sessions (those auto-save inline). It now confirms "✓ Saved" on every tab.

---

## [0.3.12] — "Leaner npm tarball (republish)"

### Changed
- **Leaner npm tarball.** Stopped shipping vendored test/coverage artifacts from inside `skills/`
  (`.coverage`, `scripts/tests/`, `__pycache__`, `*.pyc`) via `files`-array negation — dev junk that doesn't
  belong in a published package. (`.npmignore` can't trim within a `files`-allowlisted directory; the
  negation is the mechanism that works.)

### Note
- 0.3.11 was unpublished from npm, which permanently burns that version string (npm refuses to republish it).
  0.3.12 is the same product under a fresh version, plus the tarball trim above — no app/runtime change.

---

## [0.3.11] — "Onboarding polish: provider logos · no double-handoff · quiet sync"

### Fixed
- **"Hand off to Ada" could be double-submitted.** The button re-enabled and the progress bar reset when the
  `useTransition` settled — which happens *before* the slow navigation to the Planner finishes — letting the
  operator click again and kick off a second setup. The button + Back now stay locked and the bar pinned at
  100% through the redirect.
- **Worker sync flooded the log with `sync failed: fetch failed`.** A workspace seed creates hundreds of files
  at once; the watcher fanned out hundreds of simultaneous `fetch()`es and exhausted undici's socket pool.
  Sync POSTs are now concurrency-capped (8) and retry transient failures, and the watcher starts only after
  the server is up (no boot-time failures).

### Changed
- **Provider logos.** The detected-provider grid (onboarding) now shows real brand icons for the coding-agent
  CLIs that have them — Cursor, Cline, GitHub Copilot, OpenCode, Kilo Code, Hermes (Nous), Windsurf — instead
  of letter monograms. Aider / OpenClaw keep the monogram (no upstream icon).

---

## [0.3.10] — "Hardening: fail-loud on an incomplete DB schema + passkey verify diagnostics"

### Changed
- **Launcher fails loud on an incomplete schema.** After `drizzle-kit migrate`, the launcher now verifies the
  canonical `user` table exists; if it doesn't, it aborts with a clear message instead of booting a tableless
  app that 500s on every request (`no such table: user`). This catches the **silent partial migration** that
  happens when better-sqlite3 can't finish the schema on an unsupported Node major — **use Node 20/22 LTS**,
  not a brand-new major like Node 26.
- **Passkey verify now logs the real reason.** `register/verify` and `authenticate/verify` had a silent
  `catch {}` that returned a generic "verification failed" with nothing in the server log. They now log the
  underlying cause (origin / rpID / challenge mismatch, unknown credential, …) so a failed passkey ceremony is
  diagnosable.

---

## [0.3.9] — "Fix: passkey login was blocked by the auth proxy"

### Fixed
- **Passkey sign-in.** Logging in with a passkey failed with `Unexpected token '<', "<!DOCTYPE"… is not valid
  JSON`. The route-protection proxy redirected the *unauthenticated* `/api/passkey/authenticate/*` calls to
  `/login` (an HTML page), so the client's `response.json()` choked on HTML. The proxy now lets the passkey
  **authenticate** endpoints (options + verify) through — they run while logged out, by definition. Passkey
  **register** stays protected (it runs while logged in, and `register/verify` re-checks the session), so an
  unauthenticated caller still can't enrol a credential onto the operator account.

---

## [0.3.8] — "Dependency baseline: refresh + zod 4 · TypeScript 6 · @types/node 26"

Dependency hygiene after a clean security audit (`pnpm audit` → no known vulnerabilities): the
within-major refresh plus the held-back majors, adopted together. No app code changed (zod was only a
peer of better-auth, never imported directly); all gates green.

### Changed
- **Within-major bumps:** `better-auth` 1.6.19 → 1.6.22, `@simplewebauthn/server` 13.3.1 → 13.3.2,
  `@playwright/test` 1.61.0 → 1.61.1 (+ dev `eslint` → 10.6.0, `typescript-eslint` → 8.62.0).
- **zod 3 → 4.** Adopted to match `better-auth` (its `better-call` dependency now peers `zod@^4`),
  clearing the unmet-peer warning. Constella never imports zod directly — it is a peer of better-auth —
  so this is a dependency-only change, no schema migration.
- **TypeScript 5.9 → 6.0** + **`@types/node` 22 → 26** (both dev). Typecheck, lint, the clean
  production build, and the boot/login smoke test all pass under the new toolchain.
- **Runtime target unchanged** (`engines: node >=20`). Node 26 the runtime is not GA yet — only the
  `@types/node` types moved to 26; Constella still runs on Node 20/22/24.

---

## [0.3.7] — "Open source: full source goes public"

Constella goes **fully open-source**: the public GitHub repo now carries the complete `src/`, not a
source-less compiled mirror. A pre-publication scrub and third-party licensing are in place.

### Open source
- **Full source published.** `scripts/publish-public.mjs` now ships the whole source tree (`src/`, `bin/`,
  `scripts/`, the native skills library, configs, generated migrations) — excluding only test config
  (`e2e`/`tests`/Playwright) and the internal release guide (the per-locale `PUBLISHING.md`). No committed
  build: the compiled `.next` still reaches users through the npm tarball, not git.
- **`THIRD_PARTY_LICENSES.md`** added at the root — indexes every bundled Agent Skill by license (Apache-2.0
  © Anthropic, MIT © Leonxlnx, and the proprietary Anthropic document skills), each folder keeping its own
  authoritative `LICENSE`.

### Changed
- **Pre-publication scrub.** Neutralised third-party brand mentions and removed personal paths / example PII
  from the code and docs (the `skills/` content keeps its own references — those are public web skills).

### Docs
- Re-framed the published docs for the open-source flow (the public repo is full source, not a disposable
  compiled mirror) and corrected stale "VPS runs in Docker" claims to the real **native** model
  (npm + systemd + Tailscale).

---

## [0.3.6] — 2026-06-26 — "Hardening pass"

A whole-project code review — **security, correctness and robustness**. Highlights:

### Security
- **Operator-account takeover closed.** The signup takeover guard keyed off the `.env` flag ALONE; a
  restored/copied `constella.db` (flag absent, credential present) let an unauthenticated caller reset the
  operator's password. The DB credential is now the source of truth (signup action **and** login screen).
- **Secret scanning hardened.** The commit/export scan now catches GitHub fine-grained PATs (`github_pat_…`);
  the public-publish scan covers `.cjs/.cts` files and iterates ALL matches of validated patterns (a
  placeholder no longer hides a real secret later in a file).
- **Web-research allowlist** re-validates the FINAL url host after redirects (and matches port-bearing hosts).
- **Live-inspect spoofing closed** — the canvas only trusts a `live:select` message from its own iframe.

### Fixed
- **RAG reindex** no longer wipes curated KB-entry chunks (scoped to non-KB chunks).
- **Runner:** a null-assignee task can't deadlock the queue; an agent isn't left stuck "working" after a throw;
  a relay failure can't abort a task's own bookkeeping; the "update available" notice stops re-appearing after
  you dismiss it.
- **Telegram:** a failed ingest no longer drops the operator's message (offset advances only on success); the
  inline-button allowlist is default-deny.
- **Dev server:** detached process group (a clean stop no longer orphans the real server) + an in-flight boot
  lock (no second server spawned on a concurrent start).
- **Local models:** stopping the chat server (:8082) no longer also kills the RAG embedding server (:8083).
- **Dates:** report + profile no longer render far-future (year-57000) timestamps.
- Plus markdown-patch `$`-escaping, prerelease-aware update checks, a stdin-EPIPE crash guard, and a long tail
  of data/UI/script fixes.

### Changed
- **VPS one-click self-update hardened:** invoke the SAME absolute npm/systemctl the sudoers rule uses, scope
  the rule to `constellai@latest` (drop the `@*` wildcard), and always (re)write the drop-in so a stale one
  self-heals.
- **Docs:** an honest **compatibility status** in the README (Windows primary · Linux experimental · macOS
  untested · portable in validation) + a **[roadmap](docs/roadmap.md)** skeleton.

---

## [0.3.5] — 2026-06-26 — "VPS update polish"

### Fixed
- **Dropped the wrong "(Docker)" label** on the VPS update context. Constella's VPS mode is **native** — systemd +
  Tailscale, **no Docker** — so the Update module now reads "Running on a VPS — one-click self-update".
- **The passwordless self-update drop-in is no longer skipped at setup.** `visudo` lives in `/usr/sbin`, which
  isn't on a non-root user's PATH, so the install/update scripts' `visudo -cf` check failed with "command not
  found" and silently never wrote `/etc/sudoers.d/constella` — leaving one-click VPS updates un-enabled. The
  scripts now resolve `visudo` explicitly (`/usr/sbin/visudo` fallback) and validate **through `sudo`**, and the
  sudoers body is pure ASCII (no em-dash) to remove any locale-parse risk.

---

## [0.3.4] — 2026-06-26 — "A VPS updates itself"

The **Update now** button finally does the whole thing on a server — no shell, no copy-paste.

### Added
- **One-click updates on a VPS.** Pressing **Update now** in the Update module now installs the new release and
  restarts the service **by itself**. It updates the global package, lets **systemd** cycle the unit onto the new
  code, and the page **reloads itself** once the server answers again — it waits out the ~3s restart instead of
  landing on a dead connection. Before, a VPS could only print the manual command for you to run.
- **Scoped passwordless self-update.** `vps-install.sh` (and `vps-update.sh`) now drop a tightly-scoped
  `/etc/sudoers.d/constella` that grants the service user **NOPASSWD for exactly two commands** —
  `npm install -g constellai[@version]` and `systemctl restart constella` — and nothing else. It's validated with
  `visudo` before it's installed, so a malformed rule can never lock you out of sudo.

### Note
- **Bootstrap.** Hosts installed before 0.3.4 don't have the sudoers drop-in yet, so the **first** update still
  uses the shell — run the VPS one-liner once
  (`curl -fsSL …/scripts/vps-update.sh | bash`). That run writes the drop-in; **every update after is one-click**
  from the button.

---

## [0.3.3] — 2026-06-26 — "Avatar photos show everywhere"

### Fixed
- **Avatar photos show in the home chat + @-mention list** — the home page passed the operator without its
  `image`, so an uploaded operator photo never appeared there (always the "OP" initials), and the @-mention list
  also dropped the agent image. Both now thread the saved avatar (the chat dock + sidebar already did). Avatars
  are small data URLs in the DB.

---

## [0.3.2] — 2026-06-26 — "Install & onboarding fixes"

A point release fixing first-run on Windows and on a VPS.

### Fixed
- **`npx constellai` works on Windows** — the package now ships a matching **`constellai`** bin (alongside `constella`),
  so `npx constellai --start` no longer fails with `'constella' is not recognized` (npx needs a bin named like the
  package). A global install still exposes the short `constella` command.
- **Onboarding no longer freezes at "Setting up… 100%"** — the workspace was created, but a client-side `router.push` +
  `router.refresh` inside a transition stalled on the redirect handshake. It now hard-navigates to the Planner
  (`window.location`), so onboarding finishes reliably in **every** mode (`--start` / `--vps` / `--portable`).
- **VPS: the systemd service now sees your CLIs** — `constella.service` had no `PATH`, so it ran with systemd's minimal
  PATH and couldn't find per-user CLIs (Claude Code / Codex / …); the onboarding "detected providers" missed them and
  agent runs couldn't spawn the binary. `vps-install.sh` now bakes a full `Environment=PATH` into the service (covers
  **all** CLIs). On an existing host: symlink the CLI into `/usr/local/bin`, or add a `PATH=` systemd drop-in — see
  [Troubleshooting](docs/en/TROUBLESHOOTING.md).

---

## [0.3.0] — 2026-06-26 — "Design = the real project: text-only canvas · Live Inspect · promotion · resilience"

First clean public release. The Design module becomes the front of the build pipeline: every visual request routes
through Grace, the approved design **becomes the real served frontend** (not a throwaway reference), the operator keeps
iterating **after** approval, and the whole loop survives crashes and provider limits. Controllable from the UI **and**
Telegram.

### Added
- **Design canvas — a faithful, text-only visual editor.** Select / Edit / Markup / Comments / Inspect / Preview modes;
  whole-prototype **browser-style zoom**; per-screen **Save / Reset / History** (undo/redo); live **theme** toggle;
  **breakpoints** (Desktop / Tablet 768 / Mobile + custom width) that drive a real reflow. Edit mode = **click a text
  element → inline edit with a caret**, with a live **Saving… / Saved** indicator. The canvas is a *reference* that
  stays faithful to the mock — structural changes go through Grace, not direct manipulation.
- **Docs tab** — renders Grace's written design docs (`design-system.md`, `components.md`, `handoff.md`, `decisions.md`,
  `APPROVED.md`) as markdown inside the rail.
- **Styles panel — live design tokens** — palette + secondary/surface/semantic colours, body & heading fonts, weight /
  line-height / letter-spacing, radius / border / shadow, spacing & motion; the canvas re-skins instantly.
- **Multi-file CSS authoring** — Grace writes `design-mock/styles/global.css` (tokens/reset/theme) + per-component +
  animations files and `<link>`s them; the canvas **inlines** them (the sandbox only renders inline CSS) and the
  production build bundles + minifies/obfuscates. Clean modular source, working live preview.
- **Domain/style-aware RAG + skill selection** — Grace extracts keywords from the brief, mission, objective, attached
  mock and your message, expands them through a domain+style lexicon (hotel → booking/hospitality; "native mobile" →
  glassmorphism/microinteractions/premium type) and **ranks the seeded skills** by name/tags/description, telling her
  to read the most relevant ones first — not a flat generic list.
- **The Design → Grace → Ada → Execution flow.** A planner **design gate** holds a frontend/visual plan until the UI is
  prototyped + approved (robust visual-product detection — works even with no explicit frontend stack; **New Work /
  new visual features route through Grace too**, even after a design exists; a one-shot "Generate plan anyway" bypass).
  The CEO Planner shows a strong **"Design step pending"** recommendation with **Open Design**.
- **"Send to execution"** — Grace writes the **complete handoff documentation** (design system, components, screen
  specs, decisions) from the approved screens, then **automatically activates the CEO** (the first plan, or a tracked
  New Work) — visible live on the Planner.
- **Design promotion — the approved design BECOMES the real frontend.** On handoff, Grace's screens are promoted into
  the project's served source: a **native/static stack is served 1:1** (screens → `public/`, the static server is
  wired to serve them — the running app IS the approved design, 100% fidelity); a **framework stack** is staged + a
  "port" issue is planned. Engineers then **EXTEND** it (wire real data/backend/states on top) — they never rebuild
  the UI. Re-approving a design flows as an "apply design update" issue (it never clobbers wired code).
- **Telegram design control** — push notifications for mock-imported, prototype/approval-pending, docs-ready and
  handoff-received; a **canvas → text** summary (screens, sections, form fields, buttons, responsive) for review from
  the phone; and **Approve / Reject / Request-changes** buttons where **Approve auto-runs Send-to-execution**.
- **Live-app canvas + Inspect (any stack)** — a **Design / Live** toggle renders the project's **real running dev
  server** in the canvas (React / Vue / Svelte / Next / static), reusing the Test Dev boot + frameable probe. An
  **Inspect** toggle routes it through an inject proxy that stamps a click-capture script into the real app: click an
  element → its context (tag / text / CSS selector / route) pre-fills **"Ask Grace to change THIS element"** → she edits
  the real source → HMR repaints. (Precise *file:line* build-time stamping is the next step.)
- **Keep iterating after approval** — the Grace chat, image paste/drop, edit toolbar and "new screen" stay enabled
  after approval; a terminal **"Handed off to execution · Ada is building"** banner replaces the bare re-offer; any edit
  since the last send flips the execution button to **"Send update to execution"**, and **"Approve changes"** re-approves
  the current design as the official reference.
- **Grace keeps source + docs in sync** — a Styles-panel change on an approved design auto-asks Grace to reconcile
  `design-mock/styles/global.css` + `design-system.md` to the canvas (the canvas is the source of truth) — she does it,
  never just asks.
- **Visual-fidelity check** — the Test Dev harness captures a **baseline** of each approved design screen and
  **pixel-diffs** the running app against it (in-browser, no new deps; 1280×800). A structurally-wrong screen
  (>50% different) **fails the gate** — so "matches the design" is enforced, not just asked. Best-effort + isolated.
- **Update docs** — a user-facing **`docs/UPDATE.md`** (the Update module's "docs" button target) and an **`ISSUE.md`**
  to register bugs / errors against the public release.
- **Context donut — per-conversation, per-agent cost.** The chat-header context widget now shows each agent's tokens
  **and `$` spend for THIS conversation only** (a new `cost_entry.channel` tags spend by channel; added via a guarded
  `ALTER ADD COLUMN`), with a `tks` unit, a `<1%` floor and an inline explainer. Lifetime totals stay in **Costs**.

### Changed
- **Composer suggestions are forward next-steps only.** Completed-action / past-tense phrases ("removi o botão", "fixed",
  "cleaned"…) are filtered out (PT + EN) — chips are useful next moves ("Adjust the palette", "Approve design",
  "Send to execution"), never an echo of what Grace just did.
- **The CEO Planner + executors are told to EXTEND the promoted UI, not rebuild it** — frontend issues wire backend and
  data on top of the promoted screens, preserving their markup/CSS exactly (zero drift).
- **The Design canvas editor is text-only** — the design is a *reference* that must stay faithful to the approved mock,
  so direct structural manipulation (add / move / resize / group / align / z-order…) was intentionally left out; the
  design system stays tunable live via the **Styles** tab, and anything structural is changed by asking Grace.

### Fixed
- **Resilience — runs survive provider limits, network blips and restarts.** Agent runs now **retry transient failures**
  (429 / quota / overloaded / 5xx / network) with a 1 → 5 → 15-minute backoff, surfaced live on the stream (cancellations
  and process timeouts are NOT retried). The Design → execution **handoff is idempotent + resumable**: a crash mid-handoff
  is **re-kicked on boot** and shows a **"Resume handoff"** pulse in the module; and it **hard-fails** — the CEO is only
  activated when Grace actually wrote the docs (never a half-baked plan).
- **Prototype navigation no longer breaks out of the canvas** — clicking an in-page nav link in Preview switches between
  the prototype's own screens instead of navigating the sandbox frame to the app's login.
- **Live canvas** — the preview iframe no longer warns on an empty `src` (it falls back to the dev-server URL).

---

## [0.2.30-build-stable] — "Design module: Grace becomes a real visual designer"

The Design-module overhaul — Grace gains a real designer identity, sees and tests her work, and the agent
runtime that powers her (and every other agent) is fixed. Shipped together as a validated stable build.

### Fixed
- **Every agent run failed with "Not logged in · Please run /login" — fixed.** A **Constella bug, not a
  Claude/login problem.** The destructive-command guard (`cmdGuard`) defaulted **ON** and ran every agent
  through a clean, isolated `CLAUDE_CONFIG_DIR` that copied **only** `~/.claude/.credentials.json`. The current
  Claude Code CLI also needs the account/onboarding state in `~/.claude.json` (`hasCompletedOnboarding`,
  `oauthAccount`, `userID`) to consider itself logged in under a relocated config dir — so the isolated
  `claude -p` run reported "Not logged in", surfaced as the agent's reply. **Design, DMs, Team Room and Telegram
  were all affected.** Fix: `agentClaudeDir()` now mirrors **both** files (fresh each spawn), and `cmdGuard`
  defaults **OFF (opt-in)** like the file-lock hook (both share the clean-config isolation that can drop the
  login). The default run uses the operator's real `~/.claude` with a `disableAllHooks` overlay (auth intact).
  The Design / DM / Team-Room / Telegram paths also push the per-spawn agent flags from the workspace settings,
  and a failed run now shows an honest diagnostic instead of the raw "/login" text.

### Added
- **`constella-design` skill — Grace's dedicated Design-module persona.** A new native design skill
  (`skills/design/constella-design/SKILL.md`) gives Grace an in-character identity inside the Design module: a
  hands-on visual designer / prototyper (not a generic agent) who greets the operator and offers to build, talks
  about the interface, builds stack-specific prototypes under `design-mock/`, reads attached images / references,
  builds mocks, **tests the visual behavior before claiming done**, tunes the design system, writes design docs,
  and prepares the CEO Planner handoff. Auto-loaded on the `design` channel (the Design run leads Grace's prompt
  with it, read straight from the skills library).
- **Image attachments in the Design chat** — a paperclip button, drag-and-drop, and paste (Ctrl+V). Screenshots,
  references and mocks upload into the workspace and Grace **reads them with her file tools** (the CLI supports
  images) as the visual brief; text is optional when an image is attached. Inbound **Telegram photos** already
  reach the agent the same way (verified end-to-end). Welcome / Team Room / DM keep their click-to-attach.
- **The Design canvas renders Grace's real screens.** Her generated HTML screens (`design-mock/screens/*.html`)
  now render **LIVE in a sandboxed iframe** (`sandbox="allow-scripts"` — isolated opaque origin, no access to the
  app), with a screen selector for multiple screens. A path-validated `getDesignScreen()` server action serves
  the HTML. Grace's run is also grounded in the **current design tokens** (palette / typography / radius / theme
  the operator set on the canvas) so she builds consistent with the live state.
- **A large design-skills library (200+ playbooks)** under `skills/design/` — design systems, palette,
  typography, layout, composition, motion, components and platform-specific craft Grace consults while
  prototyping. Seeded into each workspace and auto-linked to the Frontend role (and the CEO).

### Changed
- Docs: `CONSTELLA_AGENT_CMD_GUARD` is documented as **default off (opt-in)** across CONFIGURATION / SECURITY /
  AI_ARCHITECTURE (EN + PT); the clean-config isolation now mirrors credentials **and** account state.

> Next iteration on top of this: the interactive editable canvas layer (select / edit / markup / comments on the
> rendered screen) and automated headless-browser validation of the prototype.

---

## [0.2.28] — "Update a running VPS without a checkout"

### Docs
- **Updating Constella on a VPS while it keeps running is now documented for native installs.** Every VPS doc
  (UPDATE, VPS_MODE, OPERATIONS, DEPLOY, INSTALLATION — EN + PT, plus both READMEs) previously showed only
  `bash scripts/vps-update.sh`, which assumes a git checkout of the repo. A native install (`curl … install.sh`
  or `npx constellai --vps`) has no `scripts/` directory locally. The docs now lead with the **curl-pipe** form —
  the same pattern `install.sh` / `vps-clean.sh` already use:
  `curl -fsSL …/scripts/vps-update.sh | bash` (append ` -s -- <version>` to pin a version or roll back) — and
  keep the from-checkout form and the fully manual one-liner
  (`sudo npm install -g constellai@latest && sudo systemctl restart constella`).
- Clarified that the update applies **while the service keeps running**: `npm install -g` swaps the package on
  disk without touching the live process, then `systemctl restart constella` cycles in the new version in a
  ~2–3s blip; `~/.constella` (DB, secrets, login, workspaces) is preserved and the idempotent drizzle migrations
  run automatically on the next boot. Roll back any time by pinning the previous version.

---

## [0.2.27] — "Design canvas: clean, empty, real — no sample mock"

### Changed
- **The Design canvas no longer ships a fake "Nova AI" sample prototype.** That hardcoded landing/dashboard/
  pricing/login content (and the fake screen/component/version/deliverable lists) was demo data transplanted
  from the reference design tool — removed, in line with Constella's "everything real, no fakes" rule. The
  canvas now opens **empty** with a real empty state ("No prototype yet — ask the frontend agent to build the
  first screen"); the right rail shows **real** project context, the design files Grace produces under
  `design-mock/`, the **persisted** design-system tokens (palette/typography/radius/theme, saved to the design
  session), and an honest (empty) version history. The chat is the real frontend agent (Grace) and Approve
  writes the real `design-mock/APPROVED.md` + records the decision in the KB/RAG.

> The interactive editable canvas (select/edit/markup/comments/inspect) returns in a follow-up — operating on
> Grace's **real generated screens** rendered in a sandboxed frame, never on a mock.

---

## [0.2.26] — "Stack validity, Home modal, Skills filter, and a handful of fixes"

### Fixed
- **Project Stack never keeps a blocked option selected.** Picking an option that makes an earlier pick
  incompatible (e.g. `Node.js` then `Python`) now **auto-deselects** the blocked one and shows why
  ("Node.js was unselected automatically — Needs a JavaScript/TypeScript language"). A reconcile pass runs to a
  fixpoint (cascades settle) and also guards the SAVE paths, so an invalid stack can never be persisted.
- **Home "New work" button now works** — it opens the same title/brief modal as the CEO Planner (creates a real
  Goal + specs + issues) instead of silently opening a chat.
- **Pulse no longer shows Ada "working" right after onboarding.** Agents are seeded **idle**; Ada flips to
  "working" only when a plan/run actually starts.

### Added
- **Skills: filter by name + category.** A search box + category chips (stacks / design / engineering / process /
  languages / core / custom, derived from the native library) over the skill grid.
- **Skills: a "Consulted N×" badge** on each card — the truthful signal that an agent read that skill's file
  during a task (skills are injected into prompts + read on disk; they are not a separate RAG index).
- **Design module:** Grace's avatar now renders via the real Avatar (her image/initials, not a bare letter box),
  and the **LIVE** pill shows only while she's actually working (not for the whole session).

### Changed
- **Defaults:** the **Web Search** plugin and the editor's **Word wrap** are now ON by default for new workspaces.

---

## [0.2.25] — "VPS is native + Tailscale + systemd — Docker removed"

### Changed
- **VPS mode no longer uses Docker.** A VPS deploy is now a plain **native install + Tailscale + a systemd
  service** — simpler, fewer dependencies, fewer ways to break (no image rebuilds, no `down -v` foot-guns, no
  re-installing agent CLIs into a container, no tailscale sidecar / shared network namespace).
  - `curl … scripts/install.sh | bash -s -- --vps` now installs Node + the `constellai` CLI + Tailscale and
    registers a **systemd service** (`constella.service`) that runs `constella --vps` (starts on boot, restarts
    on crash). `npx constellai --vps` stays as the quick, unmanaged path.
  - Manage with `systemctl status|restart constella` + `journalctl -u constella -f`. Update with
    `bash scripts/vps-update.sh [version]` (npm + `systemctl restart` — data in `~/.constella` preserved,
    migrations run on boot). Wipe with `scripts/vps-clean.sh` (removes the service + CLI + `~/.constella`,
    **keeps Tailscale**).
  - Access stays private at `http://<tailscale-ip>:3000` (the host is the tailnet node).

### Removed
- The `Dockerfile`, `docker-compose.yml`, and `.dockerignore`, plus every Docker step from the VPS scripts and
  docs. The published npm package was always native; only the old `git clone + docker compose` path used Docker.

---

## [0.2.24] — "Design module — the live editable canvas"

### Added
- **Interactive canvas in the Design module**, transplanted 1:1 from the approved prototype. A clean,
  chrome-less live preview (Landing · Dashboard · Pricing · Login) with direct-manipulation tools:
  **Select · Edit · Markup · Comments · Inspect · Preview**. Hover draws an outline + tag on any editable
  element; clicking selects it and captures the full technical context (`CanvasSelection`: element type,
  component, domPath, bounding box, computed styles, section, page). Contextual actions (edit text inline,
  change color, duplicate, remove, comment, componentize, inspect, ask the frontend). Zoom 50/75/100,
  desktop/mobile viewport, dark/light theme, a styles rail (palette/typography/radius/spacing), a comments
  layer with pins, a versions timeline and an export modal.
- **Hover/selection stay inside the canvas** — every handler is bound to the canvas frame and guarded with
  a containment check, so outlines never bleed into the chat, rails or app shell.
- The left chat is the **real frontend agent (Grace)** (it streams to the `design` channel), the right rail
  has a **Context** tab (mission/stack/brief/mocks/design files), and **Approve** writes the official
  reference — wired into the foundation from 0.2.23. The canvas itself is **simulate-only** (no real backend).

---

## [0.2.23] — "Design module — prototype before the plan (foundation)"

### Added
- **New `Design` module (foundation).** A visual prototyping step BEFORE the first plan: in the Execution nav,
  right before the CEO Planner. You talk to the **frontend agent (Grace)**, who builds the prototype grounded in
  the brief, attached mocks, the chosen stack and the project context (RAG + design skills), writing files under
  `design-mock/`. **Approve** the design → it's written to `design-mock/APPROVED.md` (the official visual
  reference), the decision is recorded in the KB/RAG, and Ada is notified.
- **Two new per-workspace dirs, auto-created at workspace creation:** `design-skills/` (design-specific skills the
  frontend agent + CEO Planner consult) and `design-mock/` (everything the Design module produces). An attached
  onboarding mock now **auto-seeds** into `design-mock/import/` so the module opens non-empty.
- **CEO Planner ↔ Design wiring.** The planner page shows a **Design** button (→ `/design`) and an explainer
  inviting you to prototype before generating the plan. When `design-mock/APPROVED.md` exists, the CEO Planner
  reads it as **official context** and grounds every frontend spec/issue in the approved design (zero drift).
- **KB/RAG integration.** `design-mock/` and `design-skills/` are indexed, so the approved design + design
  decisions become retrievable project context for every agent.

> Foundation release. The interactive canvas (select · edit · markup · comments · inspect · preview, versions,
> export) lands in follow-up releases.

---

## [0.2.22] — "Finishing onboarding lands you on the CEO Planner"

### Fixed
- **Completing onboarding now reliably opens the CEO Planner.** The final step redirected from *inside* the
  heavy setup action (create org + workspace + agents, import the project, scaffold the control layer). If any
  non-essential step in there threw — a file-scaffold hiccup, a stale browser tab — the action aborted before
  the redirect and the operator was left stranded on the wizard at a frozen 92%, with no error. The action now
  **returns a result and the client navigates** to `/planner` (with a refresh so the new workspace renders);
  the file-scaffold step is best-effort so it can't strand a workspace that was already created; and any real
  failure is **shown on screen** instead of hanging silently.

---

## [0.2.21] — "Pick more than one per stack category"

### Changed
- **Project Stack now accepts MULTIPLE frameworks per category** — in onboarding and in Config. You can pick,
  say, **MUI _and_ Plain CSS** under Styling, or React + a second frontend, instead of being forced to one.
  Cards/chips now toggle on/off; the picked set shows next to each category. `None` stays exclusive (picking it
  clears the rest). Each pick maps to its own skills, so an agent on a multi-framework category gets all the
  matching skill files. Compatibility rules still apply (a wrong-language-family option is disabled with a
  reason), keyed off the category's primary language. The Config stack editor moved from single-select dropdowns
  to the same toggle chips. Stored as a comma-joined value per category — no database migration.

---

## [0.2.20] — "The CEO Planner clock tells the truth"

### Fixed
- **The CEO Planner timer no longer freezes at 05:00 or resets when you leave the page.** On a long first
  plan (the CEO reads the project file-by-file into `specs/SUPER-SPEC.md`, which can run up to ~10 min), the
  live panel hit a hardcoded **5-minute cap** and went quiet — the clock froze at 05:00 while the run was
  still going. And re-opening the page reset the clock to **00:00** because elapsed time was measured from
  the moment the panel re-mounted, not from when the run actually started. The clock is now anchored to the
  run's **real first-event timestamp** (so leaving and returning shows true elapsed), and the panel keeps
  streaming through the whole job. The run itself never restarted — it was one continuous job the whole time;
  only the on-screen clock was misleading.
- **First-plan analysis is now idempotent.** The "analyze the existing project" step was gated only by an
  `analyzed` flag written *after* it finished, so a re-click, a mid-run restart, or a stream-silent analyze
  could start it a second time and overwrite a half-written SUPER-SPEC. It now sets an **in-progress marker**
  (with a 12-minute self-heal TTL) before it runs, and a second kickoff bails while a job owns the workspace —
  no duplicated analysis, no clobbered spec.

---

## [0.2.19] — "Existing projects actually import"

### Fixed
- **Importing an existing project now really pulls THAT project** — not its dependencies, and never the
  Constella repo. The import skipped only a few JS dirs, so a Django `.venv` (or a Rust/JVM `target`, a .NET
  `bin/obj`) flooded the workspace and exhausted the file cap before the real source — the agents then
  "analyzed" pip/npm packages and produced generic work. The import now skips **every ecosystem's
  dependency/build/cache dirs** AND honors the project's own **`.gitignore`**. Verified on a real Django
  project: **359 source files imported, zero `.venv`/`site-packages`/`__pycache__`/`db.sqlite3`**. The CEO's
  analysis (`specs/SUPER-SPEC.md`) and every spec/issue are now grounded in the real project.

### Changed
- **"Local directory" → "Import from directory": pick a folder with the OS dialog** instead of typing a path.
  The browser filters + reads the project's text source with a **live % progress bar**, then imports it into
  the managed workspace. The GitHub import and the final hand-off show a progress bar too.

### Added
- **Project-source card in Config** — shows the active project (imported from `<folder>`/`<repo>` with the file
  count → managed workspace, or a new starter), whether it's been analyzed, and a **Re-analyze project** button.

---

## [0.2.18] — "Reload on restart, live update banner"

### Added
- **The browser auto-reloads when the server restarts.** A tiny public `/api/health` endpoint returns a
  per-process boot id; every open tab polls it (~5s) and hard-reloads (cache-busting, loop-guarded) the moment
  the id changes — so after **any** restart (manual `constella --start`, a crash-restart, or a self-update)
  you're always on the current build without touching the page.
- **The update banner now appears LIVE while the server runs.** The header polls every ~12s (and forces a fresh
  npm lookup every ~3 min) instead of only at startup, so a newly published version surfaces on its own — no
  restart needed. A small **Check for updates** button (in the header, plus **Check now** on the /update page)
  forces an immediate check if the auto-check is lagging.

### Changed
- **The update button is disabled while an agent is actively working** (status `working` + a fresh pulse within
  90s) — a server restart would kill its CLI mid-task. It re-enables automatically when the agent finishes or
  its pulse goes stale; `runUpdate` also refuses server-side, so a stale client can't slip an update through.

---

## [0.2.17] — "Update check"

### Maintenance
- No functional changes. A target version to test the in-app updater end-to-end now that the build pipeline is
  fixed: from a running 0.2.16, the header pill (or `constella update`) should install 0.2.17 — exact version,
  neutral cwd, then restart cleanly with no loop and no hydration crash. Built clean (`build:release`) and
  verified by `npm run smoke`.

---

## [0.2.16] — "Ship a consistent build"

### Fixed
- **The `/login` "Something broke at the root — invariant expected layout router to be mounted" crash is fixed
  at its real source: a bad `.next` artifact, not the page code.** 0.2.15 was published from an incremental
  `next build` over a **stale** `.next/server` + `.next/static` (the old `prebuild` cleared only `.next/cache`;
  under OneDrive the build drifted), producing an artifact whose server RSC/manifest didn't match the emitted
  client chunks. Everything returned 200 on the server, but the App Router lost its context **at hydration** in a
  real browser. Release builds now purge the **entire** `.next` first, so the shipped artifact is always
  internally consistent. (The same source built clean always works — verified by booting `/login` in headless
  Chrome.)

### Added
- **`npm run build:release`** — a clean, from-scratch production build (`clean:next` wipes all of `.next`, then
  `next build`). `validate` now uses it, so the published artifact always compiles from an empty `.next`. Plain
  `npm run build` stays incremental for fast local iteration.
- **`npm run smoke`** — a pre-publish gate that boots the built package and loads `/login` (signin **and**
  signup) in headless Chrome, failing if the page crashes at hydration. A server-side check (curl) can't catch a
  hydration-only break; a real browser can. Docs: [docs/en/RELEASE_SMOKE.md](docs/en/RELEASE_SMOKE.md) ·
  [pt](docs/pt/RELEASE_SMOKE.md).

### Changed
- The in-app updater installs the **exact resolved version** (`constellai@<version>`) instead of bare `@latest`,
  so a CDN-lagged npm `latest` tag can't install an older build than the one the pill is offering.
- Deployment-skew recovery now does a **cache-busting** reload (loop-guarded), so a transient post-update crash
  can't re-load a stale cached document that still points at the old build's chunks.

---

## [0.2.15] — "Recover the layout-router crash too"

### Fixed
- **The post-update `invariant expected layout router to be mounted` crash now self-heals.** 0.2.14 reloaded on
  the "Failed to find Server Action" skew *message*, but a `router.refresh()` (e.g. the runner heartbeat)
  landing on a mismatched RSC payload after the restart throws the App Router **layout-router invariant**
  instead — a different message the guard didn't match, so the page still died on the root error screen. The
  skew guard, the global error/rejection listener, and the root error boundary now also treat that invariant
  (and chunk-load failures) as recoverable and **hard-reload once** onto the fresh bundle (loop-guarded,
  ≤ 1 reload / 20s, so a genuinely persistent failure still falls through to the manual button).
- **Hardened `<body>` with `suppressHydrationWarning`** so antivirus / browser-extension attribute injection
  into the page can't trip the same invariant during hydration.

---

## [0.2.14] — "No skew after self-update"

### Fixed
- **The page no longer crashes with "Something broke at the root" right after an in-app update.** When the
  self-updater restarts the server on a new build, the still-open tab is running the *previous* client bundle;
  its next server-action or chunk request hits the new deployment and throws
  `Failed to find Server Action … from an older or newer deployment`, which surfaced as the root error
  *"invariant expected layout router to be mounted."* Constella now detects version skew — via a global
  listener, the root error boundary, and the update badge's own poll — and **hard-reloads once** onto the
  matching bundle, so a self-update finishes cleanly instead of dropping you on the error page. Loop-guarded
  (at most one auto-reload per 20s). This is the last rough edge of the in-app updater: install (0.2.12) →
  restart → auto-reload onto the new version, no manual Reload click.

---

## [0.2.13] — "End-to-end"

### Maintenance
- No functional changes. A target to watch the 0.2.12 EBUSY fix run end-to-end: from a running 0.2.12, the
  header pill (or `constella update`) should install 0.2.13 from a neutral cwd with the server up, then restart
  into it — no EBUSY, no loop, no console window.

---

## [0.2.12] — "Out of its own way"

### Fixed
- **The actual cause of the Windows update loop: `EBUSY`.** npm's global install is atomic — it **renames**
  `node_modules/constellai` aside before swapping in the new version, and Windows refuses to rename a directory
  tree that contains the npm process's own current working directory. The self-updater ran from the server's
  cwd, which **is** the install dir, so every `npm install -g` failed with
  `EBUSY: resource busy or locked, rename …\constellai` and the host relaunched the old version — the
  "restarting" loop. The updater now runs from the OS temp dir (it `chdir`s out, and is also spawned with a
  neutral cwd), so the rename succeeds with the server still up. This — **not** file locks from the running
  server — was the issue the whole time; a manual `npm i -g` always worked precisely because it ran from a
  neutral directory.

### Note
- The fix lives in the updater, so the jump **onto** 0.2.12 still runs the 0.2.11 updater and will fail. Update
  once by hand from a normal terminal (**not** `cd`'d into the install dir), server up:
  `npm install -g constellai@latest`, then restart Constella. From 0.2.12 onward the header pill and
  `constella update` land updates cleanly in place.

---

## [0.2.11] — "Live test"

### Maintenance
- No functional changes. A target to watch the 0.2.10 install-first updater run end-to-end: from a running
  0.2.10, the header pill (or `constella update`) should install 0.2.11 with the server up, then restart into
  it — no loop, no console window.

---

## [0.2.10] — "Install first, restart after"

### Fixed
- **In-app / `constella update` now actually lands the new version on Windows.** The self-updater stopped the
  server *before* running `npm install -g` — but on Windows that ordering made the install return an error,
  so the host relaunched the old version and looked stuck in a "restarting" loop. A live Constella does **not**
  lock the global package files (verified: `npm i -g` succeeds with the server up), so the updater now
  **installs first** with the server running, and only **then** restarts it to load the new code. Stopping the
  server survives solely as a fallback for a host where a process genuinely holds the files. This removes the
  loop seen updating 0.2.8 → 0.2.9.

### Note
- The fix ships in the updater, so the jump **onto** 0.2.10 still runs the 0.2.9 updater. Easiest path now:
  with the server running, `npm install -g constellai@latest` in any terminal (it succeeds in place), then
  restart Constella. From 0.2.10 on, the header pill and `constella update` land updates cleanly.

---

## [0.2.9] — "Proof"

### Maintenance
- No functional changes. A target version to watch the 0.2.8 script-based updater run end-to-end: from a
  running 0.2.8, `constella update` (or the header pill) should stop the server, install 0.2.9, and relaunch
  in place — no console window, no loop.

---

## [0.2.8] — "Update is a script now"

### Changed
- **The self-update is now a real, standalone script** (`bin/constella-update.mjs`) instead of an inline
  one-off blob. Both the in-app **Update now** pill and the `constella update` command run it. It finds the
  running server (from a `run.json` pidfile the launcher writes, or by the port it listens on), stops the
  whole process tree — the launcher **and** its web + worker children, which on Windows must all die before
  `npm install -g` can overwrite the in-use package files — installs the latest, then relaunches on the same
  mode. It's inspectable and **runnable by hand** to recover any stuck instance:
  `node <install>/bin/constella-update.mjs`, or simply `constella update` from any terminal (it stops a
  running instance, installs, and brings it back).

### Note
- The update mechanism ships **inside** the installed version, so the jump **onto** 0.2.8 still runs the
  previous updater. If a one-click update from 0.2.7 doesn't land on Windows, update once by hand: close
  Constella, run `npm install -g constellai@latest`, then `constella --start`. From 0.2.8 onward both
  `constella update` and the header pill stop-install-relaunch cleanly in place.

---

## [0.2.7] — "Tick"

### Maintenance
- No functional changes. A version bump published only as a target to test the in-app updater end-to-end
  from a fixed build: running **0.2.6**, the header pill should update 0.2.6 → 0.2.7 in place on Windows,
  with no "restarting" loop.

---

## [0.2.6] — "The updater lets go on Windows"

### Fixed
- **One-click update on Windows no longer loops without landing the new version.** The updater stopped the
  server by killing only the launcher process — but on Windows that is an uncatchable terminate that does
  **not** cascade to children, so the `next start` (web) and worker processes stayed alive holding the native
  SQLite addon (`better_sqlite3.node`) loaded. `npm install -g` then couldn't overwrite the in-use package
  files (EPERM), the install failed, and the host relaunched the **old** version — looking like an endless
  "restarting" loop. The updater now enumerates those child processes and kills them explicitly (the launcher
  **first**, so its supervisor can't auto-restart them), waits for the file locks to release, and retries the
  install before relaunching.

### Note
- The fix lives **in the updater**, so the jump **onto** 0.2.6 still runs the previous (0.2.5) updater and may
  fail on Windows. Update once by hand: stop Constella, run `npm install -g constellai@latest`, then
  `constella --start`. From 0.2.6 onward the header pill updates cleanly in place.

---

## [0.2.5] — "Steady"

### Maintenance
- No functional changes. Version bump and clean rebuild to publish a fresh, verified artifact to npm.
  (0.2.3 shipped a build that crashed on load; 0.2.4 corrected it; 0.2.5 republishes from a known-good tree.)

---

## [0.2.4] — "The pill notices on its own"

### Changed
- The header update pill now **re-checks npm every 30 minutes** (a forced lookup), so a newly published
  version appears on a long-running instance without a reload or restart.

---

## [0.2.3] — "Spin while it updates"

### Changed
- The header update pill now shows a **spinning icon** while it downloads + restarts, so the in-progress
  state is obvious. (Also the first release that exercises the 0.2.2 self-update path end-to-end — update
  from 0.2.2 and it installs silently and relaunches on its own.)

---

## [0.2.2] — "Updates that actually apply themselves"

### Fixed
- **The in-app update now installs silently and restarts on its own.** Clicking the update no longer pops a
  console window, and it no longer fails on Windows with the package files "in use": the updater now **stops
  the running server first** (so `npm install -g` can replace the in-use files), installs hidden
  (`windowsHide`), then **relaunches `constella` automatically** in the same mode — the page reconnects on
  its own. If the install fails it still relaunches the existing version, so a failed update never leaves the
  host down. The launcher exports `CONSTELLA_LAUNCHER_PID` so the updater stops exactly the right process.
- Fixed the rollback hint on the Update page (`constella` → `constellai`).

> Note: a self-update can only fix versions **from 0.2.2 onward** (the running version is the one doing the
> update). To get onto 0.2.2 from an older build on Windows, run `npm install -g constellai@latest` once.

---

## [0.2.1] — "Update from the header · clean VPS"

### Added
- **One-click updates from the header.** When a newer version is published, a persistent pill appears in the
  top bar — click it to download + install the update **in-app**, no `constella update` command needed, then
  restart to apply. Works for every global install: local `--start`, host `--vps`, and `--portable`. (Running
  from source, `npx`, or a Docker VPS — which can't self-update in place — open the Update page with the exact
  command instead.) Replaces the old dismissible bottom banner with an always-visible header notification.
- **`scripts/vps-clean.sh` — wipe a VPS to a clean slate, keeping Tailscale.** Removes the Constella Docker
  deployment, **all** Docker (engine + data), and the Constella runtime (`~/.constella`, the clone, the global
  CLI, the npx cache) while leaving Tailscale (and your tailnet session) untouched — to simulate a fresh
  install. Curl-able, with a confirmation prompt (`--yes` to skip). Also reachable via `install.sh --clean`.

### Changed
- VPS docs (EN+PT): the **host** update path (`constella update` / `npm i -g constellai@latest`) leads; the
  Docker `vps-update.sh` is the hardened-path option. Added the clean-reinstall section. Dropped the remaining
  `--auth` mentions from the installer + docs (`--auth` stays a silent alias of `--start`).

---

## [0.2.0] — "One login, everywhere"

### Changed
- **There are no more auth "modes".** `--start` / `--vps` / `--portable` are now just **install/launch
  options** (where the server runs — local 127.0.0.1, a VPS on 0.0.0.0 + Tailscale, or a USB drive) — never
  a choice about authentication. **Authentication is always required, in every environment.** `--auth` is
  retired (a deprecated alias of `--start`), and the run-mode picker + the "Run mode" sections in
  Config / Profile / Organizations are gone.
- **A bare `constella` no longer starts a server** — starting is explicit: pass `--start` (or `--vps` /
  `--portable`). Running `constella` with no flag prints usage.

### Added
- **A real signup + login flow.** First run with no account → a **signup** screen (name + email + password)
  that creates the single operator; afterwards → a **login** screen. Sessions persist, logout works, a wrong
  password shows "incorrect email or password", and an existing operator is never recreated. 2FA and passkeys
  are unchanged.

### Removed
- The passwordless `--start` auto-login (`/api/dev-login`, `ensureLocalOperator`) and the predictable
  `operator/operator123` default credential. A legacy `--start` install is migrated cleanly: the first launch
  of this version shows **signup** so the operator claims the account with a password they choose.

### Documentation
- The whole "four modes" idea is removed from the README and docs; `AUTH_MODE` is dropped and START / VPS /
  PORTABLE are reframed as install methods (EN + PT). Universal message: install → `constella --start` →
  sign up → log in → use.

---

## [0.1.10] — "One operator, two access modes"

### Fixed
- **`--start` and `--auth` now share the same operator — no duplicate accounts, correct errors.** The login
  form used to try sign-in and, on any failure, fall back to **sign-up**, so a wrong password or a normal
  re-login both surfaced "user already exists". The screen is now state-aware: the single operator (resolved
  the same way in both modes) either **sets** a password the first time (coming from `--start`, or a fresh
  first run — on the *existing* account, never a second one) or **signs in**. A wrong password now shows
  **"Incorrect email or password"**, never "already exists". There is no sign-up path in the UI.
- **Returning to `--start` always works.** `--start` auto-login uses a per-install **random** password
  persisted to the runtime `~/.constella/.env` (replacing the predictable `operator123` default) and never
  clobbers a password you set in `--auth`; a Profile password change stays in sync.

### Security
- Removed the predictable `operator123` default credential. Setting the operator password is refused once a
  password already exists (no unauthenticated reset/takeover). The operator password is stored in plaintext
  only on **local/loopback** installs (`--start`/`--auth`/`--portable`); a real `--vps`/container keeps the
  **hash only**.

### Documentation
- AUTH_MODE / START_MODE / SECURITY / FAQ (EN+PT) updated to the new single-operator flow.

---

## [0.1.9] — "Ship the build, not the cache"

### Fixed
- **The run-mode display fix from 0.1.8 now actually ships.** The 0.1.8 source was correct, but the
  published tarball carried a *stale* compiled `.next`: Next's incremental module cache (`.next/cache`)
  re-emitted the pre-fix Config / Profile / Organizations pages, so the app still showed the onboarding
  mode (`--start`) instead of the launch flag even after `constella --auth`. Rebuilt from a clean cache —
  the pages now read `getRunMode()` at runtime as intended.
- **Release builds can no longer ship a stale artifact.** A new `prebuild` step purges `.next/cache`
  before every `next build`, forcing a full recompile from source. (The incremental cache went stale under
  OneDrive/Windows filesystem mtime quirks; release artifacts must compile from source every time.)
- **The production build type-checks clean again.** Guarded the `trustedOrigins` handler against an
  undefined request — `next build` aborts on a type error, so this had been blocking every fresh production
  build (a prior complete build was the only thing still shipping).

---

## [0.1.8] — "Mode reflects the flag · one-command VPS"

### Fixed
- **The run mode shown in the app always matches the launch flag now.** Config / Profile / Organizations
  display `getRunMode()` (the live `CONSTELLA_RUN_MODE` the launcher set) instead of the persisted DB
  column, so `constella --auth` (or `--vps` / `--portable`) shows that mode immediately — no reinstall, no
  stale value, no dependence on the boot DB-sync. (The dashboard's pause button still reads the loop state.)

### Added
- **One-command VPS.** On a Linux/macOS host, `constella --vps` now auto-installs and joins Tailscale and
  serves on your tailnet — so `npx constellai --vps` (or `npm i -g constellai && constella --vps`) is a true
  single command: no git clone, no `vps-install.sh`. The Docker + Tailscale-sidecar path stays as the
  hardened "app reachable only on the tailnet, in a container" option.

### Documentation
- README + VPS_MODE (EN+PT): VPS leads with the one-command host path (Docker = hardened option); added the
  `E404` private-registry npx note (`npx --registry https://registry.npmjs.org constellai …`).

---

## [0.1.7] — "Quiet end-user console"

### Changed
- The supervised web + worker now start with `--no-deprecation`, so Node's internal deprecation notices
  (e.g. `DEP0190` from a Windows `shell: true` agent spawn, `DEP0176 fs.R_OK`) no longer clutter the
  runtime console. These were always harmless Node warnings, never Constella errors.

> **About the remaining `npm install` warnings** (not fixable from the package — they are warnings, not
> errors, and don't affect install or run): the `zod@^4` *optional* peer comes from better-auth's
> `better-call`; the `@esbuild-kit/*` and `prebuild-install` deprecations are internal to `drizzle-kit` /
> `better-sqlite3`; the `allow-scripts` notice is your npm's own policy. Hide them with
> `npm install -g constellai --loglevel=error`.

---

## [0.1.6] — "Run mode reflects the launch flag"

### Fixed
- **The run mode shown in the app now matches how you launched it.** Relaunching `constella --auth` (or
  `--vps` / `--portable`) already changed the real behavior — login enforcement and agent permissions are
  driven by the `CONSTELLA_RUN_MODE` flag — but the UI still displayed `--start`, because the *persisted*
  mode (`organization`/`workspace.runMode`) was written only at onboarding and never updated. Boot now
  syncs the persisted mode to the launch flag, so Config / Profile / the dashboard show the actual mode. A
  paused execution loop (`runMode === "off"`) is preserved across the sync.

---

## [0.1.5] — "Self-heal actually fires"

### Fixed
- The self-healing native-module check (0.1.4) never triggered: `better-sqlite3` loads its native addon
  **lazily in the `Database` constructor**, not at `require()`, so the launcher's require-only probe saw no
  error and the ABI mismatch still crashed the drizzle migrate subprocess. The probe now **opens an
  in-memory database** to force the binding load, so the mismatch is detected and the correct prebuilt
  binary is fetched before migrating — `constella` boots on a Node it wasn't installed under.

---

## [0.1.4] — "Self-healing native module"

### Fixed
- **Global install now boots on any Node version.** The launcher verifies the `better-sqlite3` native
  addon matches the running Node *before* the database migrate; if it doesn't — because the package was
  installed under a different Node, or because an `allow-scripts` / `ignore-scripts` npm policy blocked
  the prebuild fetch at install time — it fetches the correct prebuilt binary **itself, directly** (not
  via an npm lifecycle script, so a script policy can't block it), then continues. No manual `npm rebuild`
  is needed. This fixes the boot crash `NODE_MODULE_VERSION 127 … requires 147` → `Database schema
  migration failed on a fresh database`. On a truly incompatible environment it now prints a clear,
  actionable message instead of a raw dlopen stack.

### Notes
- The remaining `npm install` warnings are **transitive or environment-specific, not errors**: the
  `zod@^4` peer is an *optional* peer of better-auth's `better-call` (the app runs on zod 3); the
  `@esbuild-kit/*` and `prebuild-install` deprecations come from `drizzle-kit` / `better-sqlite3`
  internals; the `allow-scripts` notice is your own npm policy (a standard npm runs install scripts
  automatically). None block a clean install + run.

---

## [0.1.3] — "Executable launcher on Linux/macOS"

### Fixed
- **Global install on Linux/macOS no longer fails with `/usr/bin/constella: Permission denied`.** The
  package is published from Windows, where the filesystem doesn't track the Unix executable bit, so the
  launcher could land as `0644`. A `postinstall` (`scripts/postinstall.mjs`) now restores `0755` on
  `bin/constella.mjs` + `bin/worker.mjs` (POSIX only; no-op on Windows; best-effort, never blocks install).

---

## [0.1.2] — "Node 24 support"

### Fixed
- **Node 24 support.** Bumped `better-sqlite3` 11 → 12, which ships prebuilt binaries for Node 24. With
  v11 the prebuilds stopped at Node 22, so a global `npm install -g constellai` on Node 24 installed a
  Node-22 binary and crashed at boot with `NODE_MODULE_VERSION 127` vs `147`. This also satisfies
  better-auth's `better-sqlite3@^12` peer dependency (the install warning is gone).
- `scripts/install.sh` now auto-installs the native build toolchain (`build-essential`/`python3` on apt,
  `gcc-c++`/`make` on dnf, `base-devel` on pacman) before the global install, so a minimal host without
  a compiler no longer fails with `gyp ERR! not found: make`.

---

## [0.1.1] — "One-command VPS install"

### Added
- **One-command VPS installer** (`scripts/install.sh`) — `curl -fsSL …/scripts/install.sh | bash -s --
  --vps` installs Docker, clones the repo, joins Tailscale and deploys the whole stack in a single
  command. The same script also handles `--start` / `--auth` / `--portable` (install the CLI + run that
  mode) and `--update` / `--uninstall`.

### Changed
- **VPS is presented as a single automated command** across the docs (README, INSTALLATION, VPS_MODE,
  EN+PT). `constella --vps` is no longer shown as a casual run flag alongside the local modes — it remains
  only as the low-level flag the container runs internally.
- `vps-install.sh` reads the Tailscale auth key from `/dev/tty` (and accepts it via the `TS_AUTHKEY`
  environment variable), so the `curl | bash` one-liner works interactively or fully unattended.

---

## [0.1.0] — "First release"

The first end-to-end release of Constella: the full agent-company control plane, every previously
deferred capability wired into the live system, a complete bilingual documentation portal, and an
npm-native install across all run modes. The release / VPS / Portable paths are staged for validation.

### Added
- Wired the last previously-Planned capabilities into the runtime: the full `/slash` command set, KB
  consult, Inbox emit points (review gate, guard denial, budget cap, update-available, architecture
  decision), automatic PO grooming, the KB ingest gate, sprint close, DM intent parsing, and Team Room
  **synced-block indicators** on messages.
- **Telegram new-work flow** — a free-text request to the CEO over Telegram drafts a real plan
  (spec + issues), not just a chat reply; the bot's `/` command menu registers automatically.
- **One-command VPS updater** (`scripts/vps-update.sh`) and `npm run dev:all` (Next.js dev server +
  worker together, so Telegram polling and the cron tick work in development).
- **OPERATIONS** handbook (EN+PT) — start / stop / restart / status / logs / update / rollback /
  uninstall / diagnose, for both a local global install and a VPS/Docker deployment.

### Changed
- **npm-native install** everywhere (`npm install -g constella` + `constella --<mode>`; `npx` demoted to
  a try-once note). **INSTALLATION** rewritten as a complete, OS-by-OS guide (Ubuntu Server/Desktop,
  other Linux, macOS, Windows) covering prerequisites, Tailscale, network, permissions, security, native
  dependencies and a validation checklist.
- The **VPS Docker image installs the published npm package** (compiled `.next`) instead of building from
  source — the public tree ships no `src/`.
- Release / **VPS** / **Portable** paths marked **In testing** pending operator validation; the
  Portable-mode minimum lowered to 32 GB.

### Fixed
- **Remote / VPS login now works.** The auth client baked a build-time `localhost:3000` base URL, so a
  published build POSTed sign-in to the *user's own* machine (`ERR_CONNECTION_REFUSED`); it now uses the
  live page origin, and the server trusts the origin each request was served on (cross-site forgery still
  blocked).
- The **VPS update** is `bash scripts/vps-update.sh` (the old `docker compose pull` is a no-op for a
  locally-built image), with rollback by pinning a version.
- Duplicate `@` in the Team Room composer mention hint; the PO board hides cancelled/archived-goal issues.

### Documentation
- Full English + Portuguese documentation portal rebuilt from the live codebase, with a language toggle on
  every page, Mermaid architecture/agent/work-lifecycle diagrams, and self-contained animated SVG assets
  under `docs/assets/` (no third-party visual services referenced).

---

## [0.0.13] — "Remote control & Public API"

### Added
- **Telegram remote control** — inline-keyboard actions, alerts with buttons, live progress push, and goal
  control from the operator's phone (allowlisted to a single private chat).
- **Public REST API v1** secured by Personal Access Tokens (`/api/v1`), plus an **MCP server**
  (`scripts/mcp-server.mjs`) that exposes new-work creation and status to MCP clients.
- **Web research for agents** — native WebSearch/WebFetch, a server-side `researchDocs` tool with an
  official-docs allowlist, and a RAG cache; findings are captured back into the Knowledge Base.
- **Learning → skills** — Vannevar proposes new skills from captured learnings; the operator approves.
- Stack- and role-aware skill loading plus a planner playbook and design-system planning pass.
- Optional real PO grooming — Donald derives story points and MoSCoW from priority.

### Changed
- Kanban columns are capped with internal scroll and auto-archive Done cards 24 h after they ship.
- Downloaded GGUF models are machine-global (shared across workspaces) rather than per-workspace.
- Switching organisation now hard-reloads so nothing stale carries over.

### Fixed
- The planner self-recovers a stale CEO working state, so a retry needs no restart.
- PO sizing never emits 0 — story points and MoSCoW are always derived from priority.

### Documentation
- Full Portuguese versions of all docs with an EN/PT language toggle.

---

## [0.0.12] — "Cockpit & Deploy"

### Added
- **Dashboard** reborn as an operational cockpit — health, execution, problems, KB, locks and
  integrations with charts, donuts, sparklines and status cards (the old Modules grid is gone).
- **Prepare-Deploy** center — environment detection, clean-tree build, checklist, security scan and a
  preview pipeline.
- **Welcome central chat** — a full web chat on `/` built on a shared chat module, with Team Room / Direct
  / Telegram tabs, a context donut and a structured KB answer card.
- Agents auto-capture learnings into the KB via `[[REMEMBER …]]` tokens, in DM and Telegram alike.

### Changed
- RAG uses the local LLM for all generation when a local model is running, with nomic-embed task prefixes
  (`search_document` / `search_query`) on both index and query.
- Agent and user avatars are stored in the database (resized data URLs), not the workspace.
- Adaptive UI scale for large monitors (4K/2K/ultrawide).

### Fixed
- The GitHub Changes list is contained (internal scroll + collapse + count) — no more infinite list.
- `/clear` now wipes the on-screen conversation and cleans up legacy workspace avatars.

### Security
- Patched the esbuild dev-server CORS advisory (GHSA-67mh-4wv8-2f99) via a dependency override.

---

## [0.0.11] — "Knowledge Base & Welcome"

### Added
- **Knowledge agent (Vannevar)** owning RAG and chat indexing; the **Knowledge-Base engine** as a
  state-aware source of truth, with curation and a visual **Knowledge** module.
- **Synced Blocks** — a canonical knowledge-block engine with an agent-propose / operator-merge authoring
  loop and report transclusion.
- **Welcome home** as the operational landing page — hero, command bar, area cards, continue/decisions/PO/
  activity sections, central knowledge and empty states.
- Dual-language **i18n** framework with PT-BR for the core screens and a parity checker.
- **Team Room** gains send-to-KB per message, filter-by-agent, and a traceability chip
  (task · issue · goal · status).

### Changed
- PO and CTO (not only the CEO) can turn a request into work; opt-in **parallel agents** with per-file locks.
- Core `/slash` commands in the composer (KB, status, new-work, reindex, curate) with autocomplete.
- Code review uses the strongest available model and consults the security skills + KB.

### Fixed
- Capped agent execution at one per workspace per tick — closing the browser/worker race that caused OOM.
- Stopped false "needs approval" pings and same-agent same-file re-edit chaos.
- A Done issue no longer shows 0/4 todos or 0% — the Done column is authoritative.

---

## [0.0.10] — "Local models & distribution"

### Added
- Local **GGUF catalog** grown from 192 to 438 real lmstudio-community models, with hardware fit-checking.
- llama.cpp main (`:8082`) and RAG embed (`:8083`) servers auto-start on boot, offloaded to the GPU
  (`-ngl`); the CUDA runtime DLLs are auto-installed so the GPU works out of the box.
- RAG auto-indexes workspace memory on file change (debounced incremental re-embed).
- **DM session manager** — multiple sessions per direct message.
- **Compiled distribution** — end users receive a compiled package with no source in the public bundle.

### Changed
- Planner is non-blocking and refresh-safe, with a live CEO drafting surface (real-time stream, instant
  lock); the launcher supervises web + worker and auto-restarts on crash.
- Dependencies refreshed to latest stable within current majors.

### Fixed
- The chat server never loads an embedding model by mistake; download/install progress bars show
  bytes-downloaded so they never look frozen.
- Agents keep their chat history by using the model's real context window.

### Security
- Bumped drizzle-orm 0.36.4 → 0.45.2 (CVE-2026-39356, SQL injection, HIGH).
- Overrode postcss to a patched ≥ 8.5.10 (Next bundled a vulnerable 8.4.31; build-tooling XSS).
- P1 runtime hardening — shell-free spawn, worker loopback lock, non-root container, fail-closed boot.
- Added `SECURITY.md` (private vulnerability reporting + handling policy).

---

## [0.0.9] — "Models & agent CLIs"

### Added
- **Dynamic model catalog** (models.dev backbone) — no hardcoded model ids; a searchable provider/model
  dropdown that only shows connected providers, plus a rich per-provider status panel with CLI auth
  detection.
- Eight new headless agent CLIs — Aider, OpenCode, Copilot, Cursor, Cline, Kilo, OpenClaw and Hermes —
  joining the `claude` / `codex` adapters.
- **Update** module (version check + context-aware update commands) and an execution-mode reorganisation
  with CLI flags.
- **VPS mode** (Docker + Tailscale) and **Portable mode** (USB) with space/size helpers and USB auto-detect.

### Changed
- CLI providers re-detect and repopulate their cache on refresh.

### Security
- Guarded public-publish script (secret-scan gated) so source and secrets never leak into the public bundle.

---

## [0.0.8] — "Hardening & polish"

### Added
- **Security** screen and a destructive-command guard for agent shell/edit safety.
- Two-factor authentication (TOTP) and WebAuthn **passkeys** on top of email/password.
- **Update** check screen with pre-update backups.
- Disable-animations switch (GPU savings) in the topbar, login and settings.

### Changed
- Styled confirm modals replace native browser dialogs across the app (clear conversation, delete session).

### Security
- AES-256-GCM **vault** for provider keys; secret scrubbing before KB ingest, Telegram sends and logs.
- Filesystem **jail** for all agent file access — no path traversal; the workspace root is never deletable.
- A worker secret and loopback SSRF guard between the worker and the web server.

---

## [0.0.7] — "Integrations & config"

### Added
- **GitHub** integration — repository binding, git status and clean-source export.
- Operational screens: **Plugins**, **Routines/Cron**, **Notifications**, **Costs**, **Pulse**, **Docs**
  and **Code**.
- Account and workspace management — **Profile**, **Config**, **Org** and **Organizations** screens.

### Changed
- Notification preferences (email / Telegram / in-app / weekly) persist per user.

---

## [0.0.6] — "Knowledge & memory"

### Added
- First **Knowledge Base** with RAG memory and a **Knowledge** screen.
- Full-text **Search** screen across goals, specs, issues and knowledge.
- Synced-block seeds — mission, official stack and business rules as canonical references.

### Changed
- The KB deduplicates and types entries so repeated learnings collapse into one canonical record.

---

## [0.0.5] — "Collaboration"

### Added
- **Team Room** with `@mention` coordination and **DM** channels.
- Runner / collaboration engine with relay hand-offs and a 24/7 autonomous execution loop.
- **Test Dev** — boots the project and drives it with headless Playwright, returning a
  `PASS` / `FAIL` / `INCONCLUSIVE` verdict.
- **Tasks**, **Activity** and **Reports** screens.

### Changed
- Agents inherit explicit, hand-off context so a relay continues work instead of restarting it.

---

## [0.0.4] — "Work lifecycle"

### Added
- The full work lifecycle — Goal → Spec → Issue → Plan → Execution → Review → Test → Done.
- **Planner** (CEO drafting surface), the **PM** kanban board, the **Goals** screen and the **Inbox**.

### Changed
- Issue progress is derived from its todos, and the Done column is treated as authoritative.

---

## [0.0.3] — "The company"

### Added
- The 10-agent company — Ada, Linus, Donald, Margaret, Grace, Edsger, Werner, Barbara, Whitfield and
  Vannevar — with a reporting hierarchy, per-agent models and daily cost caps.
- **Real agent execution** via `claude` / `codex` CLI adapters, jailed to the workspace, with
  run-mode-aware permission levels.

### Changed
- Each agent runs under its own model and budget cap, so cost is bounded per role.

---

## [0.0.2] — "Onboarding"

### Added
- **Onboarding wizard** — creates the organisation, imports an existing project (GitHub clone / local
  directory / mock) or scaffolds a runnable starter, writes the `.claude/` control layer, seeds the
  agents, skills library and native plugins, and runs the first plan into `specs/SUPER-SPEC.md`.
- **Project Stacks** inference from the imported project.

### Changed
- A fresh project scaffolds a bootable starter so the workspace runs from the very first tick.

---

## [0.0.1] — "Genesis"

### Added
- Next.js control-plane scaffold with a per-organisation runtime root under `~/.constella` and workspace
  isolation (`~/.constella/organizations/<orgId>/workspace`).
- SQLite persistence (drizzle-orm + better-sqlite3) and secrets in `<HOME>/.env`.
- `better-auth` email/password sign-in and the **Login** screen.
- Supervised web + worker processes — a Next.js control plane plus a background worker (`bin/worker.mjs`)
  running the cron tick and a file watcher; the supervisor restarts dead children.

---

[Unreleased]: https://github.com/gabriel7silva/constella/compare/v0.1.8...HEAD
[0.1.8]: https://github.com/gabriel7silva/constella/compare/v0.1.7...v0.1.8
[0.1.7]: https://github.com/gabriel7silva/constella/compare/v0.1.6...v0.1.7
[0.1.6]: https://github.com/gabriel7silva/constella/compare/v0.1.5...v0.1.6
[0.1.5]: https://github.com/gabriel7silva/constella/compare/v0.1.4...v0.1.5
[0.1.4]: https://github.com/gabriel7silva/constella/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/gabriel7silva/constella/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/gabriel7silva/constella/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/gabriel7silva/constella/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/gabriel7silva/constella/releases/tag/v0.1.0
[0.0.13]: https://github.com/gabriel7silva/constella/compare/v0.0.12...v0.0.13
[0.0.12]: https://github.com/gabriel7silva/constella/compare/v0.0.11...v0.0.12
[0.0.11]: https://github.com/gabriel7silva/constella/compare/v0.0.10...v0.0.11
[0.0.10]: https://github.com/gabriel7silva/constella/compare/v0.0.9...v0.0.10
[0.0.9]: https://github.com/gabriel7silva/constella/compare/v0.0.8...v0.0.9
[0.0.8]: https://github.com/gabriel7silva/constella/compare/v0.0.7...v0.0.8
[0.0.7]: https://github.com/gabriel7silva/constella/compare/v0.0.6...v0.0.7
[0.0.6]: https://github.com/gabriel7silva/constella/compare/v0.0.5...v0.0.6
[0.0.5]: https://github.com/gabriel7silva/constella/compare/v0.0.4...v0.0.5
[0.0.4]: https://github.com/gabriel7silva/constella/compare/v0.0.3...v0.0.4
[0.0.3]: https://github.com/gabriel7silva/constella/compare/v0.0.2...v0.0.3
[0.0.2]: https://github.com/gabriel7silva/constella/compare/v0.0.1...v0.0.2
[0.0.1]: https://github.com/gabriel7silva/constella/releases/tag/v0.0.1
