---
name: cockroachdb
description: Distributed, strongly-consistent SQL database with Postgres wire compatibility; consult for horizontally scalable, survivable SQL backends.
domain: stack
category: database
tags: [cockroachdb, distributed-sql, postgres-compatible, newsql, acid]
official_sources:
  - https://www.cockroachlabs.com/docs/
  - https://github.com/cockroachdb/cockroach
verified: 2026-06-16
---

# CockroachDB

## Overview
CockroachDB is a cloud-native distributed SQL database built on a transactional, strongly-consistent key-value store; it scales horizontally and survives node, zone, and region failures while offering familiar SQL. Read this when you need a resilient, geo-distributed SQL backend that speaks the PostgreSQL wire protocol.

## Official sources
- Docs: https://www.cockroachlabs.com/docs/
- Repo (official, Cockroach Labs; CockroachDB Software License for v24.3+): https://github.com/cockroachdb/cockroach
- Install: https://www.cockroachlabs.com/docs/stable/install-cockroachdb

## Install / setup
On macOS via Homebrew (from the official install page; note macOS is documented as experimental, not for production):

```bash
brew install cockroachdb/tap/cockroach
```

For Linux/Windows or production deployments, download the binary from the official Releases page linked at https://www.cockroachlabs.com/docs/stable/install-cockroachdb.

## Core concepts
- Distributed SQL: data is automatically split into ranges and replicated across nodes using the Raft consensus protocol.
- Strong consistency and serializable isolation by default for ACID transactions across the cluster.
- PostgreSQL wire compatibility: existing Postgres drivers and many SQL features work against CockroachDB.
- Survivability: configure replication and locality so the cluster tolerates node/zone/region failures.
- Horizontal scaling: add nodes to increase capacity and throughput without manual sharding.
- Multi-region features: regional and global tables to control data placement and latency.

## Best practices
- Choose primary keys that distribute writes (avoid sequential keys that create hotspots); consider hash-sharded indexes for sequential patterns.
- Run at least three nodes so Raft can tolerate a node failure; set replication factor accordingly.
- Use the multi-region abstractions (table localities, region survival goals) instead of hand-rolling placement.
- Retry transactions on serialization errors (40001) — required under serializable isolation.
- Test against a local cluster that mirrors production replication, not a single insecure node.

## Common pitfalls
- Using monotonically increasing primary keys → write hotspots on a single range; use UUIDs or hash-sharded indexes.
- Not handling transaction retry errors → serializable isolation can abort transactions that must be retried.
- Treating macOS Homebrew installs as production-ready → documented as experimental; use Linux binaries/containers in production.
- Assuming full Postgres feature parity → most features map, but verify unsupported/different behaviors in the docs.

## Examples
```sql
CREATE TABLE events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## Further reading
- Performance best practices: https://www.cockroachlabs.com/docs/stable/performance-best-practices-overview
- Transactions & retries: https://www.cockroachlabs.com/docs/stable/transactions

## Related skills
- ../postgresql — wire-compatible single-node relational database
- ../cassandra — distributed wide-column alternative (different consistency model)
