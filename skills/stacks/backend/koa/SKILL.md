---
name: koa
description: Expressive, minimal middleware framework for Node.js from the Express team, built on async/await; consult for lean, composable HTTP servers.
domain: stack
category: backend
tags: [koa, nodejs, middleware, async-await, http, backend]
official_sources:
  - https://koajs.com/
  - https://github.com/koajs/koa
verified: 2026-06-16
---

# Koa

## Overview
Koa is an expressive HTTP middleware framework for Node.js, created by the team behind Express, designed to make web applications and APIs more enjoyable to write. It has a small core (no bundled middleware) and uses `async`/`await` with a cascading middleware model and a unified `ctx` object. Read this when you want a minimal, modern foundation and prefer composing middleware explicitly.

## Official sources
- Docs: https://koajs.com/
- Repo: https://github.com/koajs/koa

## Install / setup
```bash
npm i koa
```
Koa requires node v18.0.0 or higher for ES2015 and async function support. (Source: https://koajs.com/)

## Core concepts
- **Application** — `new Koa()` creates an app; `app.use()` adds middleware; `app.listen()` starts the server.
- **Cascading middleware** — middleware are `async (ctx, next) => {}`; calling `await next()` runs downstream middleware, then control flows back upstream ("cascade").
- **Context (`ctx`)** — a single object per request that wraps and delegates to `ctx.request` and `ctx.response` (e.g. `ctx.body`, `ctx.status`).
- **Request / Response abstractions** — Koa's own objects sit on top of Node's, adding helpful accessors.
- **No bundled middleware** — routing, body parsing, etc. come from separate packages (e.g. `@koa/router`, `koa-bodyparser`).

## Best practices
- Set the response with `ctx.body` / `ctx.status` rather than calling Node's `res` directly, so Koa handles serialization correctly (https://koajs.com/#response).
- Use `try/catch` around `await next()` in an upstream middleware to centralize error handling (https://koajs.com/#error-handling).
- Keep middleware focused and order them deliberately, since the cascade depends on registration order.
- Add only the middleware packages you need (router, body parser, CORS) to keep the core minimal.

## Common pitfalls
- Forgetting to `await next()` (or returning before it) → downstream middleware never runs and the cascade breaks; always await the chain.
- Treating Koa like Express (e.g. expecting built-in routing/body parsing or the `(req, res, next)` signature) → Koa uses `ctx` and bundles no middleware; install the equivalents explicitly.

## Examples
```javascript
const Koa = require('koa');
const app = new Koa();

app.use(async (ctx) => {
  ctx.body = 'Hello World';
});

app.listen(3000);
```

## Further reading
- https://koajs.com/#error-handling — error handling patterns
- https://github.com/koajs/koa/blob/master/docs/guide.md — official guide

## Related skills
- ../express — predecessor framework from the same team
- ../fastify — higher-performance Node alternative
