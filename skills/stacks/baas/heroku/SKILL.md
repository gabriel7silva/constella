---
name: heroku
description: Heroku is a Git-push Platform-as-a-Service for deploying and running apps (Node, Python, Ruby, Java, Go, PHP) with managed add-ons like Postgres and Redis. Consult when deploying an app via git push, configuring buildpacks/Procfile/dynos, setting config vars, scaling processes, provisioning Postgres/Redis add-ons, or using the Heroku CLI.
domain: stack
category: baas
tags: [heroku, paas, deployment, dynos, buildpacks, postgres, git]
official_sources:
  - https://devcenter.heroku.com/
  - https://github.com/heroku/cli
  - https://devcenter.heroku.com/articles/heroku-cli
verified: 2026-06-17
---

# Heroku

## Overview
Heroku is a managed Platform-as-a-Service that runs your application code on isolated containers called dynos, deployed by pushing to a Git remote. It detects your language via buildpacks, runs processes declared in a `Procfile`, and offers a marketplace of add-ons (Heroku Postgres, Redis, etc.) so you avoid managing servers. Read this when deploying via `git push heroku`, defining dynos/process types, managing config vars and add-ons, or scaling with the Heroku CLI.

## Official sources
- Docs: https://devcenter.heroku.com/
- Repo: https://github.com/heroku/cli
- Install: https://devcenter.heroku.com/articles/heroku-cli

## Install / setup
```bash
heroku login
heroku create
git push heroku main
```
Source: https://devcenter.heroku.com/articles/getting-started-with-nodejs (install CLI via https://devcenter.heroku.com/articles/heroku-cli)

## Core concepts
- **Dyno** — lightweight isolated container running one process type; scaled horizontally/vertically by dyno type.
- **Buildpack** — language-specific scripts that detect and compile your app into a runnable slug.
- **Procfile** — root-level file declaring process types (`web:`, `worker:`) and their start commands.
- **Config vars** — environment variables set with `heroku config:set`, the standard place for secrets/settings.
- **Add-ons** — managed services (Heroku Postgres, Heroku Redis, etc.) attached and exposed via config vars.
- **Release** — immutable deploy unit (slug + config); rolled back with `heroku rollback`.
- **Stack** — the base OS/runtime image (e.g. `heroku-24`) your dynos run on.

## Best practices
- Store all configuration and secrets in config vars, never in the repo (https://devcenter.heroku.com/articles/config-vars).
- Build stateless processes following the Twelve-Factor App methodology (https://12factor.net).
- Run DB migrations in a `release` Procfile phase, not at boot (https://devcenter.heroku.com/articles/release-phase).
- Provision Heroku Postgres as an add-on instead of an ephemeral local DB (https://devcenter.heroku.com/articles/heroku-postgresql).

## Common pitfalls
- Writing to the dyno's local filesystem → data lost on restart/deploy (ephemeral); use Postgres/S3 add-ons instead.
- Web process not binding to `$PORT` → boot timeout / R10 error; bind your server to `process.env.PORT`.
- Free/Eco dynos sleeping or missing a `web` process type → app returns errors; ensure a valid `Procfile`.

## Examples
```procfile
web: node index.js
worker: node worker.js
release: node ./scripts/migrate.js
```
```bash
heroku config:set NODE_ENV=production
heroku addons:create heroku-postgresql:essential-0
heroku ps:scale web=2
```

## Further reading
- https://devcenter.heroku.com/categories/deployment — deployment methods and Git workflow
- https://devcenter.heroku.com/articles/dynos — dyno types, scaling, and lifecycle
- https://devcenter.heroku.com/articles/procfile — Procfile and process types reference

## Related skills
- ../firebase — BaaS with managed hosting and functions
- ../amplify — AWS fullstack hosting + backend platform
