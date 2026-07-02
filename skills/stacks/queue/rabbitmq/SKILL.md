---
name: rabbitmq
description: Multi-protocol message broker (AMQP/MQTT/STOMP) for reliable async messaging; consult when decoupling services with durable queues and routing.
domain: stack
category: queue
tags: [rabbitmq, message-broker, amqp, queue, messaging, pubsub]
official_sources:
  - https://www.rabbitmq.com/docs
  - https://github.com/rabbitmq/rabbitmq-server
verified: 2026-06-16
---

# RabbitMQ

## Overview
RabbitMQ is a feature-rich, multi-protocol messaging and streaming broker that decouples producers from consumers with durable queues and flexible routing. It speaks AMQP 0-9-1/1.0, MQTT, STOMP, and their WebSocket variants, making it a general-purpose broker for async workflows, task distribution, and event fan-out. Read this when services need reliable, acknowledged message delivery with routing logic rather than a simple in-memory list.

## Official sources
- Docs: https://www.rabbitmq.com/docs
- Repo: https://github.com/rabbitmq/rabbitmq-server
- Install / download: https://www.rabbitmq.com/docs/download

## Install / setup
```bash
docker run -it --rm --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:4-management
```
Port 5672 is AMQP; 15672 serves the management UI.

## Core concepts
- **Producer / Consumer**: producers publish messages; consumers subscribe and process them — they never communicate directly.
- **Exchange**: receives published messages and routes them to queues based on type (direct, topic, fanout, headers) and bindings.
- **Queue**: an ordered buffer that holds messages until a consumer acknowledges them; can be durable to survive broker restarts.
- **Binding + routing key**: rules connecting exchanges to queues; the routing key plus exchange type determines where a message lands.
- **Acknowledgements**: consumers ack messages after processing; unacked messages are redelivered if the consumer dies, ensuring at-least-once delivery.
- **Quorum queues**: the recommended replicated, durable queue type for data safety in clustered deployments.

## Best practices
- Use manual acknowledgements and only ack after successful processing so crashes trigger redelivery instead of message loss.
- Declare queues and exchanges as durable and publish persistent messages when you need them to survive a broker restart.
- Prefer quorum queues over classic mirrored queues for replicated, highly-available workloads (per RabbitMQ docs).
- Set prefetch (QoS) limits so a single consumer is not flooded with unacked messages and work spreads across consumers.

## Common pitfalls
- Auto-ack mode → messages are removed before processing completes, so a crash silently loses them; use manual ack.
- Non-durable queues / non-persistent messages → everything is lost on broker restart; mark both durable when persistence matters.
- Unbounded queues without consumers or limits → memory/disk pressure can trigger flow control and block publishers; monitor depth and apply limits.

## Examples
```python
import pika
conn = pika.BlockingConnection(pika.ConnectionParameters('localhost'))
ch = conn.channel()
ch.queue_declare(queue='tasks', durable=True)
ch.basic_publish(exchange='', routing_key='tasks', body='hello',
                 properties=pika.BasicProperties(delivery_mode=2))  # persistent
```

## Further reading
- https://www.rabbitmq.com/tutorials — official protocol/usage tutorials
- https://www.rabbitmq.com/docs/quorum-queues — quorum queue reference

## Related skills
- ../kafka — log-based streaming alternative for high-throughput event pipelines
- ../celery — Python task queue that commonly uses RabbitMQ as its broker
