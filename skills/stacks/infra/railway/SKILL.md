---
name: railway
description: Deploy apps, databases, and services with Git-driven builds; consult for services, variables, environments, and the Railway CLI.
domain: stack
category: infra
tags: [hosting, paas, deploy, database, cli]
official_sources:
  - https://docs.railway.com/
  - https://github.com/railwayapp/cli
verified: 2026-06-16
---

# Railway

## Overview
Railway is a platform-as-a-service for deploying applications, databases, and supporting services from a Git repo or template, with minimal infrastructure configuration. It groups resources into projects and environments and provisions managed databases (Postgres, Redis, etc.) alongside your app. Read this when you need to stand up an app plus its backing services quickly.

## Official sources
- Docs: https://docs.railway.com/
- Repo (CLI): https://github.com/railwayapp/cli
- CLI install: https://docs.railway.com/guides/cli

## Install / setup
```bash
npm i -g @railway/cli
```

## Core concepts
- Project: the top-level container that groups related services and environments.
- Service: a deployable unit (your app, a worker, or a managed database) within a project.
- Environments: isolated copies of a project's services (e.g. production, staging) with their own variables.
- Variables: environment variables per service/environment, including auto-injected connection strings from linked databases.
- Deployments: builds triggered from Git pushes or the CLI, producing a running instance with logs.
- Plugins/databases: managed datastores provisioned into a project and connected via reference variables.

## Best practices
- Use separate environments for staging and production rather than reusing one environment for both.
- Reference database connection details via Railway-provided variables instead of hardcoding credentials.
- Link the local project with the CLI (`railway link`) so commands and `railway run` use the right environment's variables.
- Keep service config and variables in Railway/version-controlled config rather than ad hoc dashboard edits where possible.

## Common pitfalls
- Hardcoding a database URL instead of using the injected reference variable → breaks when the database is recreated or rotated.
- Running commands against the wrong environment → unlink/relink or confirm the active environment before deploying.
- Forgetting the CLI requires Node.js 16+ for the npm install method (per the docs).

## Examples
```bash
# Authenticate, link a project, and deploy
railway login
railway link
railway up

# Run a local command with the project's env vars injected
railway run npm start
```

## Further reading
- https://docs.railway.com/guides/variables — variables and references
- https://docs.railway.com/guides/environments — environments

## Related skills
- ../fly-io — similar deploy platform for apps and databases
