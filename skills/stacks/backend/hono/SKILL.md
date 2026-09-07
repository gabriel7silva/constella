---
name: hono
description: Tiny, ultrafast Web-Standards web framework that runs on Cloudflare Workers, Deno, Bun, Node.js and edge; consult for edge/multi-runtime APIs.
domain: stack
category: backend
tags: [hono, edge, web-standards, cloudflare-workers, bun, deno, backend]
official_sources:
  - https://hono.dev/docs/
  - https://github.com/honojs/hono
verified: 2026-06-16
---

# Hono

## Overview
Hono is a small, simple, and ultrafast web framework built on Web Standards. The same code runs on any JavaScript runtime — Cloudflare Workers, Fastly Compute, Deno, Bun, Vercel, AWS Lambda, Lambda@Edge, and Node.js. Read this when targeting edge/serverless platforms or when you want one routing/middleware codebase portable across runtimes.

## Official sources
- Docs: https://hono.dev/docs/
- Repo: https://github.com/honojs/hono
- Getting started: https://hono.dev/docs/getting-started/basic

## Install / setup
```bash
npm create hono@latest my-app
```
(Source: https://hono.dev/docs/getting-started/basic)

## Core concepts
- **App instance** — `new Hono()` creates the router/app; `.get()`, `.post()`, etc. register routes.
- **Web Standards core** — built on the standard `Request`/`Response` and Fetch APIs, which is why it is runtime-portable.
- **Context (`c`)** — handlers receive a `Context` exposing `c.req`, `c.json()`, `c.text()`, env bindings, and helpers.
- **Middleware** — composable `async (c, next) => {}` functions; Hono ships built-in middleware (CORS, logger, JWT, etc.).
- **Presets / adapters** — import paths/presets (`hono`, `hono/tiny`, `hono/quick`) and runtime adapters tailor the router and serving for each platform.
- **RPC & typing** — routes can be typed end-to-end and shared with clients via the RPC feature.

## Best practices
- Pick the import preset that matches your workload (e.g. `hono/quick` for many cold starts) per the docs (https://hono.dev/docs/api/presets).
- Use the official middleware (CORS, logger, secure headers) instead of hand-rolling cross-cutting concerns (https://hono.dev/docs/middleware/builtin/cors).
- Use the runtime-specific starter template so the entrypoint and serving adapter match your target (https://hono.dev/docs/getting-started/basic).
- Return `Response`-compatible values from handlers via `c.json` / `c.text` rather than mutating shared state.

## Common pitfalls
- Assuming Node-only APIs (e.g. `fs`, raw `http`) work everywhere → on Workers/Deno/edge only Web Standard APIs are available; keep handlers runtime-agnostic.
- Forgetting a platform-specific entrypoint/adapter → each runtime has its own bootstrap (e.g. `@hono/node-server` for Node); follow the matching getting-started page (https://hono.dev/docs/getting-started/nodejs).

## Examples
```typescript
import { Hono } from 'hono';

const app = new Hono();

app.get('/', (c) => c.text('Hello Hono!'));

export default app;
```

## Further reading
- https://hono.dev/docs/api/presets — choosing presets per runtime
- https://hono.dev/docs/guides/rpc — typed RPC between server and client

## Related skills
- ../fastify — Node-focused performance framework
- ../express — minimal Node framework with a similar middleware model
