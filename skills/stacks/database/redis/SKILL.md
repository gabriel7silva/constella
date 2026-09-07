---
name: redis
description: In-memory data structure store for caching, queues, sessions, and pub/sub; canonical entry for using Redis as cache or fast key-value store.
domain: stack
category: database
tags: [redis, cache, in-memory, key-value, pubsub]
official_sources:
  - https://redis.io/docs/latest/
  - https://github.com/redis/redis
verified: 2026-06-16
---

# Redis

## Overview
Redis is an in-memory data structure store used as a cache, key-value database, message broker, and data structure server. Read this as the canonical entry point when adding caching, session storage, rate limiting, queues, or pub/sub to an application.

## Official sources
- Docs: https://redis.io/docs/latest/
- Repo (official; tri-licensed RSALv2/SSPLv1/AGPLv3 for v8.0+): https://github.com/redis/redis
- Install guide: https://redis.io/docs/latest/operate/oss_and_stack/install/install-stack/

## Install / setup
Run via Docker (works on all platforms, per the official install docs):

```bash
docker run -d --name redis -p 6379:6379 redis
```

On Ubuntu/Debian via the official APT repository:

```bash
sudo apt-get install lsb-release curl gpg
curl -fsSL https://packages.redis.io/gpg | sudo gpg --dearmor -o /usr/share/keyrings/redis-archive-keyring.gpg
sudo chmod 644 /usr/share/keyrings/redis-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/redis-archive-keyring.gpg] https://packages.redis.io/deb $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/redis.list
sudo apt-get update
sudo apt-get install redis
```

## Core concepts
- In-memory storage: data lives in RAM for sub-millisecond access; persistence is optional.
- Rich data types: strings, lists, sets, sorted sets, hashes, streams, bitmaps, and more.
- Key expiration (TTL): set per-key expiry for caches and sessions.
- Persistence options: RDB snapshots and AOF (append-only file) for durability across restarts.
- Pub/Sub and Streams: messaging patterns for fan-out and durable, consumer-group-based queues.
- Atomic operations and transactions (`MULTI`/`EXEC`) plus server-side Lua scripting.

## Best practices
- Set TTLs on cache keys so memory is reclaimed; choose an eviction policy (e.g., `allkeys-lru`) appropriate to a cache.
- Use the right data type (e.g., sorted sets for leaderboards, streams for queues) rather than serializing blobs.
- Enable persistence (RDB and/or AOF) if you cannot tolerate losing data on restart; disable it for pure caches.
- Use pipelining or `MGET`/`MSET` to batch commands and cut round trips.
- Avoid large single keys and `O(N)` commands (e.g., `KEYS`) on production; use `SCAN` instead.

## Common pitfalls
- Treating Redis as a durable system of record without persistence/replication → data loss on restart or eviction.
- Running `KEYS *` in production → blocks the server; use `SCAN`.
- Storing huge values or huge collections in one key → memory spikes and slow operations.
- Forgetting eviction policy on a cache → out-of-memory errors when `maxmemory` is hit.

## Examples
```bash
# Cache a value for 60 seconds
SET session:abc "{...}" EX 60

# Leaderboard with a sorted set
ZADD scores 100 "ada"
ZREVRANGE scores 0 9 WITHSCORES
```

## Further reading
- Data types: https://redis.io/docs/latest/develop/data-types/
- Persistence: https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/

## Related skills
- ../mongodb — document database for primary storage
- ../postgresql — relational system of record to pair with a Redis cache
