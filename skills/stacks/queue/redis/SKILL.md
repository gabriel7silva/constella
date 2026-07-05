---
name: redis
description: In-memory data store used as a cache, message broker, and queue backend; consult when adding caching, pub/sub, or queue infrastructure.
domain: stack
category: queue
tags: [redis, cache, queue, pubsub, streams, in-memory]
official_sources:
  - https://redis.io/docs/latest/develop/
  - https://github.com/redis/redis
verified: 2026-06-16
---

# Redis

## Overview
Redis is an in-memory key-value data store used as a cache, data-structure server, message broker, and the backing store for many job-queue libraries. It keeps data in RAM for sub-millisecond access while offering optional persistence. Read this when you need fast caching, pub/sub messaging, rate limiting, or a queue substrate (BullMQ, Celery, Sidekiq all build on Redis).

## Official sources
- Docs: https://redis.io/docs/latest/develop/
- Repo: https://github.com/redis/redis
- Install / download: https://redis.io/docs/latest/operate/oss_and_stack/install/install-stack/

## Install / setup
```bash
# Docker (quickest, only officially supported method on Windows)
docker run -d --name redis -p 6379:6379 redis
```
```bash
# macOS (Homebrew)
brew tap redis/redis
brew install --cask redis
```

## Core concepts
- **Data types**: strings, hashes, lists, sets, sorted sets, streams, bitmaps, hyperloglogs, and geospatial indexes — choosing the right type is the primary modeling decision.
- **Single-threaded command execution**: commands run sequentially on one main thread, so each command is atomic; long-running commands block all clients.
- **Key expiration / eviction**: keys can be given a TTL (`EXPIRE`/`SET ... EX`); when memory fills, the configured `maxmemory-policy` (e.g. `allkeys-lru`) decides what to evict — central to cache behavior.
- **Pub/Sub and Streams**: Pub/Sub is fire-and-forget fan-out; Streams are append-only logs with consumer groups for durable, replayable queue semantics.
- **Persistence (RDB + AOF)**: RDB snapshots and the append-only file give durability; Redis is in-memory first, so persistence is a configurable trade-off, not the default guarantee.
- **Transactions and Lua scripts**: `MULTI`/`EXEC` and server-side Lua scripts run atomically, which is how queue libraries implement reliable multi-key operations.

## Best practices
- Set explicit TTLs on cache keys and choose an eviction policy that matches your workload rather than relying on unbounded growth (see Redis eviction docs).
- Prefer `SCAN` over `KEYS` in production; `KEYS` blocks the single thread across the whole keyspace.
- Use pipelining or `MULTI`/Lua to batch related operations and cut round-trips instead of issuing many sequential commands.
- For durable queues use Streams with consumer groups (acknowledge with `XACK`) rather than plain lists, so unprocessed messages survive consumer crashes.

## Common pitfalls
- Treating Redis as a fully durable primary database → it is in-memory first; enable AOF/RDB and understand the data-loss window, or keep the system of record elsewhere.
- Running `KEYS *` or large `SMEMBERS`/`HGETALL` on big keys in production → blocks the server; use `SCAN`/cursor-based iteration and avoid giant keys.
- Forgetting `maxmemory` and eviction policy → Redis can exhaust RAM and start failing writes (or get OOM-killed) under load.

## Examples
```bash
SET session:42 "user-data" EX 3600   # value with a 1-hour TTL
INCR page:views                       # atomic counter
XADD orders '*' id 99 status new      # append to a stream
```

## Further reading
- https://redis.io/docs/latest/develop/data-types/ — data type reference
- https://redis.io/docs/latest/develop/interact/pubsub/ — Pub/Sub guide

## Related skills
- ../bullmq — Redis-backed job queue for Node.js built on these primitives
- ../celery — Python task queue that can use Redis as its broker
