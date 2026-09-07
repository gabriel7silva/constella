---
name: gorm
description: The fantastic, developer-friendly ORM for Go with associations, hooks, transactions, and auto-migration; consult for relational data access in Go.
domain: stack
category: orm
tags: [orm, go, golang, database, migrations, associations]
official_sources:
  - https://gorm.io/docs/
  - https://github.com/go-gorm/gorm
verified: 2026-06-16
---

# GORM

## Overview
GORM is the de-facto ORM library for Go, aiming to be developer-friendly. It maps Go structs to tables and provides associations, hooks, transactions, eager loading, and auto-migration, with driver support for PostgreSQL, MySQL, SQLite, SQL Server, and others. Read this when building Go services that need a full-featured ORM rather than hand-written SQL.

## Official sources
- Docs: https://gorm.io/docs/
- Repo: https://github.com/go-gorm/gorm
- Install / index: https://gorm.io/docs/index.html

## Install / setup
```bash
go get -u gorm.io/gorm
go get -u gorm.io/driver/sqlite
```

## Core concepts
- **Models**: plain Go structs whose fields map to columns; embed `gorm.Model` for ID/timestamps/soft-delete.
- **`*gorm.DB`**: the database handle opened with `gorm.Open(driver, &gorm.Config{})`; carries chainable method calls.
- **CRUD chain methods**: `Create`, `First`/`Find`, `Where`, `Update`, `Delete` build and run queries.
- **Associations**: `Has One`, `Has Many`, `Belongs To`, `Many To Many` with `Preload` for eager loading.
- **AutoMigrate**: creates/updates tables to match struct definitions.
- **Hooks & transactions**: lifecycle callbacks (`BeforeCreate` etc.) and `db.Transaction(func...)` for atomic work.

## Best practices
- Open the database once and reuse the shared `*gorm.DB`; it manages an underlying connection pool.
- Use `Preload` (or joins) to load associations and avoid N+1 queries (per docs).
- Treat `AutoMigrate` as convenient for development; review schema changes carefully before relying on it in production (it only adds, it will not delete columns).
- Always check the returned `error` (and `RowsAffected`) on query chains.

## Common pitfalls
- Ignoring the `.Error` field on a chained call → silent failures; inspect `result.Error` after each operation.
- Expecting `AutoMigrate` to drop or rename columns → it does not remove columns; use explicit migrations for destructive changes.

## Examples
```go
import (
  "gorm.io/gorm"
  "gorm.io/driver/sqlite"
)

type User struct {
  gorm.Model
  Name string
}

db, _ := gorm.Open(sqlite.Open("app.db"), &gorm.Config{})
db.AutoMigrate(&User{})
db.Create(&User{Name: "Ada"})

var u User
db.Where("name = ?", "Ada").First(&u)
```

## Further reading
- https://gorm.io/docs/models.html — declaring models
- https://gorm.io/docs/preload.html — preloading associations

## Related skills
- ../diesel — Rust's type-safe ORM (contrast: another typed-language ORM)
- ../prisma — type-safe ORM in the TS ecosystem
