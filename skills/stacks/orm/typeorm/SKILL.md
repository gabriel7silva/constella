---
name: typeorm
description: Decorator-based TS/JS ORM supporting Active Record and Data Mapper patterns across many databases; consult for entity-driven Node.js data access.
domain: stack
category: orm
tags: [orm, typescript, nodejs, decorators, database, migrations]
official_sources:
  - https://typeorm.io/
  - https://github.com/typeorm/typeorm
verified: 2026-06-16
---

# TypeORM

## Overview
TypeORM is an ORM for TypeScript and JavaScript that runs on Node.js (and other platforms) and supports both the Active Record and Data Mapper patterns. You define entities as decorated classes, and TypeORM maps them to tables across PostgreSQL, MySQL/MariaDB, SQLite, SQL Server, Oracle, CockroachDB, MongoDB, and more. Read this when you prefer a class/decorator entity model influenced by Hibernate and Entity Framework.

## Official sources
- Docs: https://typeorm.io/
- Repo: https://github.com/typeorm/typeorm
- Install / getting started: https://typeorm.io/docs/getting-started/

## Install / setup
```bash
npm install typeorm
npm install reflect-metadata
npm install @types/node --save-dev
```

## Core concepts
- **Entities**: classes decorated with `@Entity()` whose properties (`@Column`, `@PrimaryGeneratedColumn`) map to table columns.
- **DataSource**: the connection/configuration object you initialize before running any queries.
- **Repositories & EntityManager**: APIs for CRUD on entities; the Data Mapper pattern.
- **Active Record vs Data Mapper**: choose entity methods (Active Record) or repositories (Data Mapper) per project style.
- **Relations & QueryBuilder**: `@OneToMany`/`@ManyToOne` etc. for associations; `createQueryBuilder` for complex SQL.
- **Migrations**: schema versioning generated and run via the TypeORM CLI.

## Best practices
- Import `reflect-metadata` once at app startup (a global location) as the docs require for decorators to work.
- Initialize a single `DataSource` and reuse it across the app rather than reconnecting per request.
- Prefer explicit migrations over `synchronize: true` in production to avoid unintended schema changes (per docs).
- Use `QueryBuilder` for complex queries and to control joins and selected columns.

## Common pitfalls
- Forgetting to import `reflect-metadata` or enable `experimentalDecorators`/`emitDecoratorMetadata` in tsconfig → decorators silently fail at runtime.
- Leaving `synchronize: true` on in production → can drop or alter columns unexpectedly; use migrations instead.

## Examples
```ts
import 'reflect-metadata'
import { Entity, PrimaryGeneratedColumn, Column, DataSource } from 'typeorm'

@Entity()
class User {
  @PrimaryGeneratedColumn() id!: number
  @Column() name!: string
}

const ds = new DataSource({ type: 'postgres', url: process.env.DB_URL, entities: [User] })
await ds.initialize()
await ds.getRepository(User).save({ name: 'Ada' })
```

## Further reading
- https://typeorm.io/docs/entity/entities/ — entity reference
- https://typeorm.io/docs/advanced-topics/migrations/ — migrations guide

## Related skills
- ../prisma — schema-DSL ORM alternative
- ../sequelize — mature JS/TS ORM alternative
