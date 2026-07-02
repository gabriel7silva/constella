---
name: dynamodb
description: AWS fully managed serverless key-value and document NoSQL database; consult for single-digit-ms scale, key design, and access-pattern modeling.
domain: stack
category: database
tags: [dynamodb, aws, nosql, key-value, serverless]
official_sources:
  - https://docs.aws.amazon.com/dynamodb/
  - https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBLocal.html
verified: 2026-06-16
---

# Amazon DynamoDB

## Overview
Amazon DynamoDB is a serverless, fully managed, distributed NoSQL database offering single-digit-millisecond performance at any scale, supporting both key-value and document models. Read this when designing tables, primary keys, and secondary indexes around access patterns for a managed AWS NoSQL backend.

## Official sources
- Docs: https://docs.aws.amazon.com/dynamodb/
- Local development (DynamoDB Local): https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBLocal.html

> Note: DynamoDB is a managed AWS service with no public source repository. There is no open-source server to clone; cite the AWS documentation as the authoritative source.

## Core concepts
- Tables, items, and attributes: a table holds items (rows); each item is a set of attributes.
- Primary key: either a partition key alone, or a composite of partition key + sort key.
- Partition key: hashed to distribute items across storage partitions; central to performance.
- Sort key: orders items within a partition and enables range queries.
- Secondary indexes: Global Secondary Indexes (GSI) and Local Secondary Indexes (LSI) enable queries on alternate keys.
- Capacity modes: on-demand (pay-per-request, auto-scaling, scale to zero) vs. provisioned (set RCU/WCU).
- No JOINs: DynamoDB has no join operator; denormalize and model around queries.

## Best practices
- Model around access patterns first; design keys and indexes to serve known queries (often single-table design).
- Choose high-cardinality partition keys that spread traffic evenly to avoid hot partitions.
- Use `Query` (which targets a partition key) rather than `Scan` (which reads the whole table) for efficiency.
- Use on-demand capacity for unpredictable traffic; provisioned with auto-scaling for steady, cost-sensitive workloads.
- Use DynamoDB Streams to react to item-level changes for event-driven architectures.

## Common pitfalls
- Designing the schema before the access patterns → leads to costly Scans and missing indexes; model queries first.
- Using a low-cardinality partition key → hot partitions and throttling.
- Relying on `Scan` for routine reads → expensive and slow; prefer `Query` with proper keys/indexes.
- Expecting relational features (joins, ad-hoc queries) → denormalize and precompute instead.

## Examples
```bash
# Run DynamoDB Local for development (Docker image)
docker run -p 8000:8000 amazon/dynamodb-local

# Point the AWS CLI at the local endpoint
aws dynamodb list-tables --endpoint-url http://localhost:8000
```

## Further reading
- Core components: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.CoreComponents.html
- Best practices: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html

## Related skills
- ../mongodb — document NoSQL alternative (self-hostable)
- ../cassandra — wide-column NoSQL alternative
- ../redis — in-memory store for caching alongside DynamoDB
