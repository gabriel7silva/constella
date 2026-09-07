---
name: nestjs
description: Opinionated TypeScript backend framework with DI, modules, and decorators; consult when building structured Node server-side apps.
domain: stack
category: backend
tags: [nestjs, nodejs, typescript, dependency-injection, backend]
official_sources:
  - https://docs.nestjs.com/
  - https://github.com/nestjs/nest
verified: 2026-06-16
---

# NestJS

## Overview
NestJS is a progressive Node.js framework for building efficient, scalable, enterprise-grade server-side applications with TypeScript. It layers an opinionated architecture (modules, providers, dependency injection, decorators) on top of an HTTP platform (Express by default, optionally Fastify). Read this when you need a structured, testable backend with first-class DI rather than wiring middleware by hand.

## Official sources
- Docs: https://docs.nestjs.com/
- Repo: https://github.com/nestjs/nest
- Install / first steps: https://docs.nestjs.com/first-steps

## Install / setup
```bash
npm i -g @nestjs/cli
nest new project-name
```
The CLI can also be run without a global install via `npx @nestjs/cli@latest`. Add `--strict` to `nest new` for TypeScript's stricter feature set. (Source: https://docs.nestjs.com/first-steps)

## Core concepts
- **Modules** — each app has a root module; modules group related providers and controllers and define the dependency boundary via `@Module({})`.
- **Controllers** — handle incoming requests and return responses; routing is declared with decorators like `@Controller()` and `@Get()`.
- **Providers / services** — injectable classes (`@Injectable()`) holding business logic, resolved by Nest's DI container.
- **Dependency injection** — constructor-based injection wires providers together; the container manages instantiation and scope.
- **Pipes, guards, interceptors, filters** — cross-cutting building blocks for validation/transformation, authorization, request/response wrapping, and exception handling.
- **Platform-agnostic core** — the same code runs on `@nestjs/platform-express` or `@nestjs/platform-fastify`.

## Best practices
- Keep one feature per module and export only what other modules need, so the DI graph stays explicit (https://docs.nestjs.com/modules).
- Use Pipes (e.g. the built-in `ValidationPipe` with class-validator) to validate and transform incoming payloads at the boundary (https://docs.nestjs.com/techniques/validation).
- Centralize error handling with exception filters rather than try/catch in every controller (https://docs.nestjs.com/exception-filters).
- Lean on the CLI (`nest generate`) to scaffold modules/controllers/services consistently.

## Common pitfalls
- Forgetting to register a provider in a module's `providers` (or import its module) → "Nest can't resolve dependencies" error; declare and export providers explicitly.
- Treating default request-scoped vs singleton lifetimes interchangeably → request-scoped providers add per-request overhead; default to singleton scope unless you truly need per-request state (https://docs.nestjs.com/fundamentals/injection-scopes).

## Examples
```typescript
import { Module, Controller, Get } from '@nestjs/common';

@Controller('cats')
export class CatsController {
  @Get()
  findAll(): string {
    return 'This action returns all cats';
  }
}

@Module({ controllers: [CatsController] })
export class AppModule {}
```

## Further reading
- https://docs.nestjs.com/fundamentals/custom-providers — advanced DI patterns
- https://docs.nestjs.com/cli/overview — CLI reference

## Related skills
- ../express — the default underlying HTTP platform
- ../fastify — alternative high-performance platform adapter
