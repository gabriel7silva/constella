# 🚀 Updating Constella

[🇧🇷 Português](./pt/UPDATE.md) · [Deep-dive (how it works)](./en/UPDATE.md) · [✦ Constella](../README.md)

![](./assets/divider-orbit.svg)

**Current stable release: `v0.7.0`** — a **Stop button** in every chat (and a global **Stop All** on Pulse),
**live UI updates** when a plan finishes, an **honest chat→work flow** (Ada actually creates the specs she
promises, and a backend request no longer gets a fake UI mockup), plus a Design-gate **Skip and continue** +
default toggle. See what changed in the [Changelog](../CHANGELOG.md) (the Update module also shows it inline
as “What's new”).

> This is the page the **Update** module's “docs” button opens. It tells you, in plain terms, how to move Constella
> to a newer version — from the app or the terminal — and how to roll back if you ever need to. Your data
> (`~/.constella`: database, secrets, login, workspaces) is **always preserved**, and a backup of your `.env` + database
> is taken **before** any update runs.

Constella checks npm for a newer release, shows you the changelog, and applies the update **the way that fits how it's
running** — a global install, dev source, `npx`, a native VPS, or a portable USB drive. It never fabricates a “success”
it didn't earn: the updater writes the real result and the screen reflects it truthfully.

---

## 🆕 What's new — release history

Latest first. The in-app **Update** module shows the changelog inline as “What's new”; this is the same history, kept
here so the “docs” button always shows what each release added. Full detail: [Changelog](../CHANGELOG.md).

### v0.7.0 — Stop, live updates, and honest planning
- **Stop in every chat.** While an agent replies, Send becomes **Stop** in the same spot — one click kills
  the run and frees the agent; a stopped run reads "⏹ Stopped by operator". A global **Stop All** on Pulse
  interrupts every agent at once.
- **Live UI refresh.** Planner / Goals / PM update on their own the moment a background plan finishes — no
  more leaving and re-entering the page.
- **Chatting with Ada actually creates the work.** She no longer goes silent after promising specs/issues —
  the originating chat always gets an honest outcome (plan ready / sent to Grace / a clear failure), and a
  DM-triggered plan reports back in that DM.
- **Backend requests stay out of Design.** "Configure the dev server" and similar infra/`.env`/DB requests
  route straight to a plan instead of a fake UI mockup; Grace also declines non-visual work.
- **Design gate: Skip and continue + a default.** A skip button on the Design banner itself, plus a
  Config → Design Gate toggle to always skip.
- **Fixes.** Stop now genuinely kills the process on Windows (tree-kill, no console flash, shared run
  registry); dashboard "updated Ns ago" hydration mismatch resolved.

### v0.6.1 — Fire agent, real model IDs, reasoning Effort
- **Fire agent.** Remove a hired agent from the Org Chart card or Agent Studio (the native roster can't be
  fired), with a styled in-app confirmation. Direct reports are re-pointed to its manager; history rows keep
  their data, un-attributed.
- **Effort control.** A per-agent Low/Medium/High/Max reasoning-effort setting next to Temperature; applied
  on CLIs with a native control (e.g. Codex), a no-op elsewhere.
- **Real model IDs.** The model picker fetches the live list straight from the CLI (Aider, OpenCode) instead
  of a curated guess, falling back to curated when the provider isn't connected. Fixed a stale "Sonnet 4.6"
  label (agents were already on Sonnet 5) and added the missing `fable` alias.
- **OpenClaw / Hermes / Gemini CLI hidden everywhere** — a shared filter now covers all four provider
  pickers (Hire, Agent Studio, Models, onboarding), fixing gaps where Hermes/Gemini still slipped through.
- Jumps straight to `0.6.1` — an earlier `0.6.0` npm publish was unpublished before this content was
  finalized, and npm permanently blocks reusing a version string once published.

### v0.5.1 — trim the Hire roster + org-chart fix
- **Dropped OpenClaw + Hermes from the Hire Agent picker.** Both runtimes proved impractical to drive (OpenClaw's
  Gateway device-auth deadlocks a local CLI; Hermes' login flow), so they're no longer offered. The other CLI
  providers (Claude Code, Codex, Gemini, Aider, OpenCode, Copilot, Cursor, Cline, Kilo) are unchanged.
- **Fix:** dragging a just-hired agent's org-chart card no longer crashes (`reading 'x'`).
- Supersedes **0.5.0** — a short-lived OpenClaw Gateway build that was pulled (the Gateway's device-auth makes a
  local CLI client impractical). The dormant `connectionMode` / `gatewayHandle` columns stay (default `cli`).

### v0.4.0 — Hire Agent
- **Hire agents at runtime.** "+ Hire agent" on the Org Chart adds a new agent (e.g. OpenClaw/Hermes)
  reporting to the CEO, with a **blocking pre-flight** (the CLI must be installed + signed in). Provider/model
  come from the allowlist; persona, tier and daily cap are set in the form.
- **Fix:** roster agents now run their real provider/model (onboarding + backfill used to fall to the
  `cli_claude_code`/`sonnet` default for everyone but the CEO).
- **Fix:** the Profile "Save changes" button now confirms on every tab.

### v0.3.12 — leaner npm tarball
- Stops shipping vendored test/coverage artifacts from inside `skills/` (`.coverage`, `scripts/tests/`,
  `__pycache__`, `*.pyc`) via `files`-array negation. Fresh version after 0.3.11 was unpublished (npm burns
  an unpublished version string). No app/runtime change.

### v0.3.11 — onboarding polish
- **No double-handoff.** "Hand off to Ada" stays locked through the redirect to the Planner (the button used to
  re-enable mid-navigation and allow a second setup).
- **Quiet sync.** The worker caps concurrent file-sync POSTs + retries transient failures, and watches only
  after the server is up — no more `sync failed: fetch failed` floods during a workspace seed.
- **Provider logos.** Real brand icons for Cursor / Cline / GitHub Copilot / OpenCode / Kilo Code / Hermes /
  Windsurf in the detected-provider grid.

### v0.3.10 — hardening (schema guard + passkey diagnostics)
- **Launcher fails loud on an incomplete schema** — after migrate it checks the `user` table exists; if not, it
  aborts with a clear message (instead of a tableless app that 500s `no such table: user`). This is the
  silent-partial-migration that hits an unsupported Node major — **use Node 20/22 LTS**.
- **Passkey verify logs the real reason** (origin/rpID/challenge/credential) instead of a silent generic error.

### v0.3.9 — passkey login fix
- **Passkey sign-in works again.** The auth proxy was redirecting the unauthenticated
  `/api/passkey/authenticate/*` calls to the HTML `/login` page, so the browser's `response.json()` failed with
  `Unexpected token '<'`. The proxy now lets the passkey *authenticate* endpoints through (register stays
  protected). No data change.

### v0.3.8 — dependency baseline (refresh + majors)
- Within-major bumps after a clean `pnpm audit` (no known vulnerabilities): `better-auth` → 1.6.22,
  `@simplewebauthn/server` → 13.3.2, `@playwright/test` → 1.61.1 (+ dev tooling).
- Adopted the held-back majors: **zod 4** (coordinated with better-auth, which now peers zod 4 — Constella
  never imports zod directly, so no schema migration), **TypeScript 6** + **`@types/node` 26** (dev). All
  gates green (typecheck, build, login smoke). Runtime unchanged — still Node 20/22/24 (`engines >=20`).

### v0.3.7 — open source
- **Constella is now fully open-source** — the public GitHub repo carries the complete source (`src/` and all),
  not a source-less compiled mirror. A pre-publication scrub neutralised third-party brand mentions and removed
  personal paths / PII, and a root **`THIRD_PARTY_LICENSES.md`** indexes every bundled skill's license.
- Docs re-framed for the open-source flow + corrected stale "VPS = Docker" claims to the real native model
  (npm + systemd + Tailscale).

### v0.3.6 — hardening pass
- A whole-project code review (**security · correctness · robustness**): closed an operator-account takeover
  (restored-DB path), hardened secret scanning (fine-grained PATs, `.cjs/.cts`, redirect re-validation), fixed
  a RAG reindex that wiped curated KB chunks, a runner queue deadlock + a stuck "working" agent, a dropped
  Telegram message, dev-server process-group + double-spawn, the year-57000 dates — among many others.
- **VPS one-click update hardened** — absolute npm/systemctl paths, sudoers scoped to `constellai@latest`, a
  self-healing drop-in.
- Docs: an honest **compatibility status** + a **roadmap** skeleton.

### v0.3.5 — VPS update polish
- Dropped the inaccurate **"(Docker)"** label — VPS mode is **native** (systemd + Tailscale, no Docker).
- Fixed the passwordless self-update drop-in being **skipped at setup** (`visudo` wasn't on the non-root PATH), so
  one-click VPS updates actually get enabled now.

### v0.3.4 — a VPS updates itself
- **One-click updates on a VPS.** **Update now** installs the new release and restarts the service **by itself** —
  it updates the global package, lets **systemd** cycle the unit onto the new code, and the page **reloads itself**
  once the server is back (it waits out the restart instead of dropping a dead connection). Before, a VPS could
  only print the manual command.
- **Scoped passwordless self-update.** The installer drops a tightly-scoped `/etc/sudoers.d/constella` that lets
  the service user run **exactly two** commands without a password — `npm install -g constellai[@version]` and
  `systemctl restart constella` — validated with `visudo` first. _Bootstrap:_ hosts installed before 0.3.4 run the
  VPS one-liner **once** to gain the drop-in; every update after that is one-click.

### v0.3.3 — avatar photos show everywhere
- Operator/agent avatar photos now appear in the **home chat** and the **@-mention list** (they already showed in
  the chat dock + sidebar).

### v0.3.2 — install & onboarding fixes
- `npx constellai` works on **Windows** (the package ships a matching `constellai` bin).
- Onboarding no longer freezes at “Setting up… 100%” — it hard-navigates to the Planner (all modes).
- **VPS:** the systemd service gets a real `PATH`, so it detects + runs your CLIs (Claude Code / Codex / …).
- Avatar photos show in the home chat + @-mention list (the operator/agent image is threaded everywhere now).

### v0.3.0 — first clean public release
- **Design module** — Grace prototypes the UI on a faithful, **text-only** canvas; the approved design **becomes the
  real served frontend** (engineers extend it, never rebuild). **Live app + Inspect**: render the real running dev
  server (any stack) and click an element to ask Grace to change it. Visual-fidelity gate + Telegram control.
- **Context donut** — per-conversation, per-agent token + `$` cost in the chat header.
- **Resilience** — agent runs retry transient failures (429 / quota / 5xx); the Design→execution handoff is idempotent + resumable.

---

## ✦ Update from the app (recommended)

Open the **Update** module (the rocket icon, or `/update`):

1. **Installed → Latest** shows your current version and the newest one on npm, with a `major` / `minor` / `patch` pill.
2. The line under it tells you **how this copy runs** (global install, dev, VPS, portable…), which decides what the
   update button can do.
3. If an update exists, read **“What's new in v…”** — the changelog for that release.
4. Click **Update now**:
   - **Global npm install** → Constella updates **in place** in the background. Watch the live status
     (`running → installed`), then **restart** Constella to load the new version.
   - **Every other environment** (dev / npx / VPS / portable) → Constella shows you the **exact command** to run in
     your terminal (it can't safely update those from inside the running web server).
5. **Check now** re-queries npm immediately (the check is cached for 6 hours otherwise).
6. The **“Backup saved”** line shows where your `.env` + database were copied before the update.

> Updates pause while an agent is actively working — the button waits so a build is never interrupted mid-flight.

---

## ✦ Update from the terminal

```bash
# Just check — prints "Constella x.y.z · latest a.b.c"
constella update --check

# Check + apply (global install path)
constella update
```

- `--check` prints the versions and exits.
- If npm is unreachable, or you're already current, it says so and exits cleanly.
- If it detects a **source checkout** (a `.git` + `src/`), it tells you to `git pull && pnpm install && pnpm build`.
- Otherwise it runs `npm install -g constellai@latest`, then asks you to restart.

---

## 🌌 How it updates, per environment

The first match wins. A **global npm install** and a **VPS** both update themselves from the button; dev / npx /
portable hand you the precise command, because running it from the web server would be environment-specific.

| Environment | Auto-updates? | What to run |
| --- | --- | --- |
| **Global npm install** | ✅ in the background | `npm install -g constellai@latest` (Constella runs this for you) → then restart |
| **VPS (native service)** | ✅ from the button¹ | nothing — it installs + `systemctl restart`s + reloads itself |
| **Dev (from source)** | ❌ | `git pull && pnpm install && pnpm build` |
| **npx** | ❌ | `npx constellai@latest` |
| **Portable (USB)** | ❌ | `npm install -g constellai@latest` (after a free-space + backup check) |

> ¹ One-click VPS updates need the passwordless self-update drop-in (`/etc/sudoers.d/constella`) that the installer
> writes from **v0.3.4** on. A host installed earlier runs the VPS one-liner **once** (below) to gain it — after
> that, **Update now** does everything on its own.

---

## 🛰️ VPS update

**From v0.3.4 the button does it for you.** On a VPS, **Update now** installs the new release, lets systemd restart
the unit, and reloads the page once the server is back — no shell needed. It works because the installer grants the
service user passwordless rights to **exactly** `npm install -g constellai` and `systemctl restart constella`
(`/etc/sudoers.d/constella`, validated with `visudo`). A host first installed **before** v0.3.4 doesn't have that
drop-in yet, so run the one-liner below **once** — that update writes the drop-in, and every update after is
one-click from the button.

To update from a shell instead (or to do that first bootstrap run), use **one** of these on the VPS host. Data in
`~/.constella` is preserved, and the database migrations run automatically on the next boot.

```bash
# Native install — pull the updater straight from GitHub (no repo checkout needed):
curl -fsSL https://raw.githubusercontent.com/gabriel7silva/constella/main/scripts/vps-update.sh | bash

# Pin a specific version:
curl -fsSL https://raw.githubusercontent.com/gabriel7silva/constella/main/scripts/vps-update.sh | bash -s -- 0.2.30

# From a repo checkout:
bash scripts/vps-update.sh            # → latest on npm
bash scripts/vps-update.sh 0.2.30     # → a specific version

# Fully manual:
sudo npm install -g constellai@latest && sudo systemctl restart constella
```

> **No manual stop needed.** `npm install -g` swaps the package on disk without touching the live process;
> `systemctl restart constella` cycles in the new version in a ~2–3s blip. Roll back any time by pinning the old
> version. See **[VPS_MODE](./en/VPS_MODE.md)** for the full service setup.

---

## 💾 Portable (USB drive)

A portable copy checks free space and backs up the drive before updating, then runs the standard global install
(`npm install -g constellai@latest`). Restart to load the new version. See **[PORTABLE_MODE](./en/PORTABLE_MODE.md)**.

---

## 🛟 Backup & rollback

- **Backup is automatic and first.** Before any update, Constella copies your `.env` and SQLite database (and the
  WAL/SHM files) to `~/.constella/backups/<timestamp>/`. A copy failure never blocks the update — it's skipped.
- **Roll back** by reinstalling the previous version:
  ```bash
  # Global / portable:
  npm install -g constellai@<old-version>
  # VPS:
  curl -fsSL https://raw.githubusercontent.com/gabriel7silva/constella/main/scripts/vps-update.sh | bash -s -- <old-version>
  ```
  Then restart. Your `~/.constella` data is untouched, so you're back exactly where you were. If needed, restore the
  `.env` / database from the `backups/<timestamp>/` folder taken before the update.

---

## 🌠 Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| “registry unavailable”, no button | Offline / npm down / firewall | Retry later; check you can reach `registry.npmjs.org`. |
| Latest looks stale | The check is cached 6h | Hit **Check now** (or `constella update --check`). |
| Global update stuck on “running” | npm still installing or blocked | Wait; if it never resolves, run `npm install -g constellai@latest` by hand. |
| Update failed (poll: error) | npm exited non-zero (often permissions) | Re-run with the right permissions; roll back with `npm i -g constellai@<current>`. |
| Still the old version after restart | The old process is still running | Fully stop and relaunch Constella so it re-reads its version. |
| Dev copy won't auto-update | Intentional | Run `git pull && pnpm install && pnpm build`. |

---

## 🔒 Safety

- **Auth-gated** — the update action requires a logged-in workspace before doing anything.
- **Backup first, always** — `.env` + the database are copied before any update path.
- **Fail-closed checks** — the npm/changelog look-ups time out and fail silent; a dead or hostile network can't hang or
  crash the update screen, it just reports “no update”.
- **Honest results** — the background updater records the real install exit code; the screen shows `done` / `error`
  truthfully and never claims a success it didn't get.

---

## ✦ Related

[Português](./pt/UPDATE.md) · [Update — deep-dive](./en/UPDATE.md) · [VPS mode](./en/VPS_MODE.md) ·
[Portable mode](./en/PORTABLE_MODE.md) · [Installation](./en/INSTALLATION.md) · [Operations](./en/OPERATIONS.md) ·
[Changelog](../CHANGELOG.md) · [Report an issue](https://github.com/gabriel7silva/constella/issues)
