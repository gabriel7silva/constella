---
name: bullmq
description: Redis-backed distributed job queue for Node.js; consult when adding background jobs, retries, delays, or scheduled work to a Node service.
domain: stack
category: queue
tags: [bullmq, queue, jobs, nodejs, redis, background-jobs]
official_sources:
  - https://docs.bullmq.io/
  - https://github.com/taskforcesh/bullmq
verified: 2026-06-16
---

# BullMQ

## Overview
BullMQ is a fast, Redis-backed distributed queue for Node.js (with Python, Rust, and other ports) used to offload work to background workers: emails, image processing, webhooks, scheduled jobs. It provides retries, delays, priorities, rate limiting, and parent-child job dependencies with atomic, Lua-backed operations. Read this when a Node service needs reliable background processing instead of doing work inside the request cycle.

## Official sources
- Docs: https://docs.bullmq.io/
- Repo: https://github.com/taskforcesh/bullmq
- Install / quick start: https://docs.bullmq.io/readme-1

## Install / setup
```bash
npm install bullmq
```
Requires a running Redis instance (the examples assume a local Redis on `localhost:6379`).

## Core concepts
- **Queue**: a named queue you add jobs to (`new Queue('foo')`); producers enqueue, consumers process independently.
- **Worker**: a process that pulls jobs from a queue and runs a processor function; multiple workers scale horizontally across the same queue.
- **Job**: a unit of work with data and options (attempts, backoff, delay, priority); BullMQ tracks its lifecycle (waiting, active, completed, failed).
- **Connection**: BullMQ talks to Redis via ioredis; workers require `maxRetriesPerRequest: null` on the connection.
- **Flows (parent-child)**: jobs can depend on child jobs and only run after children complete, enabling fan-out/fan-in pipelines.
- **QueueEvents**: a separate listener stream for observing job state changes (completed, failed, progress) across processes.

## Best practices
- Make job processors idempotent — BullMQ targets reliable delivery, and retries/replays mean the same job may run more than once.
- Configure `attempts` and `backoff` per job so transient failures retry with exponential delay instead of failing permanently.
- Reuse a single Redis connection (ioredis instance) across queues/workers where appropriate rather than opening one per object.
- Run dedicated worker processes separate from your web/API process so heavy jobs do not compete with request handling.

## Common pitfalls
- Creating the Worker connection without `maxRetriesPerRequest: null` → BullMQ requires this and will warn/error otherwise.
- Doing long blocking work in a processor without concurrency or rate limits → set worker `concurrency` and rate limiting to control throughput against downstream systems.
- Assuming jobs run in the web process → without a separate Worker actually consuming the queue, jobs sit in "waiting" forever.

## Examples
```typescript
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis({ maxRetriesPerRequest: null });

const myQueue = new Queue('foo', { connection });
await myQueue.add('myJobName', { foo: 'bar' }, { attempts: 3, backoff: 5000 });

new Worker('foo', async job => {
  console.log(job.data);
}, { connection });
```

## Further reading
- https://docs.bullmq.io/guide/workers — workers, concurrency, rate limiting
- https://docs.bullmq.io/guide/flows — parent-child job flows

## Related skills
- ../redis — the data store BullMQ runs on; understand TTLs and persistence
- ../celery — equivalent task-queue pattern for Python services
