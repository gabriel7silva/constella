---
name: system-design-fundamentals
description: Latency, throughput, partitioning, replication, CAP and consistency trade-offs for designing large-scale systems; read before sizing or scaling.
domain: engineering
category: architecture
tags: [system-design, scalability, cap-theorem, distributed-systems, trade-offs]
official_sources:
  - https://github.com/donnemartin/system-design-primer
  - https://aws.amazon.com/architecture/well-architected/
verified: 2026-06-16
---

# System Design Fundamentals

## Overview
System design is the practice of reasoning about how a large-scale system meets functional and non-functional requirements (latency, throughput, availability, cost) under failure. Every choice is a trade-off: there is no single "correct" design, only one that is appropriate for the constraints. Read this before sizing a component, choosing a datastore, or proposing a scaling strategy.

## Official sources
- The System Design Primer (concepts, trade-offs, interview material): https://github.com/donnemartin/system-design-primer
- AWS Well-Architected Framework (pillars and review methodology): https://aws.amazon.com/architecture/well-architected/

## Core concepts
- **Latency vs throughput**: latency is the time to perform one action; throughput is the number of actions per unit of time. Aim for maximal throughput within an acceptable latency budget — they are not the same dial.
- **CAP theorem**: in a distributed system that may experience network partitions you must trade off between consistency and availability; you cannot fully guarantee all three of consistency, availability, and partition tolerance at once.
- **Partitioning / sharding**: split data across nodes so each holds only a subset, improving capacity and performance, at the cost of cross-shard queries, rebalancing, and possible hotspots/skew.
- **Replication and availability patterns**: copy data across nodes for read scaling and fault tolerance; fail-over comes in active-passive and active-active flavors, each trading complexity for recovery speed.
- **Consistency models**: strong, eventual, and causal consistency offer different guarantees; eventual consistency buys availability and scale but requires the application to tolerate stale reads.
- **Well-Architected pillars**: AWS frames sound design around Operational Excellence, Security, Reliability, Performance Efficiency, Cost Optimization, and Sustainability — use them as a review checklist.

## Best practices
- Quantify requirements first (expected QPS, data size, read/write ratio, latency SLO) before choosing technology — the numbers drive the design, per the System Design Primer's estimation approach.
- Make trade-offs explicit and document them; the Well-Architected method is a structured review against the six pillars, not a single answer.
- Design for failure: assume nodes, networks, and dependencies will fail and add replication, retries, and graceful degradation accordingly.
- Prefer horizontal scaling and statelessness for the request path so you can add commodity capacity rather than relying on a single large machine.

## Common pitfalls
- Treating CAP as "pick any two freely" → during a partition you are really choosing between consistency and availability; partition tolerance is mandatory in real distributed systems.
- Sharding on a key with skewed access → creates hotspots; choose a partition key with even distribution and plan for resharding.
- Optimizing latency while ignoring throughput (or vice versa) → measure both and set explicit targets.

## Examples
```text
Back-of-envelope sizing (per System Design Primer estimation):
  10M daily active users x 10 requests/day = 100M req/day
  100M / 86,400 s  ≈ 1,160 req/s average, ~3-5x peak ≈ ~5,000 req/s
  Plan capacity, caching, and partitions against peak, not average.
```

## Further reading
- AWS Well-Architected pillars overview: https://aws.amazon.com/architecture/well-architected/
- System Design Primer index of topics: https://github.com/donnemartin/system-design-primer#index-of-system-design-topics

## Related skills
- ../scalability-reliability — SLOs, resilience, and failure handling at scale
- ../caching-strategies — reduce latency and load with cache layers
- ../data-modeling — how data shape interacts with partitioning
