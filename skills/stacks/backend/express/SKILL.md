---
name: express
description: Minimal, unopinionated, ubiquitous Node.js web framework with middleware and routing; consult for lightweight HTTP servers and APIs.
domain: stack
category: backend
tags: [express, nodejs, http, middleware, routing, backend]
official_sources:
  - https://expressjs.com/
  - https://github.com/expressjs/express
verified: 2026-06-16
---

# Express

## Overview
Express is a fast, unopinionated, minimalist web framework for Node.js. It provides a thin layer of routing and middleware over Node's HTTP server, leaving structure and architecture to the developer. Read this when you want a small, well-understood foundation for an HTTP server or API, or when working under a framework (like NestJS) that uses Express underneath.

## Official sources
- Docs: https://expressjs.com/
- Repo: https://github.com/expressjs/express
- Install: https://expressjs.com/en/starter/installing.html

## Install / setup
```bash
npm install express
```
The starter guide first creates a project with `mkdir myapp`, `cd myapp`, then `npm init`. (Source: https://expressjs.com/en/starter/installing.html)

## Core concepts
- **Application** — `express()` creates an app you configure with routes, middleware, and settings.
- **Middleware** — functions with the `(req, res, next)` signature that run in order; the backbone of Express (parsing, auth, logging).
- **Routing** — `app.get()`, `app.post()`, and `express.Router()` map HTTP methods + paths to handlers.
- **Request / Response** — `req` and `res` objects expose params, query, body, and response helpers (`res.json`, `res.status`, `res.send`).
- **Error-handling middleware** — special middleware with four args `(err, req, res, next)` catches errors.

## Best practices
- Order middleware deliberately; body parsers and auth must run before the routes that depend on them (https://expressjs.com/en/guide/using-middleware.html).
- Split routes into `express.Router()` modules for maintainability (https://expressjs.com/en/guide/routing.html).
- Define a single error-handling middleware last to centralize failures (https://expressjs.com/en/guide/error-handling.html).
- Follow the production best-practices guide (use a reverse proxy, set `NODE_ENV=production`, handle exceptions) (https://expressjs.com/en/advanced/best-practice-performance.html).

## Common pitfalls
- In Express 4, async handler rejections were not caught automatically; Express 5 now forwards rejected promises to the error handler, so verify which major version you target (https://expressjs.com/en/guide/migrating-5.html).
- Express 5 changed path matching: bare `*` wildcards must be named (e.g. `/*splat`) and several legacy methods/signatures were removed (`app.del`, `res.send(body, status)`); review the migration guide before upgrading (https://expressjs.com/en/guide/migrating-5.html).

## Examples
```javascript
const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('Hello World');
});

app.listen(3000);
```

## Further reading
- https://expressjs.com/en/guide/migrating-5.html — Express 4 → 5 migration
- https://expressjs.com/en/advanced/best-practice-security.html — security best practices

## Related skills
- ../fastify — higher-performance alternative
- ../koa — successor framework from the original Express team
- ../nestjs — opinionated framework built on Express by default
