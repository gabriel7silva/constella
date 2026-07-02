---
name: message-queues-async
description: Async messaging with queues and logs — delivery guarantees, ordering, and idempotency (Kafka, RabbitMQ); read before decoupling services.
domain: engineering
category: architecture
tags: [messaging, queues, kafka, rabbitmq, idempotency]
official_sources:
  - https://kafka.apache.org/documentation/
  - https://www.rabbitmq.com/tutorials
verified: 2026-06-16
---

# Message Queues & Async Messaging

## Overview
Asynchronous messaging decouples producers from consumers in time and identity, smoothing load spikes and improving resilience. Apache Kafka is a partitioned, replayable log; RabbitMQ is a broker built around queues and exchanges. Both force you to reason about delivery guarantees, ordering, and idempotency. Read this before introducing a queue or event bus between services.

## Official sources
- Apache Kafka — Documentation (concepts, design, delivery semantics): https://kafka.apache.org/documentation/
- RabbitMQ — Tutorials (queues, exchanges, work queues, pub/sub): https://www.rabbitmq.com/tutorials

## Core concepts
- **Kafka topics and partitions**: messages are published to topics split into partitions; ordering is guaranteed only within a single partition, and consumers track position via offsets.
- **Kafka consumer groups**: a consumer group acts as one logical subscriber across multiple processes; any number of groups can consume the same topic without duplicating data.
- **Delivery semantics**: systems offer at-most-once (may lose, never redelivers), at-least-once (never loses, may redeliver), or exactly-once. Kafka guarantees at-least-once by default.
- **Kafka exactly-once**: from Kafka 0.11 the idempotent producer prevents retry-induced duplicates, and transactions with read-committed consumers enable exactly-once across read-process-write.
- **RabbitMQ exchanges and routing**: producers publish to exchanges that route to queues by binding/routing keys, enabling work queues, publish/subscribe, routing, and topic patterns.
- **Acknowledgements and confirms**: consumer acks and publisher confirms underpin reliable delivery — a message is only considered handled once acknowledged.

## Best practices
- Make consumers idempotent: because at-least-once delivery can redeliver messages, design handlers so processing the same message twice has no extra effect.
- Use Kafka partition keys deliberately when you need per-key ordering, since ordering holds only within a partition.
- Acknowledge after successful processing (manual acks / publisher confirms), not on receipt, so failures lead to redelivery rather than loss.
- Reserve exactly-once for when you truly need it (Kafka transactions/idempotent producer); it adds overhead and is not always necessary if consumers are idempotent.

## Common pitfalls
- Assuming global ordering across a Kafka topic → ordering is per-partition only; key related messages to the same partition if order matters.
- Acking a message before the work succeeds → message is lost on crash; ack only after the side effects are durable.
- Ignoring duplicate delivery under at-least-once → double charges/sends; dedupe with idempotency keys or upserts.

## Examples
```text
Idempotent consumer under at-least-once delivery:
  on message m with key m.id:
    if processed_ids.contains(m.id): ack(m); return   # dedupe
    do_work(m)
    processed_ids.add(m.id)
    ack(m)                                             # ack after success
```

## Further reading
- Kafka design — message delivery semantics: https://kafka.apache.org/documentation/#semantics
- RabbitMQ publisher confirms tutorial: https://www.rabbitmq.com/tutorials/tutorial-seven-java

## Related skills
- ../software-architecture-patterns — event-driven architecture and queue patterns
- ../scalability-reliability — queues for load leveling and resilience
- ../system-design-fundamentals — throughput and partitioning trade-offs
