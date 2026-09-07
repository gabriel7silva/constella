---
name: data-modeling
description: Relational and document data modeling — tables, keys, constraints, normalization, and when to denormalize; read before designing a schema.
domain: engineering
category: architecture
tags: [data-modeling, relational, normalization, constraints, schema-design]
official_sources:
  - https://www.postgresql.org/docs/current/ddl.html
verified: 2026-06-16
---

# Data Modeling

## Overview
Data modeling is the design of how data is structured, related, and constrained so it stays correct and queryable as the system grows. Relational modeling emphasizes normalization and referential integrity enforced by the database; document modeling embeds related data for read locality. Read this before creating a schema, adding a table, or choosing between relational and document storage.

## Official sources
- PostgreSQL — Data Definition (tables, constraints, keys, schemas, partitioning): https://www.postgresql.org/docs/current/ddl.html

## Core concepts
- **Tables, columns, and types**: a relational model defines entities as tables with typed columns; choosing correct types and defaults is the first integrity control.
- **Constraints**: PostgreSQL supports NOT NULL, UNIQUE, CHECK, PRIMARY KEY, FOREIGN KEY, and EXCLUSION constraints — push invariants into the database so invalid data cannot be stored.
- **Primary and foreign keys**: primary keys uniquely identify rows; foreign keys enforce referential integrity between related tables.
- **Normalization**: organize data to eliminate redundancy and update anomalies (1NF/2NF/3NF) so each fact lives in exactly one place.
- **Schemas and namespacing**: schemas group related objects and provide logical organization and access boundaries within a database.
- **Document vs relational**: document models embed/denormalize related data for single-read access and flexible shape, trading integrity guarantees and join flexibility for read performance.

## Best practices
- Enforce invariants with database constraints (NOT NULL, UNIQUE, FOREIGN KEY, CHECK) rather than relying only on application code — the DB is the last line of defense.
- Normalize to remove redundancy first; denormalize deliberately and only when measured read patterns justify it.
- Always define primary keys and back foreign-key columns with indexes to keep referential checks and joins fast.
- Choose data types tightly (e.g. proper numeric/timestamp types, generated/identity columns where appropriate) so the database validates and stores values efficiently.

## Common pitfalls
- Modeling everything as nullable text → loses validation and indexing benefits; use precise types and NOT NULL where the value is required.
- Skipping foreign keys "for speed" → orphaned and inconsistent rows accumulate; let referential integrity be enforced by the engine.
- Premature denormalization → duplicated facts drift out of sync; normalize first, denormalize only with evidence.

## Examples
```sql
-- Relational schema with keys and constraints (PostgreSQL DDL)
CREATE TABLE author (
  id    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email text NOT NULL UNIQUE
);

CREATE TABLE post (
  id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  author_id bigint NOT NULL REFERENCES author(id),
  title     text   NOT NULL CHECK (length(title) > 0),
  published boolean NOT NULL DEFAULT false
);

CREATE INDEX ON post (author_id);
```

## Further reading
- PostgreSQL constraints reference: https://www.postgresql.org/docs/current/ddl-constraints.html
- PostgreSQL table partitioning: https://www.postgresql.org/docs/current/ddl-partitioning.html

## Related skills
- ../system-design-fundamentals — partitioning and sharding at scale
- ../caching-strategies — caching query results
- ../api-design-rest-graphql — mapping the model to resources/types
