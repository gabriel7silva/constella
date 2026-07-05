---
name: neon
description: Open-source serverless Postgres that separates storage and compute with autoscaling, scale-to-zero, and database branching; consult for serverless Postgres.
domain: stack
category: database
tags: [neon, postgres, serverless, branching, autoscaling]
official_sources:
  - https://neon.com/docs
  - https://github.com/neondatabase/neon
verified: 2026-06-16
---

# Neon

## Overview
Neon is an open-source serverless Postgres platform that separates storage and compute, enabling autoscaling, scale-to-zero, and Git-like database branching. Read this when you want managed PostgreSQL with per-developer/per-preview branches and pay-for-what-you-use compute.

## Official sources
- Docs: https://neon.com/docs
- Repo (official): https://github.com/neondatabase/neon
- Get started / sign up: https://neon.com/docs/get-started-with-neon/signing-up

## Install / setup
Neon is a managed serverless platform — there is no local server to install for normal use. Get started by signing up at console.neon.tech (email, GitHub, Google, or partner accounts), which provisions a Project with a default production branch. The Neon CLI manages projects and branches from the terminal; install it per the docs:

```bash
npm install -g neonctl
```

(See https://neon.com/docs/reference/neon-cli for the authoritative install instructions.)

## Core concepts
- Project: the top-level container holding branches, databases, and roles.
- Storage/compute separation: a custom storage layer (Pageserver + Safekeepers for WAL) backs stateless Postgres compute nodes.
- Branching: create instant, copy-on-write branches of your database for dev, testing, and previews.
- Autoscaling and scale-to-zero: compute scales with load and can suspend when idle to save cost.
- Standard Postgres: it is real PostgreSQL, so SQL, drivers, and most extensions work unchanged.
- Roles and databases live within a branch; resetting a branch to its parent is a core workflow.

## Best practices
- Use database branches for each feature/PR/preview environment instead of sharing one database.
- Account for cold starts when compute has scaled to zero in latency-sensitive paths; keep a minimum compute if needed.
- Use connection pooling (Neon provides a pooled connection string) for serverless/edge clients that open many short connections.
- Treat it as standard Postgres: apply normal schema design, indexing, and migration practices.
- Keep the production branch protected and develop on child branches.

## Common pitfalls
- Ignoring cold-start latency after scale-to-zero → first query on a suspended compute is slower; configure accordingly.
- Opening many direct (non-pooled) connections from serverless functions → exhausts connections; use the pooled endpoint.
- Assuming branches are fully isolated forever → they share a parent point-in-time; understand copy-on-write semantics.
- Forgetting it is plain Postgres and reaching for bespoke tooling → standard Postgres practices apply.

## Examples
```bash
# Create a branch for a feature using the Neon CLI
neonctl branches create --name feature-x

# Get its connection string
neonctl connection-string feature-x
```

## Further reading
- Branching: https://neon.com/docs/introduction/branching
- Connection pooling: https://neon.com/docs/connect/connection-pooling

## Related skills
- ../postgresql — the database engine Neon runs
- ../supabase — Postgres-based backend platform with auth/storage/realtime
