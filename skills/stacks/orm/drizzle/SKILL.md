---
name: drizzle
description: Lightweight, headless TypeScript-first SQL ORM with zero dependencies and SQL-like queries; consult for type-safe SQL in Node/edge runtimes.
domain: stack
category: orm
tags: [orm, typescript, nodejs, sql, serverless, postgresql]
official_sources:
  - https://orm.drizzle.team/docs/overview
  - https://github.com/drizzle-team/drizzle-orm
verified: 2026-06-16
---

# Drizzle ORM

## Overview
Drizzle is a headless, TypeScript-first ORM that stays close to SQL: you describe tables in TypeScript and write queries with a SQL-like fluent API. It is lightweight (~7.4kb minified+gzipped), tree-shakeable, and ships with zero dependencies, making it well suited to serverless and edge runtimes (Bun, Deno, Cloudflare Workers). Read this when you want type safety without a heavy abstraction layer over SQL.

## Official sources
- Docs: https://orm.drizzle.team/docs/overview
- Repo: https://github.com/drizzle-team/drizzle-orm
- Install / get started: https://orm.drizzle.team/docs/get-started

## Install / setup
```bash
npm i drizzle-orm pg
npm i -D drizzle-kit @types/pg
```

## Core concepts
- **Schema in TypeScript**: tables/columns are declared with helpers like `pgTable`, giving full inference for queries.
- **Two query styles**: a SQL-like query builder (`select().from()...`) and a relational queries API for ergonomic nested reads.
- **drizzle-kit**: the companion CLI for generating and applying migrations from your TS schema.
- **Driver-agnostic**: connect via the appropriate driver (node-postgres, postgres.js, MySQL, SQLite/libSQL, etc.).
- **Headless / no codegen runtime**: types come from your schema declarations, not a generated client.

## Best practices
- Define schema in dedicated files and import them where queries run so types stay inferred end to end.
- Use `drizzle-kit generate` to produce migration SQL and apply it with `drizzle-kit migrate` (per Drizzle docs) rather than hand-editing tables.
- Pick the query API to match the task: the query builder for explicit SQL, relational queries for nested fetches.
- Pin and review generated migrations in version control before applying to production.

## Common pitfalls
- Expecting Prisma-style automatic client generation → Drizzle is headless; types derive from your schema declarations, so keep schema imports accurate.
- Mixing incompatible driver and dialect (e.g. a `pg` driver with a MySQL schema) → choose the driver/dialect pair the docs specify for your database.

## Examples
```ts
import { drizzle } from 'drizzle-orm/node-postgres'
import { pgTable, serial, text } from 'drizzle-orm/pg-core'
import { eq } from 'drizzle-orm'

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name'),
})

const db = drizzle(process.env.DATABASE_URL!)
const ada = await db.select().from(users).where(eq(users.name, 'Ada'))
```

## Further reading
- https://orm.drizzle.team/docs/migrations — migrations with drizzle-kit
- https://orm.drizzle.team/docs/rqb — relational queries API

## Related skills
- ../prisma — schema-DSL ORM with codegen alternative
- ../knex — lower-level SQL query builder
