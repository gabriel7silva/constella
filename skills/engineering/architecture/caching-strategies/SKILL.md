---
name: caching-strategies
description: Cache layers, cache-aside, TTLs, and invalidation to cut latency and load; read before adding a cache or debugging stale data.
domain: engineering
category: architecture
tags: [caching, cache-aside, ttl, invalidation, redis]
official_sources:
  - https://aws.amazon.com/caching/
  - https://redis.io/docs/latest/develop/
verified: 2026-06-16
---

# Caching Strategies

## Overview
A cache is a high-speed storage layer that holds a subset of data so future reads are served from fast memory (often sub-millisecond) instead of a slower origin. Caching reduces latency and offloads databases and services, but introduces the hard problems of staleness and invalidation. Read this before adding a cache layer or diagnosing stale/inconsistent reads.

## Official sources
- AWS — Caching Overview (layers, TTLs, CDN, in-memory): https://aws.amazon.com/caching/
- Redis — Develop documentation (data types, clients, pub/sub): https://redis.io/docs/latest/develop/

## Core concepts
- **What a cache is**: a high-speed layer storing a subset of data; reading from an in-memory cache is extremely fast (sub-millisecond) compared with the origin store.
- **Cache layers**: caching happens at multiple tiers — CDN/edge for static content, application/in-memory caches (e.g. Redis) for data and sessions, and database/query caches.
- **Cache-aside (lazy loading)**: the application checks the cache first; on a miss it loads from the origin, populates the cache, and returns — only requested data is ever cached.
- **TTL (time to live)**: an expiry applied to cached entries so stale data is automatically evicted after a bounded window.
- **CDN / edge caching**: a CDN serves cached copies of content (pages, images, video) from a global network of edge locations near users.
- **Eviction**: when memory is full, caches evict entries by policy (e.g. LRU) to make room for new data.

## Best practices
- Set a TTL on cached entries so staleness is bounded even when explicit invalidation is missed (AWS recommends TTLs to expire data appropriately).
- Use cache-aside as the default for read-heavy data: load on demand and cache only what is actually requested.
- Cache at the right layer: CDN for static assets, in-memory (Redis) for hot data and sessions, closest to where the read happens.
- Invalidate or update the cache on writes (write-through or explicit delete) to limit how long stale data can be served.

## Common pitfalls
- Caching with no TTL and no invalidation → data silently goes stale forever; always bound freshness.
- Cache stampede: many concurrent misses hit the origin at once when a hot key expires → use locking/single-flight or staggered/jittered TTLs.
- Caching user-specific or sensitive data in a shared/edge cache → leaks across users; scope cache keys and mark private responses appropriately.

## Examples
```text
Cache-aside read path:
  1. value = cache.get(key)
  2. if hit: return value
  3. value = db.query(...)        # miss
  4. cache.set(key, value, TTL)   # populate with expiry
  5. return value
# On write: db.update(...); cache.del(key)  (or update in place)
```

## Further reading
- Redis develop docs (clients, data types, pub/sub): https://redis.io/docs/latest/develop/
- AWS caching overview (database, session, API caching): https://aws.amazon.com/caching/

## Related skills
- ../system-design-fundamentals — latency/throughput trade-offs caching addresses
- ../api-design-rest-graphql — HTTP caching of API responses
- ../scalability-reliability — caching to offload origins under load
