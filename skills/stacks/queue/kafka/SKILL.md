---
name: kafka
description: Distributed event streaming platform with durable, replayable logs; consult for high-throughput data pipelines, event sourcing, and stream processing.
domain: stack
category: queue
tags: [kafka, streaming, events, log, pubsub, distributed]
official_sources:
  - https://kafka.apache.org/documentation/
  - https://github.com/apache/kafka
verified: 2026-06-16
---

# Apache Kafka

## Overview
Apache Kafka is an open-source distributed event streaming platform used for high-performance data pipelines, streaming analytics, data integration, and mission-critical applications. Unlike a traditional broker, Kafka stores events in durable, partitioned, append-only logs that consumers replay at their own offset. Read this when you need high-throughput event ingestion, event sourcing, or stream processing across many consumers.

## Official sources
- Docs: https://kafka.apache.org/documentation/
- Repo: https://github.com/apache/kafka
- Install / quickstart: https://kafka.apache.org/quickstart

## Install / setup
```bash
tar -xzf kafka_2.13-4.3.0.tgz
cd kafka_2.13-4.3.0
KAFKA_CLUSTER_ID="$(bin/kafka-storage.sh random-uuid)"
bin/kafka-storage.sh format --standalone -t $KAFKA_CLUSTER_ID -c config/server.properties
bin/kafka-server-start.sh config/server.properties
```

## Core concepts
- **Topic**: a named, append-only log of events that producers write to and consumers read from.
- **Partition**: topics are split into partitions for parallelism and ordering; order is guaranteed only within a partition.
- **Offset**: each consumer tracks its position (offset) per partition, so events can be replayed and consumers progress independently.
- **Producer / Consumer**: producers publish records (optionally keyed for partition routing); consumers read them.
- **Consumer group**: consumers in a group share partitions so each partition is processed by exactly one member, enabling horizontal scaling.
- **Retention + replication**: events are retained for a configured time/size (not deleted on read) and replicated across brokers for durability.
- **KRaft**: modern Kafka manages metadata internally via KRaft, removing the legacy ZooKeeper dependency.

## Best practices
- Choose partition counts up front based on target throughput and consumer parallelism — it dictates how many consumers can work in parallel.
- Use a meaningful record key when ordering per entity matters, since all records with the same key land in the same partition.
- Set retention deliberately; Kafka keeps events until retention expires, so consumers can replay and recover from offsets.
- Run with replication (replication factor >= 3 in production) so partition leaders can fail over without data loss.

## Common pitfalls
- Treating Kafka like a queue where reading deletes the message → it does not; messages persist per retention and consumers advance offsets instead.
- Expecting global ordering across a topic → ordering holds only within a partition; cross-partition order is not guaranteed.
- Adding too many or too few partitions → too few caps parallelism; too many strains the cluster. Size them to throughput needs.

## Examples
```bash
# produce events to a topic
bin/kafka-console-producer.sh --topic quickstart-events --bootstrap-server localhost:9092
# consume from the beginning
bin/kafka-console-consumer.sh --topic quickstart-events --from-beginning --bootstrap-server localhost:9092
```

## Further reading
- https://kafka.apache.org/documentation/#design — design and storage internals
- https://kafka.apache.org/documentation/streams/ — Kafka Streams processing library

## Related skills
- ../rabbitmq — broker-style alternative when you need routing and per-message acks
- ../nats — lighter-weight streaming/messaging system (JetStream) for similar use cases
