---
name: celery
description: Distributed task queue for Python that runs background jobs via a broker (Redis/RabbitMQ); consult for async tasks, scheduling, and worker fan-out.
domain: stack
category: queue
tags: [celery, python, task-queue, background-jobs, redis, rabbitmq]
official_sources:
  - https://docs.celeryq.dev/
  - https://github.com/celery/celery
verified: 2026-06-16
---

# Celery

## Overview
Celery is a distributed task queue for Python that distributes work across processes and machines using a message broker (commonly RabbitMQ or Redis). It runs background and scheduled jobs outside the request cycle and integrates with Django, Flask, and FastAPI. Read this when a Python service needs async tasks, periodic jobs, retries, or horizontal worker scaling.

## Official sources
- Docs: https://docs.celeryq.dev/
- Repo: https://github.com/celery/celery
- Install: https://docs.celeryq.dev/en/stable/getting-started/introduction.html#installation

## Install / setup
```bash
pip install -U Celery
```
Celery also needs a broker (e.g. RabbitMQ or Redis) running; install broker extras with bundles like `pip install "celery[redis]"`.

## Core concepts
- **Task**: a unit of work defined with the `@app.task` decorator; called asynchronously with `.delay()` / `.apply_async()`.
- **Broker**: the message transport (RabbitMQ, Redis, SQS) that carries tasks from producers to workers; required to run Celery.
- **Worker**: a process started with `celery -A <app> worker` that consumes and executes queued tasks.
- **Result backend**: optional store (Redis, DB, etc.) that holds task return values and state when you need to retrieve results.
- **Beat (scheduler)**: a separate process that sends scheduled/periodic tasks to the broker on a cron-like schedule.
- **Routing & queues**: tasks can be routed to named queues so workers can specialize and scale independently.

## Best practices
- Make tasks idempotent and keep them small/focused, since Celery may retry or redeliver work.
- Set explicit `acks_late` / time limits and retry policies so a crashed worker re-queues its task instead of losing it.
- Use a dedicated result backend only when you actually need results; otherwise disabling it reduces overhead.
- Run Celery Beat as a single instance to avoid duplicate scheduled-task dispatch, and route heavy tasks to dedicated queues/workers.

## Common pitfalls
- Calling a task function directly (`add(2, 2)`) instead of `add.delay(2, 2)` → it runs synchronously in-process and never reaches a worker.
- Forgetting to start a worker or broker → tasks queue (or fail to enqueue) and never execute.
- Passing large or non-serializable objects as task arguments → arguments must serialize through the broker; pass IDs and reload inside the task.

## Examples
```python
from celery import Celery

app = Celery('tasks', broker='pyamqp://guest@localhost//')

@app.task
def add(x, y):
    return x + y
```
```bash
celery -A tasks worker --loglevel=INFO
```

## Further reading
- https://docs.celeryq.dev/en/stable/getting-started/first-steps-with-celery.html — first steps tutorial
- https://docs.celeryq.dev/en/stable/userguide/periodic-tasks.html — periodic tasks with Beat

## Related skills
- ../redis — common Celery broker/result backend
- ../rabbitmq — default, fully-featured Celery broker
