---
name: mongodb
description: Document database storing flexible JSON-like (BSON) documents; consult for schema design, indexing, aggregation, and NoSQL data modeling.
domain: stack
category: database
tags: [mongodb, nosql, document, bson, database]
official_sources:
  - https://www.mongodb.com/docs/
  - https://github.com/mongodb/mongo
verified: 2026-06-16
---

# MongoDB

## Overview
MongoDB is a document-oriented NoSQL database that stores flexible, JSON-like documents (BSON) in collections, well suited for evolving schemas and nested data. Read this when modeling document data, designing indexes, writing queries/aggregations, or choosing between embedding and referencing.

## Official sources
- Docs: https://www.mongodb.com/docs/
- Repo (official; SSPL v1 license for releases after 2018-10-16): https://github.com/mongodb/mongo
- Download (Community Server): https://www.mongodb.com/try/download/community

## Install / setup
Download MongoDB Community Server from mongodb.com/try/download/community for your platform (Ubuntu, Debian, RedHat/CentOS, SUSE, Amazon Linux, macOS, Windows). MongoDB Atlas is the managed cloud alternative; its quick setup uses Homebrew:

```bash
brew install mongodb-atlas
atlas setup
```

For self-hosted Community Server, follow the platform-specific install guide at https://www.mongodb.com/docs/manual/administration/install-community/.

## Core concepts
- Documents and collections: documents (BSON) are grouped into collections; no fixed schema is required.
- Flexible schema: fields can vary between documents in the same collection.
- Indexes: single-field, compound, multikey (arrays), text, and others; needed for query performance.
- Aggregation pipeline: stages (`$match`, `$group`, `$lookup`, etc.) transform and compute over documents.
- Embedding vs referencing: model related data inline (embed) or via references depending on access patterns.
- Replica sets and sharding: replica sets provide HA; sharding partitions data horizontally across shards.

## Best practices
- Model schema around your application's query patterns; embed data that is read together, reference data that grows unboundedly.
- Create indexes that support your queries and sorts; confirm usage with `explain()`.
- Use the aggregation pipeline for server-side data transformation instead of pulling and processing in the app.
- Prefer a replica set (even of one for dev parity) so transactions and failover behave as in production.
- Use schema validation rules when you need to enforce document shape.

## Common pitfalls
- Treating MongoDB like a relational DB with many `$lookup` joins → reconsider the data model; embed where appropriate.
- Letting documents grow without bound (e.g., ever-growing arrays) → can exceed the 16 MB document limit; use references/bucketing.
- Forgetting indexes on filtered/sorted fields → full collection scans.
- Assuming multi-document atomicity without transactions → use transactions (requires a replica set) when you need them.

## Examples
```javascript
db.users.insertOne({
  email: "a@example.com",
  profile: { name: "Ada", roles: ["admin"] },
  createdAt: new Date()
});

db.users.createIndex({ email: 1 }, { unique: true });
```

## Further reading
- Data modeling: https://www.mongodb.com/docs/manual/data-modeling/
- Aggregation: https://www.mongodb.com/docs/manual/aggregation/

## Related skills
- ../dynamodb — managed key-value/document NoSQL alternative
- ../redis — in-memory store for caching and ephemeral data
