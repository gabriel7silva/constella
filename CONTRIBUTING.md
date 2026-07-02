# Contributing to Constella

Thanks for helping build Constella. This is the open-source repo (`gabriel7silva/constella`) — issues
and pull requests are welcome here against `main`.

## Ground rules

- **Everything is real.** No mock data, no fabricated success, no placeholder endpoints. If something
  isn't implemented, say so — don't fake it.
- **Build + typecheck are gates.** `pnpm exec tsc --noEmit` and `pnpm build` must pass before a PR.
- **No secrets, ever.** Never commit `.env`, tokens, keys, dumps, logs, or anything under
  `.constella/`. The pre-publish scan (`scanForSecrets`) blocks any finding.
- **Small, reviewable diffs.** One concern per PR. Match the surrounding code's style and comment
  density.
- **Additive, nullable DB columns only** (Drizzle `db:push`); never hand-write destructive SQL.

## Getting started

```bash
git clone https://github.com/gabriel7silva/constella.git
cd constella
pnpm install
cp .env.example .env      # fill in only what you need locally
pnpm db:push
pnpm dev                  # http://localhost:3000  (start mode → auto-login)
```

See [docs/INSTALLATION.md](docs/INSTALLATION.md) and [docs/CONFIGURATION.md](docs/CONFIGURATION.md).

## Project layout

- `src/app` — Next.js routes (auth, app shell, modules)
- `src/server` — server actions + logic (agents, runner, github, models, update, …)
- `src/lib` — utilities (auth, vault, workspace, run-mode, version, …)
- `src/data` — catalogs (providers, stacks, models, icons, README template)
- `src/components` — UI (shell, ui, modules)
- `bin/constella.mjs` — the CLI entrypoint
- `skills/` — the native skills knowledge base
- `docs/` — user/operator documentation

## Commit + PR

- Conventional-ish messages (`feat:`, `fix:`, `docs:`, `chore:`).
- Update `CHANGELOG.md` under `[Unreleased]` for user-visible changes.
- Describe how you verified the change (commands run, screens checked).
