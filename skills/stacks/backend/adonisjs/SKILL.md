---
name: adonisjs
description: TypeScript-first full-stack Node MVC framework with testing, ORM, and official packages; consult when building AdonisJS web apps or API servers.
domain: stack
category: backend
tags: [nodejs, typescript, adonisjs, mvc, web-framework]
official_sources:
  - https://docs.adonisjs.com/
  - https://github.com/adonisjs/core
verified: 2026-06-16
---

# AdonisJS

## Overview
AdonisJS is a TypeScript-first web framework for building web apps and API servers on Node.js. It ships a full-stack MVC structure with testing support, modern tooling, and an ecosystem of official packages, emphasizing ergonomics and speed. Read this when building or maintaining an AdonisJS backend.

## Official sources
- Docs: https://docs.adonisjs.com/
- Repo: https://github.com/adonisjs/core
- Install / download: https://docs.adonisjs.com/guides/getting-started/installation

## Install / setup
```bash
# Requires Node.js >= 24.x and npm >= 11.x
npm init adonisjs@latest [project-name]
```

## Core concepts
- IoC container & providers: services are registered via providers and resolved from a dependency-injection container.
- Routing & controllers: routes in `start/routes.ts` map URLs to controller methods; route groups apply shared prefixes and middleware.
- Middleware: composable request handlers run before route handlers for cross-cutting concerns (auth, body parsing).
- Lucid ORM: the official Active Record-style ORM with models, migrations, and query building.
- HttpContext: the per-request object (`ctx`) exposing request, response, and session passed to controllers.
- Config & environment: typed configuration and validated environment variables via the framework's config system.

## Best practices
- Use the official starter and ecosystem packages (auth, Lucid, validation) rather than ad-hoc libraries, since they integrate with the IoC container (https://docs.adonisjs.com/guides/getting-started/installation).
- Keep controllers thin and move logic into services resolved from the container.
- Use Lucid migrations for schema changes so databases stay reproducible.
- Validate request input with the built-in validator before using it.

## Common pitfalls
- Running on an unsupported Node version → the installer requires Node.js >= 24.x and npm >= 11.x; upgrade before installing.
- Bypassing the IoC container by instantiating services manually → register and resolve them so dependencies and lifecycles are managed.
- Skipping input validation → validate with the framework's validator instead of trusting raw request data.

## Examples
```ts
// start/routes.ts
import router from '@adonisjs/core/services/router'

router.get('/users/:id', async ({ params }) => {
  return { id: params.id }
})
```

## Further reading
- https://docs.adonisjs.com/guides/getting-started/installation — Installation
- https://docs.adonisjs.com/guides/basics/routing — Routing
- https://lucid.adonisjs.com/ — Lucid ORM

## Related skills
- ../laravel — the PHP framework AdonisJS's conventions are often compared to
- ../fiber — Express-lineage framework in Go
