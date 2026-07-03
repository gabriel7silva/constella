# Constella skills — agent knowledge base

A curated, research-backed reference library for AI agents working on Constella. **182 skills**, each grounded in official documentation, repositories, and standards — every URL verified live (`verified: 2026-06-16`).

## What this is — and is not
- **Is:** knowledge agents *consult* before/while building — official docs, install commands, core concepts, best practices, pitfalls, and an executable process playbook.
- **Is not:** the runtime `.claude/skills/` directory (those are per-org executable procedures indexed by `src/server/sync.ts`). This library lives at the repo root, **outside** the org workspace jail, and is **not** auto-indexed into the app DB/UI.

## How an agent uses it
1. Identify the task **domain** (e.g. backend, security, CSS) and the project's declared **stack** (from `.claude/CLAUDE.md`).
2. Open the matching `SKILL.md`. Stack lookup is deterministic — `orm: Drizzle` → [`stacks/orm/drizzle/SKILL.md`](stacks/orm/drizzle/SKILL.md). Full map below and in [COVERAGE.md](COVERAGE.md).
3. Read `Further reading` / `reference.md` only if you need depth (progressive disclosure).
4. Trust the **Official sources**. If `verified:` is stale, re-check before relying on version-specific details.
5. For the `process/` skills, follow the numbered **Procedure** — they are executable playbooks, not background reading.

## Two formats (hybrid)
- **Knowledge `SKILL.md`** — YAML frontmatter (`name`, `description`, `domain`, `category`, `tags`, `official_sources`, `verified`) + sections Overview / Official sources / Install / Core concepts / Best practices / Common pitfalls / Examples / Further reading / Related. Used by `meta/`, `engineering/`, `design/`, `languages/`, `stacks/`, `references/`.
- **Runtime `# Skill —` procedure** — `**Trigger:**` + When to use / Procedure / Quality & validation / Failure handling. Matches the existing `.claude/skills/` convention so a process skill could be promoted into a workspace later. Used by `process/`.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full templates and the non-negotiable trust rules (official sources only, never invent, cite & summarize never copy).

## Taxonomy
| Group | Count | What's inside |
|---|---|---|
| [`process/`](process/) | 15 | Build it right **before** coding: discovery, framing, idea→product, mocks & flows, architecture-first, requirements→specs, specs→issues, sprints, prioritization (MoSCoW/RICE), app planning, UX/nav validation, security-by-design, testing-before-done, ADRs, code/perf/security review |
| [`engineering/`](engineering/) | 32 | `security/` (OWASP Top 10, ASVS, appsec, auth/sessions, secrets, supply chain) · `architecture/` (system design, patterns, API design, data modeling, caching, queues, scalability) · `performance/` · `testing/` · `frontend/` · `backend/` · `practices/` (clean code, review, refactoring, git, optimization) |
| [`design/`](design/) | 9 | UI/UX principles, design systems, CSS techniques, graphic design, animation/motion, microinteractions, gradients, color & typography, responsive layout |
| [`languages/`](languages/) | 15 | Per-language techniques for every catalog language (TypeScript … Dart) |
| [`stacks/`](stacks/) | 98 | One skill per catalog option across `runtime/ frontend/ meta/ backend/ database/ orm/ styling/ container/ infra/ queue/ auth/` |
| [`references/`](references/) | 10 | External product/AI-UI references distilled: WebLLM, AI SDK Elements, attachments UI, AI tool UI, SaaS landing patterns, Codrops animation, component galleries, shadcn/Tailwind theming, React component libraries, gradients |
| [`meta/`](meta/) | 3 | How to author agent skills (frontmatter spec, progressive disclosure) |

Machine-readable manifest: [INDEX.json](INDEX.json) (one object per skill: name, path, domain, category, description, tags, official_sources, verified). Coverage report + full stack table: [COVERAGE.md](COVERAGE.md).

## Stack lookup (catalog option → skill)
Every selectable catalog option in [`src/data/stack-catalog.ts`](../src/data/stack-catalog.ts) resolves to a skill (**113/113**, "None" excluded). `Redis` is canonical at [`stacks/database/redis`](stacks/database/redis/SKILL.md) with a queue-focused cross-link at [`stacks/queue/redis`](stacks/queue/redis/SKILL.md).

- **language** → `languages/<slug>` (typescript, javascript, python, go, rust, java, kotlin, csharp, ruby, php, elixir, swift, cpp, scala, dart)
- **runtime** → `stacks/runtime/<slug>` (node, bun, deno, python3, pypy, jvm, dotnet, beam)
- **frontend** → `stacks/frontend/<slug>` (react, vue, svelte, angular, solidjs, preact, qwik, lit, htmx, alpine)
- **meta** → `stacks/meta/<slug>` (nextjs, nuxt, remix, sveltekit, astro, gatsby, vite)
- **backend** → `stacks/backend/<slug>` (nestjs, fastify, express, hono, koa, django, flask, fastapi, spring-boot, laravel, rails, gin, fiber, actix, phoenix, aspnet-core, adonisjs)
- **database** → `stacks/database/<slug>` (postgresql, mysql, mariadb, sqlite, mongodb, redis, cockroachdb, cassandra, dynamodb, supabase, planetscale, neon)
- **orm** → `stacks/orm/<slug>` (prisma, drizzle, typeorm, sequelize, sqlalchemy, django-orm, mongoose, knex, diesel, gorm)
- **styling** → `stacks/styling/<slug>` (tailwind, css-modules, styled-components, sass, vanilla-extract, unocss, shadcn-ui, mui, chakra-ui)
- **container** → `stacks/container/<slug>` (docker, podman, containerd)
- **infra** → `stacks/infra/<slug>` (tailscale, cloudflare, vercel, netlify, fly-io, railway, aws, gcp, kubernetes)
- **queue** → `stacks/queue/<slug>` (redis, bullmq, rabbitmq, kafka, nats, celery)
- **auth** → `stacks/auth/<slug>` (authjs, clerk, lucia, supabase-auth, keycloak, auth0, passport)

The full option-by-option table (with ✅ presence checks) is in [COVERAGE.md](COVERAGE.md).

## Relationship to runtime skills
To make a piece of this knowledge executable inside an org workspace, author a separate `# Skill — <name>` file under that workspace's `.claude/skills/` (the indexed, runtime format). This library is the source material; it is not wired into the scaffold.

## Maintenance
Sources drift. The `verified:` date on each knowledge skill enables a staleness sweep. Known volatile entries are flagged in-skill: **Lucia** (now a learning resource, not a maintained library), **PlanetScale/Neon** (evolving products), and the fast-moving AI-UI reference sites. Re-run the URL-integrity check and re-verify before relying on version-specific details past the verified date.
