---
name: backend/backend-fundamentals
description: Core backend ideas — HTTP request/response, statelessness, layered architecture, and the twelve-factor app methodology for cloud services.
domain: engineering
category: engineering
tags: [backend, http, stateless, twelve-factor, architecture, web]
official_sources:
  - https://developer.mozilla.org/en-US/docs/Web/HTTP
  - https://12factor.net/
verified: 2026-06-16
---

# Backend Fundamentals

## Overview
This skill covers the foundations every backend service rests on: how HTTP works as a stateless request/response protocol, why statelessness matters for scaling, how to layer an application, and the twelve-factor methodology for building portable cloud services. Read it before designing an API or deployment, and as a checklist when a service is hard to scale or configure across environments.

## Official sources
- HTTP (MDN): https://developer.mozilla.org/en-US/docs/Web/HTTP
- The Twelve-Factor App: https://12factor.net/
- Repo (twelve-factor): https://github.com/heroku/12factor

## Core concepts
- **HTTP is a stateless, application-layer protocol.** Per MDN, the server "does not keep any session data between two requests"; state is layered on top via cookies, tokens, or external stores.
- **Request/response, client-server model.** A client opens a connection, sends a request (method + path + headers + optional body), and waits for a single response.
- **Methods and status codes carry semantics.** Methods (GET, POST, PUT, PATCH, DELETE, …) express intent; status codes group as 1xx informational, 2xx success, 3xx redirect, 4xx client error, 5xx server error.
- **Statelessness enables horizontal scale.** Twelve-factor says to "execute the app as one or more stateless processes" so any instance can serve any request and you scale by adding processes.
- **Config lives in the environment.** Store deploy-specific config (URLs, credentials, flags) in environment variables, not in code, keeping the codebase portable and secrets out of version control.
- **Layering.** Separate concerns into transport/routing, application/service logic, and data-access layers so each can change and be tested independently.
- **Twelve factors at a glance.** Codebase, dependencies, config, backing services, build/release/run, processes, port binding, concurrency, disposability, dev/prod parity, logs, admin processes.

## Best practices
- Keep request handling stateless; persist session/state in a backing service (DB, cache) rather than in process memory (twelve-factor: processes, backing services).
- Treat backing services (databases, queues, caches) as attached resources swappable via config, with no code change.
- Build, release, and run as distinct stages so a release is an immutable artifact + config you can roll back.
- Use the correct HTTP method and status code for each operation so caches, clients, and proxies behave correctly (MDN).

## Common pitfalls
- Storing session state in process memory → breaks under multiple instances; move it to a shared backing service.
- Hardcoding environment-specific config or secrets in code → read them from the environment (twelve-factor: config).
- Returning 200 for errors or overloading GET to mutate data → honor HTTP method and status-code semantics (MDN).

## Examples
```http
GET /api/users/42 HTTP/1.1
Host: api.example.com
Accept: application/json

HTTP/1.1 200 OK
Content-Type: application/json

{ "id": 42, "name": "Ada" }
```
```bash
# Twelve-factor: config from the environment, not the code
export DATABASE_URL="postgres://user:pass@host:5432/app"
```

## Further reading
- MDN HTTP overview: https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Overview
- Twelve-factor — full factor list: https://12factor.net/

## Related skills
- ./auth-and-authorization — securing the requests these services receive
- ./observability-logging — the "logs" factor and operating the service in production
