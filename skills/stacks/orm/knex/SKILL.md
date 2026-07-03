---
name: knex
description: Flexible multi-dialect SQL query builder for Node.js with transactions, pooling, and migrations; consult when you want SQL control without a full ORM.
domain: stack
category: orm
tags: [query-builder, nodejs, sql, migrations, transactions, postgresql]
official_sources:
  - https://knexjs.org/
  - https://github.com/knex/knex
verified: 2026-06-16
---

# Knex.js

## Overview
Knex is a batteries-included, multi-dialect SQL query builder for Node.js supporting PostgreSQL, MySQL/MariaDB, SQLite3, MSSQL, CockroachDB, and Oracle. It builds SQL with a fluent, chainable API and adds transactions, connection pooling, streaming, and a migration/seed system. Read this when you want fine SQL control and portability without the abstraction of a full ORM.

## Official sources
- Docs: https://knexjs.org/
- Repo: https://github.com/knex/knex
- Install / guide: https://knexjs.org/guide/#node-js

## Install / setup
```bash
npm install knex --save
npm install pg
```

## Core concepts
- **Knex instance**: configured with a `client` (dialect) and `connection`; created once and reused.
- **Query builder**: chainable methods (`select`, `where`, `join`, `insert`, `update`, `del`) that compile to SQL.
- **Schema builder**: `knex.schema.createTable(...)` for DDL.
- **Migrations & seeds**: versioned schema changes and seed data run via the Knex CLI.
- **Transactions**: `knex.transaction(async trx => …)` for atomic multi-statement work.
- **Connection pooling**: built-in pool managed per Knex instance.

## Best practices
- Install only the driver for your database (e.g. `pg`, `mysql2`, `sqlite3`) as the install guide instructs.
- Create a single Knex instance and share it; each instance owns a connection pool.
- Use migrations for all schema changes and commit them to version control.
- Use parameterized builder methods (not string concatenation) to avoid SQL injection; use `knex.raw` with bindings when raw SQL is needed.

## Common pitfalls
- Creating multiple Knex instances → multiple pools that can exhaust database connections; reuse one instance.
- Interpolating user input into `knex.raw` strings → SQL injection; pass values as bindings (`?`) instead.

## Examples
```js
const knex = require('knex')({
  client: 'pg',
  connection: process.env.DATABASE_URL,
})

await knex('users').insert({ name: 'Ada' })
const users = await knex('users').where({ name: 'Ada' }).select('*')
```

## Further reading
- https://knexjs.org/guide/migrations.html — migrations
- https://knexjs.org/guide/query-builder.html — query builder reference

## Related skills
- ../drizzle — TS-first SQL ORM that also stays close to SQL
- ../sequelize — full ORM built atop query-builder concepts
