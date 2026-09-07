---
name: sequelize
description: Mature promise-based JS/TS ORM for SQL databases with models, associations, and transactions; consult for established Node.js relational data access.
domain: stack
category: orm
tags: [orm, nodejs, javascript, typescript, sql, transactions]
official_sources:
  - https://sequelize.org/docs/v6/
  - https://github.com/sequelize/sequelize
verified: 2026-06-16
---

# Sequelize

## Overview
Sequelize is a mature, promise-based ORM for Node.js that targets SQL databases including PostgreSQL, MySQL, MariaDB, SQLite, and SQL Server. It provides model definitions, associations, eager/lazy loading, transactions, and read replication. Read this when working in an established JavaScript/TypeScript codebase that uses Sequelize or when you want a battle-tested relational ORM.

## Official sources
- Docs: https://sequelize.org/docs/v6/
- Repo: https://github.com/sequelize/sequelize
- Install / getting started: https://sequelize.org/docs/v6/getting-started/

## Install / setup
```bash
npm install --save sequelize
```

## Core concepts
- **Sequelize instance**: the connection object created with a connection URI or options, plus the chosen dialect driver.
- **Models**: defined via `sequelize.define()` or by extending `Model`; map to tables with typed attributes.
- **Associations**: `hasOne`, `hasMany`, `belongsTo`, `belongsToMany` express relationships and generate helper methods.
- **Querying**: finder methods (`findAll`, `findOne`, `findByPk`) with `where` operators and `include` for eager loading.
- **Transactions**: managed (`sequelize.transaction(async t => …)`) or unmanaged, for atomic multi-statement work.
- **Migrations & seeders**: managed via the separate Sequelize CLI.

## Best practices
- Install the dialect-specific driver alongside Sequelize (e.g. `pg`, `mysql2`, `sqlite3`) as the docs require.
- Use managed transactions so commit/rollback is handled automatically on success/error.
- Prefer migrations over `sync({ force: true })` in production, which drops and recreates tables.
- Use `include` deliberately and select only needed attributes to avoid N+1 and over-fetching.

## Common pitfalls
- Running `sequelize.sync({ force: true })` against a real database → drops all tables; use migrations instead.
- Forgetting to install the dialect driver → connection fails at startup; install the matching driver package.

## Examples
```js
const { Sequelize, DataTypes } = require('sequelize')
const sequelize = new Sequelize(process.env.DATABASE_URL)

const User = sequelize.define('User', {
  name: { type: DataTypes.STRING },
})

await sequelize.authenticate()
const ada = await User.create({ name: 'Ada' })
```

## Further reading
- https://sequelize.org/docs/v6/core-concepts/model-basics/ — model basics
- https://sequelize.org/docs/v6/other-topics/transactions/ — transactions

## Related skills
- ../typeorm — decorator-based TS/JS ORM alternative
- ../knex — lower-level SQL query builder Sequelize sits above
