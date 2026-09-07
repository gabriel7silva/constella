---
name: cassandra
description: Distributed wide-column NoSQL database for high write throughput and linear scalability; consult for partition-key data modeling with CQL.
domain: stack
category: database
tags: [cassandra, nosql, wide-column, distributed, cql]
official_sources:
  - https://cassandra.apache.org/doc/latest/
  - https://github.com/apache/cassandra
verified: 2026-06-16
---

# Apache Cassandra

## Overview
Apache Cassandra is a distributed, wide-column NoSQL database designed for high write throughput, linear scalability, and no single point of failure across many nodes and data centers. Read this when modeling query-driven schemas with CQL, choosing partition keys, or tuning replication and consistency.

## Official sources
- Docs: https://cassandra.apache.org/doc/latest/
- Repo (official, Apache Software Foundation): https://github.com/apache/cassandra
- Download: https://cassandra.apache.org/_/download.html

## Install / setup
On Debian/Ubuntu via the official Apache APT repository (from cassandra.apache.org/_/download.html; replace `41x` with the desired series):

```bash
curl -o /etc/apt/keyrings/apache-cassandra.asc https://downloads.apache.org/cassandra/KEYS
echo "deb [signed-by=/etc/apt/keyrings/apache-cassandra.asc] https://debian.cassandra.apache.org 41x main" | sudo tee -a /etc/apt/sources.list.d/cassandra.sources.list
sudo apt-get update
sudo apt-get install cassandra
```

A tarball binary is also available from the same download page.

## Core concepts
- Wide-column model: data is organized in tables with partition keys and clustering columns; query with CQL.
- Partition key: determines which node(s) store a row's partition; the foundation of data distribution.
- Clustering columns: define row ordering within a partition.
- Tunable consistency: per-query consistency levels (e.g., ONE, QUORUM, ALL) trade latency vs. consistency.
- Replication: replication factor and strategy (e.g., NetworkTopologyStrategy) control copies across racks/data centers.
- Masterless/peer-to-peer architecture: every node is equal; there is no single point of failure.

## Best practices
- Design tables per query: denormalize and create one table per access pattern rather than normalizing.
- Choose partition keys that spread data evenly and keep partitions bounded in size.
- Use QUORUM reads and writes when you need strong-ish consistency; understand the consistency-level tradeoffs.
- Avoid unbounded partitions and very wide rows; they cause hotspots and slow queries.
- Prefer prepared statements in application code for efficiency and safety.

## Common pitfalls
- Modeling like a relational database (normalization, ad-hoc joins) → Cassandra has no joins; model by query.
- Picking a low-cardinality partition key → uneven distribution and hotspots.
- Allowing partitions to grow unbounded → degraded performance and node pressure.
- Using `ALLOW FILTERING` to make arbitrary queries work → full scans; redesign the table instead.

## Examples
```sql
CREATE TABLE messages_by_user (
  user_id uuid,
  created_at timestamp,
  message_id timeuuid,
  body text,
  PRIMARY KEY ((user_id), created_at, message_id)
) WITH CLUSTERING ORDER BY (created_at DESC);
```

## Further reading
- Data modeling: https://cassandra.apache.org/doc/latest/cassandra/developing/data-modeling/index.html
- CQL reference: https://cassandra.apache.org/doc/latest/cassandra/developing/cql/index.html

## Related skills
- ../cockroachdb — distributed SQL alternative with strong consistency
- ../mongodb — document NoSQL alternative
- ../dynamodb — managed key-value/wide-column alternative
