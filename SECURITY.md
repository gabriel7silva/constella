# Security policy

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Report a vulnerability privately through one of:

- **GitHub Security Advisories** — go to the **Security** tab → **Report a vulnerability** (preferred).
- **Email** — `baratroia@outlook.com` with `[SECURITY]` in the subject.

Please include: a description, steps to reproduce, affected version, and the impact. We aim to
acknowledge within a few days and will coordinate a fix and disclosure with you.

## Supported versions

Security fixes target the **latest** released version of the `constellai` package. Please upgrade
(`constella update` / `npx constellai@latest`) before reporting.

## Scope

In scope: the Constella application and its distributed package. Out of scope: the third-party agent
CLIs (`claude`, `codex`, …), model providers, and your own workspace content.

## How this project handles security

- **No source or secrets in the public distribution.** The public package ships only the compiled
  build, the launcher, docs and DB migrations — never `src/`, `.env`, databases, or logs. Every
  publish is **secret-scanned** and refused on any finding (`scripts/publish-public.mjs`).
- **Local-first by default.** The default run mode binds to `127.0.0.1` only. Network modes
  (auth/vps/portable) require a real, per-install `BETTER_AUTH_SECRET`.
- **Encrypted secrets vault.** Provider API keys, the GitHub token and the Telegram token are stored
  encrypted under the runtime root and are redacted from logs and agent output.
- **Push protection.** Workspace → GitHub pushes are secret-scanned and blocked on any finding.

## Hardening your own install

- Keep your agent CLIs and Node runtime up to date.
- Treat `~/.constella/` (runtime root, DB, `.env`, vault) as sensitive — never commit or share it.
- Use a network mode (auth/vps/portable) only behind a private network (e.g. Tailscale); never expose
  the port publicly.
