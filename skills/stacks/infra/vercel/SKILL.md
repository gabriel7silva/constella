---
name: vercel
description: Managed hosting optimized for frontends and serverless functions; consult for deploys, preview URLs, env vars, and the Vercel CLI.
domain: stack
category: infra
tags: [hosting, serverless, frontend, deploy, cli]
official_sources:
  - https://vercel.com/docs
  - https://github.com/vercel/vercel
verified: 2026-06-16
---

# Vercel

## Overview
Vercel is a managed platform for deploying frontend apps and serverless/edge functions, with Git-driven deployments and automatic preview URLs per branch/commit. It is optimized for frameworks like Next.js but supports any static or Node-based app. Read this when you need to deploy a web frontend, wire up preview environments, or script deploys via the CLI.

## Official sources
- Docs: https://vercel.com/docs
- Repo: https://github.com/vercel/vercel
- CLI install: https://vercel.com/docs/cli

## Install / setup
```bash
npm i vercel
```

## Core concepts
- Deployments: every push produces an immutable deployment with its own URL; production is a promoted deployment.
- Preview deployments: non-production branches/commits get unique preview URLs for review before promotion.
- Serverless & edge functions: backend logic runs as functions co-located with the deployment rather than a long-running server.
- Environment variables: scoped per environment (development, preview, production) and pulled locally with `vercel pull`.
- Projects & linking: a local directory is linked to a Vercel project so CLI commands target the right deployment target.
- `vercel.json`: optional project configuration for routes, rewrites, headers, and cron jobs.

## Best practices
- Use `vercel build` then `vercel deploy --prebuilt` (or Git integration) so CI reproduces the same build the platform runs.
- Store secrets as environment variables scoped to the correct environment, and use `vercel env pull` to sync them locally rather than committing them.
- In CI/CD, authenticate with the `VERCEL_TOKEN` environment variable instead of passing `--token` on the command line (per the CLI docs) to keep tokens out of process lists/logs.
- Promote a verified preview to production rather than deploying untested code straight to prod.

## Common pitfalls
- Assuming env vars set for production are available in preview/development → they are environment-scoped and must be added per environment.
- Putting long-running or stateful work in serverless functions → they are short-lived and stateless; use a queue or external store.
- Skipping `vercel link` → CLI commands may target the wrong or no project.

## Examples
```bash
# Link the directory, pull env vars, and deploy to production
vercel link
vercel pull --environment=production
vercel deploy --prod
```

## Further reading
- https://vercel.com/docs/cli — full CLI command reference
- https://vercel.com/docs/projects/environment-variables — environment variables

## Related skills
- ../netlify — comparable managed frontend hosting platform
