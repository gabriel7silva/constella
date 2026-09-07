---
name: planetscale
description: Managed database platform offering Vitess (MySQL-compatible) and Postgres clusters with branching and non-blocking schema changes; consult for scalable managed SQL.
domain: stack
category: database
tags: [planetscale, vitess, mysql, postgres, managed]
official_sources:
  - https://planetscale.com/docs
  - https://github.com/planetscale/cli
verified: 2026-06-16
---

# PlanetScale

## Overview
PlanetScale is a managed database platform that offers fully managed Vitess (MySQL-compatible, horizontally shardable) clusters and PostgreSQL clusters on locally-attached NVMe storage, with developer features like database branching, deploy requests, and non-blocking schema changes. Read this when you want managed, scalable SQL with a branch-and-merge schema workflow.

## Official sources
- Docs: https://planetscale.com/docs
- CLI repo (official): https://github.com/planetscale/cli
- Org: https://github.com/planetscale

> Note: PlanetScale is a managed cloud platform; there is no single open-source server repo to self-host the product. The `pscale` CLI is open source. As of verification, PlanetScale offers both Vitess and PostgreSQL clusters — check the docs for current engine support.

## Install / setup
Install the `pscale` CLI via Homebrew (from the official CLI repo README):

```bash
brew install planetscale/tap/pscale
```

Some `pscale` commands require a MySQL 8 client in your PATH. See the docs for environment setup.

## Core concepts
- Managed clusters: Vitess (MySQL-compatible, supports horizontal sharding) and PostgreSQL options.
- Database branching: create isolated branches of your schema, like Git branches for the database.
- Deploy requests: review and merge schema changes from a branch to production safely.
- Non-blocking schema changes: schema migrations apply without locking tables/downtime.
- High availability: deployments across availability zones with a primary and replicas, with automated failover.
- Query insights: built-in observability for query performance.

## Best practices
- Use branches plus deploy requests to review schema changes rather than altering production directly.
- For Vitess/MySQL, design with the sharding model in mind (Vitess does not support cross-shard foreign keys the way single-node MySQL does).
- Use the `pscale` CLI and connection strings rather than embedding raw credentials.
- Verify which engine (Vitess vs Postgres) your project uses, since features and SQL behavior differ.
- Lean on non-blocking schema changes for online migrations instead of manual lock-heavy ALTERs.

## Common pitfalls
- Assuming full single-node MySQL semantics on a Vitess cluster → foreign keys and some cross-shard operations differ; check docs.
- Editing production schema directly instead of via deploy requests → bypasses review/safety.
- Hardcoding credentials rather than using the CLI/connection management → security and rotation issues.
- Treating the platform as static → the product is evolving; re-verify engine/feature support against the docs.

## Examples
```bash
# Authenticate and create a development branch
pscale auth login
pscale branch create my-db dev
# Connect locally through a secure proxy
pscale connect my-db dev
```

## Further reading
- Environment setup: https://planetscale.com/docs/reference/planetscale-environment-setup
- Branching: https://planetscale.com/docs

## Related skills
- ../mysql — the engine family PlanetScale's Vitess clusters are compatible with
- ../postgresql — the engine behind PlanetScale's Postgres clusters
