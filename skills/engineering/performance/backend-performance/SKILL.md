---
name: backend-performance
description: Design resilient, high-throughput backends — timeouts, retries with backoff, connection pooling, concurrency limits, and avoiding N+1 queries.
domain: engineering
category: performance
tags: [backend, concurrency, timeouts, retries, connection-pool, n+1, scalability]
official_sources:
  - https://aws.amazon.com/builders-library/
  - https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/
verified: 2026-06-16
---

# Backend Performance

## Overview
Backend performance is about sustaining throughput and low latency under real load and partial failure, not just making a single request fast. This skill covers concurrency control, connection management, retry/timeout discipline, and data-access patterns (especially the N+1 problem), grounded in the Amazon Builders' Library and SQL indexing literature. Read it when designing services that must stay responsive under contention or overload.

## Official sources
- Amazon Builders' Library (hub): https://aws.amazon.com/builders-library/
- Timeouts, retries, backoff with jitter: https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/
- Avoiding fallback in distributed systems: https://aws.amazon.com/builders-library/avoiding-fallback-in-distributed-systems/
- SQL indexing / N+1 background: https://use-the-index-luke.com/

## Core concepts
- **Timeouts bound waiting.** Every remote call needs a timeout; the Builders' Library recommends setting it from downstream latency metrics (e.g. a high percentile like p99.9) so legitimate slow requests are tolerated but stuck calls fail fast.
- **Retries are "selfish."** Per AWS, retries consume extra server resources and amplify load during overload; they help transient failures but can turn a brownout into an outage if applied blindly.
- **Exponential backoff with jitter.** Spacing retries exponentially and adding randomness prevents synchronized "retry storms" where all clients hammer a recovering service at once.
- **Connection pooling.** Reusing a bounded pool of connections (DB, HTTP) avoids per-request handshake cost and caps concurrency against downstreams; pool size is itself a concurrency limit.
- **Concurrency limits / load shedding.** Bounding in-flight work and shedding excess load keeps latency stable; unbounded concurrency causes queue buildup and cascading latency under load.
- **The N+1 query problem.** Fetching a list then issuing one query per item (1 + N) multiplies round-trips and table accesses; batch or join instead. use-the-index-luke explains how scattered per-row table access makes even indexed lookups slow.
- **Avoid fallbacks as the happy path.** AWS argues fallback code is rarely exercised, hard to test, and often amplifies failures; prefer strengthening the primary path and letting callers retry.

## Best practices
- **Set timeouts everywhere and tune from data.** Derive timeout values from observed downstream latency percentiles rather than guessing; a missing timeout is an unbounded resource leak.
- **Retry only transient/idempotent operations, with capped exponential backoff and jitter.** Add a retry budget/circuit breaker so retries cannot dominate traffic during incidents.
- **Bound concurrency explicitly.** Size connection pools and worker concurrency to the downstream's capacity; shed or queue with limits instead of accepting unbounded work.
- **Eliminate N+1 access.** Batch loads (join, `IN (...)`, or a dataloader) so a list view is O(1)–O(2) queries, not O(N); verify with query-count assertions in tests.
- **Make work cancelable and propagate deadlines.** Pass a deadline/cancellation token down the call chain so a client timeout actually stops downstream work.

## Common pitfalls
- **No timeout on a remote call** → one slow dependency exhausts threads/connections; always bound the wait and fail fast.
- **Naive immediate retries** → synchronized retry storms re-create the congestion that caused the failure; use exponential backoff with jitter and a retry budget.
- **Hidden N+1 from lazy ORM relations** → looping over a collection triggers a query per element; eager-load or batch and assert query counts.
- **Treating fallback paths as safe** → seldom-exercised fallbacks fail when finally triggered; per AWS, exercise them continuously or remove them and rely on retries.

## Examples
```python
# Capped exponential backoff with full jitter for an idempotent call
import random, time

def call_with_retry(do, *, attempts=5, base=0.05, cap=2.0, timeout=1.0):
    for attempt in range(attempts):
        try:
            return do(timeout=timeout)          # always bound the wait
        except TransientError:
            if attempt == attempts - 1:
                raise
            backoff = min(cap, base * 2 ** attempt)
            time.sleep(random.uniform(0, backoff))  # full jitter
```

## Further reading
- https://aws.amazon.com/builders-library/avoiding-fallback-in-distributed-systems/ — why fallbacks backfire
- https://aws.amazon.com/builders-library/ — operational excellence essays (load shedding, fairness, caching)
- ./reference.md — deeper patterns (loaded only when needed)

## Related skills
- ../database-query-optimization — fixing the queries behind N+1 and slow access
- ../profiling-and-benchmarking — locating the real bottleneck before tuning
