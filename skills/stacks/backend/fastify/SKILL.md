---
name: fastify
description: Fast, low-overhead Node.js HTTP framework with schema validation and a plugin/encapsulation model; consult for performant APIs.
domain: stack
category: backend
tags: [fastify, nodejs, http, plugins, json-schema, backend]
official_sources:
  - https://fastify.dev/docs/latest/
  - https://github.com/fastify/fastify
verified: 2026-06-16
---

# Fastify

## Overview
Fastify is a fast, low-overhead web framework for Node.js focused on serving the highest number of requests possible without sacrificing security validation or developer experience. It is built around a plugin architecture, hooks, and JSON-Schema-based validation and serialization. Read this when building performance-sensitive HTTP APIs that benefit from schema-driven request handling.

## Official sources
- Docs: https://fastify.dev/docs/latest/
- Repo: https://github.com/fastify/fastify
- Getting started: https://fastify.dev/docs/latest/Guides/Getting-Started/

## Install / setup
```bash
npm i fastify
```
(Source: https://fastify.dev/docs/latest/Guides/Getting-Started/)

## Core concepts
- **Instance & lifecycle** — `fastify()` creates a server; routes and plugins register against it before `listen()`.
- **Plugins** — almost everything is a plugin registered with `fastify.register()`; plugins encapsulate routes, decorators, and hooks.
- **Encapsulation** — each plugin gets its own context that inherits from parents but is isolated from siblings; use the `fastify-plugin` wrapper to deliberately expose a plugin's decorators/hooks to the parent scope (https://fastify.dev/docs/latest/Reference/Encapsulation/).
- **JSON Schema validation & serialization** — attach a `schema` to a route to validate input and fast-serialize output.
- **Hooks** — lifecycle hooks (`onRequest`, `preHandler`, `onSend`, etc.) run code at defined request phases.
- **Decorators** — extend `fastify`, `request`, and `reply` with custom properties/methods.

## Best practices
- Define route schemas for body/querystring/params and responses to get validation plus faster serialization (https://fastify.dev/docs/latest/Guides/Getting-Started/).
- Prefer `async/await` handlers; returning a value sends the response, and thrown errors are routed to the error handler.
- Encapsulate features as plugins and only break encapsulation with `fastify-plugin` when sharing is intentional (https://fastify.dev/docs/latest/Reference/Plugins/).
- Register plugins and await readiness before calling `listen()` so the plugin tree is fully booted.

## Common pitfalls
- Mixing `async` handlers with manual `reply.send()` and also returning a value → causes "reply already sent"; in async handlers, return the payload OR call `reply.send`, not both (https://fastify.dev/docs/latest/Reference/Routes/).
- Expecting a decorator/hook registered inside a child plugin to be visible to parents → it isn't, due to encapsulation; wrap with `fastify-plugin` to expose it upward.

## Examples
```javascript
import Fastify from 'fastify';

const fastify = Fastify({ logger: true });

fastify.get('/', async () => ({ hello: 'world' }));

await fastify.listen({ port: 3000 });
```

## Further reading
- https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/ — schema deep dive
- https://fastify.dev/docs/latest/Reference/Hooks/ — hook reference

## Related skills
- ../express — the minimal framework Fastify positions against on performance
- ../nestjs — can run on a Fastify platform adapter
