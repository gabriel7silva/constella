---
name: software-architecture-patterns
description: Layered, hexagonal, event-driven, and microservices patterns plus cloud design patterns; read when choosing or structuring application architecture.
domain: engineering
category: architecture
tags: [architecture-patterns, microservices, event-driven, layered, cloud-patterns]
official_sources:
  - https://martinfowler.com/architecture/
  - https://learn.microsoft.com/azure/architecture/patterns/
verified: 2026-06-16
---

# Software Architecture Patterns

## Overview
Architecture patterns are reusable, named solutions to recurring structural problems — how to separate concerns, communicate between components, and contain failure. Each pattern solves one problem and introduces trade-offs, so choose by the problem you face, not the technology you want. Read this when structuring a new service or evaluating a refactor.

## Official sources
- Martin Fowler's Software Architecture Guide: https://martinfowler.com/architecture/
- Azure Architecture Center — Cloud Design Patterns catalog: https://learn.microsoft.com/azure/architecture/patterns/

## Core concepts
- **Layered (Presentation–Domain–Data)**: separate the UI, business logic, and data-access concerns so each can change independently; the dominant default for most applications.
- **Hexagonal / Ports & Adapters**: isolate the domain core behind explicit ports, with adapters for UI, persistence, and external systems, so infrastructure is swappable and the core is testable.
- **Event-driven architecture**: components communicate by emitting and reacting to events (often via Publisher-Subscriber), decoupling producers from consumers in time and identity.
- **Microservices**: develop a single application as a suite of small services, each in its own process, communicating over lightweight mechanisms — independently deployable but distributed.
- **Cloud design patterns**: technology-agnostic solutions (Circuit Breaker, Retry, Cache-Aside, CQRS, Saga, Bulkhead, Strangler Fig) that address reliability, scale, and integration in distributed systems.
- **Patterns are composable**: real workloads apply several together (e.g. Retry + Circuit Breaker; Queue-Based Load Leveling + Competing Consumers).

## Best practices
- Choose a pattern from the problem and acceptable trade-offs, not from the technology — the Azure catalog explicitly advises starting from a constraint or risk in the workload.
- Default to a well-structured monolith with clear layering; adopt microservices only when team/scale boundaries justify the distributed-systems cost.
- Pair resilience patterns: combine Retry with Circuit Breaker so transient faults are retried but persistent faults stop hammering a failing dependency.
- Use the Strangler Fig pattern to migrate legacy systems incrementally instead of a risky big-bang rewrite.

## Common pitfalls
- Adopting microservices for a small team or early product → you inherit network, consistency, and ops overhead without the scale benefit; keep a modular monolith until boundaries are clear.
- Believing distributed systems are reliable, low-latency, and infinitely scalable (the fallacies of distributed computing) → design compensations (timeouts, retries, idempotency) for each fallacy.
- Treating an antipattern as a pattern because it works at low load → re-evaluate designs that degrade as traffic grows.

## Examples
```text
Resilient remote call (Azure pattern combo):
  client -> [Retry with backoff] -> [Circuit Breaker] -> remote service
  - Retry handles transient faults.
  - Circuit Breaker opens after repeated failures, failing fast and shedding load.
```

## Further reading
- Azure pattern catalog with per-pattern problem/trade-off pages: https://learn.microsoft.com/azure/architecture/patterns/
- Fowler on microservices: https://martinfowler.com/articles/microservices.html

## Related skills
- ../message-queues-async — event-driven and async messaging foundations
- ../scalability-reliability — resilience patterns under load
- ../api-design-rest-graphql — designing the interfaces between services
