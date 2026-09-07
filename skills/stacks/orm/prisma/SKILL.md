---
name: prisma
description: Type-safe TS/JS ORM with a declarative schema DSL, auto-generated client, and migrations; consult when modeling data in Node.js.
domain: stack
category: orm
tags: [orm, typescript, nodejs, database, migrations, postgresql]
official_sources:
  - https://www.prisma.io/docs
  - https://github.com/prisma/prisma
verified: 2026-06-16
---

# Prisma ORM

## Overview
Prisma is a next-generation ORM for Node.js and TypeScript. You declare your data model in a single `schema.prisma` file using its schema DSL, then Prisma generates a fully type-safe query client and manages SQL migrations. Read this when you need ergonomic, type-checked database access against PostgreSQL, MySQL, MariaDB, SQL Server, SQLite, MongoDB, or CockroachDB.

## Official sources
- Docs: https://www.prisma.io/docs
- Repo: https://github.com/prisma/prisma
- Install / quickstart: https://www.prisma.io/docs/getting-started/quickstart

## Install / setup
```bash
npm install prisma @types/pg --save-dev
npm install @prisma/client @prisma/adapter-pg pg dotenv
npx prisma init --output ../generated/prisma
```

## Core concepts
- **Prisma schema (`schema.prisma`)**: the single source of truth — declares the datasource, generator, and `model` definitions in Prisma's DSL.
- **Prisma Client**: an auto-generated, type-safe query builder; regenerate it with `npx prisma generate` after schema changes.
- **Prisma Migrate**: turns schema changes into SQL migration files via `npx prisma migrate dev`.
- **Models, fields, and relations**: each `model` maps to a table; relation fields and `@relation` express foreign keys.
- **Prisma Studio**: a GUI to browse and edit data, launched with `npx prisma studio`.

## Best practices
- Keep the schema as the source of truth and commit migration files; use `migrate dev` in development and `migrate deploy` in production (per Prisma docs).
- Run `prisma generate` whenever the schema changes so the client's types stay in sync.
- Instantiate a single `PrismaClient` and reuse it; avoid creating many instances which exhausts the connection pool.
- Use `select`/`include` to fetch only needed fields and relations rather than over-fetching.

## Common pitfalls
- Instantiating `PrismaClient` per request (common in serverless/hot-reload) → exhausts connections; use a shared singleton.
- Forgetting to run `prisma generate` after editing the schema → stale types and runtime mismatches; regenerate after every change.

## Examples
```ts
import { PrismaClient } from './generated/prisma'
const prisma = new PrismaClient()

const user = await prisma.user.create({
  data: { email: 'a@example.com', name: 'Ada' },
})
const users = await prisma.user.findMany({ where: { name: 'Ada' } })
```

## Further reading
- https://www.prisma.io/docs/orm/prisma-schema — Prisma schema reference
- https://www.prisma.io/docs/orm/prisma-migrate — Prisma Migrate guide

## Related skills
- ../drizzle — lighter-weight TypeScript SQL ORM alternative
- ../typeorm — decorator-based TS/JS ORM alternative
