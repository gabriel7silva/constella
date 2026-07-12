---
name: database-query-optimization
description: Speed up SQL with proper indexing and EXPLAIN — read query plans, understand B-tree index lookups, and fix slow access paths.
domain: engineering
category: performance
tags: [sql, indexing, explain, query-plan, postgresql, b-tree, optimization]
official_sources:
  - https://use-the-index-luke.com/
  - https://www.postgresql.org/docs/current/using-explain.html
verified: 2026-06-16
---

# Database Query Optimization

## Overview
Most SQL performance problems are access-path problems: the right index turns a full scan into a targeted lookup, and `EXPLAIN` reveals which path the planner actually chose. Read this when a query is slow, when adding indexes, or when you need to interpret a query plan rather than guess. Material is grounded in Markus Winand's "Use The Index, Luke" and the official PostgreSQL documentation.

## Official sources
- SQL indexing guide: https://use-the-index-luke.com/
- Why indexes can be slow: https://use-the-index-luke.com/sql/anatomy/slow-indexes
- PostgreSQL Using EXPLAIN: https://www.postgresql.org/docs/current/using-explain.html
- PostgreSQL source (mirror): https://github.com/postgres/postgres

## Core concepts
- **A B-tree index has structure.** An index is a balanced tree whose leaf nodes form a doubly linked list of sorted entries; a lookup does a tree traversal to the right leaf, then optionally follows the leaf chain.
- **An index lookup has three steps.** Per use-the-index-luke: tree traversal, following the leaf node chain, and accessing the table rows. The third step (one table access per matching row) is usually what makes an "indexed" query still slow.
- **Scan types map to those steps.** `INDEX UNIQUE SCAN` is tree traversal only; `INDEX RANGE SCAN` traverses and walks the leaf chain; `TABLE ACCESS BY INDEX ROWID` fetches the actual rows.
- **EXPLAIN shows the plan; ANALYZE runs it.** `EXPLAIN` prints the planner's chosen tree of nodes with estimated cost, rows, and width; `EXPLAIN ANALYZE` executes the query and reports actual time, row counts, and (with `BUFFERS`) buffer usage.
- **Cost estimates drive plan choice.** PostgreSQL estimates each node's cost from table statistics; bad statistics lead to bad plans (e.g. choosing a seq scan over an index, or vice versa).
- **Selectivity decides whether an index helps.** Indexes win when they select a small fraction of rows; for low-selectivity predicates a sequential scan can legitimately be faster than many scattered table accesses.

## Best practices
- **Index for the WHERE clause and join columns.** Create indexes that cover the predicates that filter rows; column order in a composite index matters because the tree is sorted left-to-right.
- **Read the actual plan, not your assumptions.** Use `EXPLAIN (ANALYZE, BUFFERS)` to compare estimated vs actual rows; a large gap signals stale statistics or a misjudged predicate.
- **Keep statistics fresh.** Ensure `ANALYZE`/autovacuum keeps planner statistics current so cost estimates stay accurate.
- **Prefer covering / index-only access for hot queries.** Include the selected columns in the index so the table-access step (the expensive third step) can be skipped where supported.
- **Avoid functions/wrapping on indexed columns in predicates.** Applying a function to a column (or an implicit cast) prevents the plain index from being used; index the expression instead if needed.

## Common pitfalls
- **"It has an index, so it's fast"** → an `INDEX RANGE SCAN` over many matches plus one table access per row can be slower than a scan; check selectivity and the plan.
- **Trusting estimated rows** → estimates can be wrong; `EXPLAIN ANALYZE` shows the real row counts and timing to confirm.
- **Wrong composite index column order** → a leading column that isn't in the predicate makes the index unusable for that filter; order columns by how they are queried.
- **Wrapping indexed columns in functions** → `WHERE lower(email) = ...` skips a plain index on `email`; create a matching expression index or store normalized values.

## Examples
```sql
-- Inspect the real plan, not just the estimate
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, status
FROM orders
WHERE customer_id = 42 AND status = 'open';

-- Composite index ordered to match the predicate (equality columns first)
CREATE INDEX idx_orders_customer_status ON orders (customer_id, status);
```

## Further reading
- https://use-the-index-luke.com/sql/anatomy/slow-indexes — the three steps of a lookup in detail
- https://www.postgresql.org/docs/current/using-explain.html — full EXPLAIN/ANALYZE reference
- ./reference.md — join strategies and planner internals (loaded only when needed)

## Related skills
- ../backend-performance — eliminating N+1 access patterns that no index can fix
- ../profiling-and-benchmarking — measuring query latency before and after indexing
