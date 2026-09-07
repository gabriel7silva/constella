---
name: postgresql
description: Robust open-source relational database with strong SQL, ACID, and extensibility; consult for schema design, transactions, and indexing.
domain: stack
category: database
tags: [postgresql, sql, rdbms, relational, acid]
official_sources:
  - https://www.postgresql.org/docs/
  - https://github.com/postgres/postgres
verified: 2026-06-16
---

# PostgreSQL

## Overview
PostgreSQL is a mature, open-source object-relational database emphasizing standards compliance, ACID transactions, and extensibility. Read this when choosing a relational store, designing schemas, writing SQL, or tuning indexes and queries for a Postgres backend.

## Official sources
- Docs: https://www.postgresql.org/docs/
- Repo (official GitHub mirror; development uses the project's own git): https://github.com/postgres/postgres
- Install / download: https://www.postgresql.org/download/

## Install / setup
Ubuntu, via the PostgreSQL Apt repository (from postgresql.org/download/linux/ubuntu/):

```bash
sudo apt install -y postgresql-common
sudo /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh
sudo apt update
sudo apt install postgresql-18
```

The simplest path (distribution-included package) is:

```bash
apt install postgresql
```

## Core concepts
- Relational model with ACID transactions; everything runs inside a transaction (explicit or implicit).
- Rich type system: beyond standard SQL types, native JSON/JSONB, arrays, ranges, and user-defined types.
- MVCC (Multi-Version Concurrency Control): readers don't block writers and vice versa; old row versions are cleaned by VACUUM.
- Indexes: B-tree (default), plus GIN, GiST, BRIN, and Hash for specialized access patterns (e.g., GIN for JSONB/full-text).
- Extensions: functionality like PostGIS or pg_trgm loaded via `CREATE EXTENSION`.
- Roles and privileges: a unified role system handles both users and groups.
- Schemas: namespaces within a database for organizing objects.

## Best practices
- Use the appropriate index type for the query; verify plans with `EXPLAIN ANALYZE` before adding indexes blindly.
- Prefer `JSONB` over `JSON` when you need to index or query inside documents (binary form supports GIN indexing).
- Let autovacuum run, and monitor for table bloat on high-churn tables (see docs on routine vacuuming).
- Use connection pooling for high-concurrency apps; each connection is a backend process.
- Define explicit constraints (NOT NULL, FOREIGN KEY, CHECK, UNIQUE) so the database enforces integrity.

## Common pitfalls
- Skipping `EXPLAIN ANALYZE` and assuming an index is used → confirm the planner actually chooses it.
- Treating `JSON` and `JSONB` as interchangeable → `JSON` preserves text and is not efficiently indexable; use `JSONB` for querying.
- Ignoring VACUUM/autovacuum on write-heavy tables → leads to bloat and transaction ID wraparound risk.
- Opening one DB connection per request without pooling → process exhaustion under load.

## Examples
```sql
CREATE TABLE users (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  profile JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_profile ON users USING GIN (profile);
```

## Further reading
- Indexes: https://www.postgresql.org/docs/current/indexes.html
- Routine vacuuming: https://www.postgresql.org/docs/current/routine-vacuuming.html

## Related skills
- ../mysql — alternative open-source RDBMS
- ../supabase — hosted Postgres with auth/storage/realtime
- ../neon — serverless Postgres
- ../cockroachdb — distributed, Postgres-wire-compatible SQL
