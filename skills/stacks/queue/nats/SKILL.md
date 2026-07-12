---
name: nats
description: Lightweight high-performance messaging system with pub/sub and JetStream persistence; consult for cloud-native, edge, and microservice messaging.
domain: stack
category: queue
tags: [nats, messaging, pubsub, jetstream, cloud-native, streaming]
official_sources:
  - https://docs.nats.io/
  - https://github.com/nats-io/nats-server
verified: 2026-06-16
---

# NATS

## Overview
NATS is a simple, secure, high-performance messaging system for cloud-native applications, edge devices, and microservices, and is a CNCF project. Core NATS provides fast at-most-once pub/sub and request-reply; the JetStream layer adds persistence, replay, and stronger delivery guarantees plus key/value and object stores. Read this when you want lightweight, low-latency messaging with optional durability without operating a heavier broker.

## Official sources
- Docs: https://docs.nats.io/
- Repo: https://github.com/nats-io/nats-server
- Install: https://docs.nats.io/running-a-nats-service/introduction/installation

## Install / setup
```bash
docker pull nats:latest
docker run -p 4222:4222 -ti nats:latest
```
```bash
# macOS (Homebrew)
brew install nats-server
```

## Core concepts
- **Subjects**: hierarchical, dot-delimited addresses (e.g. `orders.us.new`) that messages are published to and subscribed against, with `*` and `>` wildcards.
- **Publish / Subscribe**: many subscribers can receive messages on a subject; Core NATS delivery is at-most-once and fire-and-forget.
- **Request-Reply**: built-in RPC pattern where a publisher gets a direct reply on a temporary inbox subject.
- **Queue groups**: subscribers sharing a queue group load-balance messages so each message goes to one member — work-queue semantics over pub/sub.
- **JetStream**: the persistence engine adding streams, durable consumers, replay, and up to exactly-once delivery on top of Core NATS.
- **KV and Object stores**: higher-level abstractions built on JetStream for key/value and large-object storage.

## Best practices
- Design subject hierarchies intentionally and use wildcards for flexible subscriptions rather than hard-coding many concrete subjects.
- Use queue groups for scalable work distribution so adding subscribers spreads load automatically.
- Use JetStream (not Core NATS) whenever you need messages to survive subscriber downtime, replay, or acknowledgements.
- Run a clustered nats-server for high availability rather than a single node in production.

## Common pitfalls
- Expecting Core NATS to retain messages → it is at-most-once and drops messages with no active subscriber; use JetStream for persistence.
- Forgetting to ack JetStream messages → unacked messages are redelivered per the consumer's ack policy, causing duplicate processing.
- Overly broad `>` wildcard subscriptions → can flood a subscriber with far more traffic than intended.

## Examples
```bash
# subscribe to a subject (NATS CLI)
nats sub "orders.>"
# publish a message
nats pub orders.us.new '{"id":99}'
```

## Further reading
- https://docs.nats.io/nats-concepts/jetstream — JetStream persistence concepts
- https://docs.nats.io/nats-concepts/core-nats — Core NATS messaging patterns

## Related skills
- ../kafka — log-based streaming for very high-throughput, replay-heavy pipelines
- ../rabbitmq — broker with rich routing when you need protocol breadth and per-message acks
