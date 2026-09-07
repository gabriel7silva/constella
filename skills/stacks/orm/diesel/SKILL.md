---
name: diesel
description: Safe, extensible compile-time-checked ORM and query builder for Rust; consult for type-safe SQL against PostgreSQL, MySQL, or SQLite in Rust.
domain: stack
category: orm
tags: [orm, rust, query-builder, postgresql, sqlite, mysql]
official_sources:
  - https://diesel.rs/guides/
  - https://github.com/diesel-rs/diesel
verified: 2026-06-16
---

# Diesel

## Overview
Diesel is a safe, extensible ORM and query builder for Rust that uses Rust's type system to catch query errors at compile time and eliminate boilerplate. It supports PostgreSQL, MySQL, and SQLite with a zero-cost, Rust-like query DSL. Read this when building Rust applications that need type-safe, performant database access.

## Official sources
- Docs / guides: https://diesel.rs/guides/
- Repo: https://github.com/diesel-rs/diesel
- Install / getting started: https://diesel.rs/guides/getting-started

## Install / setup
```bash
cargo install diesel_cli --no-default-features --features postgres
```
Add to `Cargo.toml`:
```toml
diesel = { version = "2.2.0", features = ["postgres"] }
dotenvy = "0.15"
```

## Core concepts
- **diesel_cli**: command-line tool that creates the database, manages migrations, and generates schema (`diesel setup`, `diesel migration`).
- **schema.rs**: generated `table!` definitions describing tables and columns, used for compile-time query checking.
- **Migrations**: pairs of `up.sql`/`down.sql` files applied and reverted by the CLI.
- **Connection**: a typed connection (e.g. `PgConnection`) established with a database URL.
- **Query DSL**: methods like `filter`, `select`, `load`, `insert_into` compile to checked SQL.
- **Derive macros**: `Queryable`, `Insertable`, `Selectable` map Rust structs to rows.

## Best practices
- Install `diesel_cli` with only the features you need (e.g. `--no-default-features --features postgres`) to avoid pulling in unused client libraries (per the getting-started guide).
- Keep `schema.rs` generated from migrations rather than hand-editing it, so it matches the database.
- Store the connection URL in a `.env` file (used with `dotenvy`) as shown in the guide.
- Write reversible migrations (`up.sql` + `down.sql`) and run them through the CLI.

## Common pitfalls
- Installing `diesel_cli` without the right backend feature → build errors or a CLI that cannot talk to your database; specify the backend feature.
- Editing `schema.rs` by hand → drift from the real schema; regenerate it from migrations instead.

## Examples
```rust
use diesel::prelude::*;

#[derive(Queryable, Selectable)]
#[diesel(table_name = crate::schema::users)]
struct User { id: i32, name: String }

let conn = &mut PgConnection::establish(&database_url)?;
let results = users::table
    .filter(users::name.eq("Ada"))
    .select(User::as_select())
    .load(conn)?;
```

## Further reading
- https://diesel.rs/guides/getting-started — getting started
- https://diesel.rs/guides/all-about-inserts — inserts guide

## Related skills
- ../gorm — Go's standard ORM (contrast: another typed-language ORM)
- ../prisma — type-safe ORM in the TS ecosystem
