---
name: sqlite
description: Embedded, serverless, file-based SQL database; consult for local/app storage, on-device data, tests, and zero-config single-file databases.
domain: stack
category: database
tags: [sqlite, sql, embedded, serverless, file-based]
official_sources:
  - https://sqlite.org/docs.html
  - https://github.com/sqlite/sqlite
verified: 2026-06-16
---

# SQLite

## Overview
SQLite is a self-contained, serverless, zero-configuration, transactional SQL database engine where the entire database is stored in a single cross-platform file. Read this when you need embedded storage inside an application, on-device data, test fixtures, or a lightweight single-file database without a server process.

## Official sources
- Docs: https://sqlite.org/docs.html
- Repo (official GitHub mirror; canonical development uses Fossil at sqlite.org/src): https://github.com/sqlite/sqlite
- Download: https://sqlite.org/download.html

## Install / setup
SQLite is distributed as precompiled command-line tools and as the C "amalgamation" source from the official download page (sqlite.org/download.html). There is no package-manager install command on that page; you download the binary or amalgamation for your platform. On macOS, after downloading the precompiled binary you may need to clear the quarantine attribute:

```bash
xattr -d com.apple.quarantine <prog>
```

(Many language runtimes embed SQLite directly, so no separate install is required.)

## Core concepts
- Serverless and embedded: the library links into your application; there is no separate server process.
- Single-file database: the whole database (tables, indexes, data) lives in one ordinary file.
- ACID transactions: writes are atomic and durable even across crashes/power loss.
- Dynamic typing with type affinity: columns have an affinity rather than rigid types.
- Write-Ahead Logging (WAL): an alternative journaling mode that improves concurrency for readers during writes.
- Public domain: the source code is dedicated to the public domain.

## Best practices
- Enable WAL mode (`PRAGMA journal_mode=WAL;`) for better read/write concurrency in most applications.
- Use parameterized queries (bound parameters) to avoid SQL injection and improve plan reuse.
- Wrap bulk inserts in a single transaction; per-statement autocommit is slow for many rows.
- Use `STRICT` tables when you want rigid type enforcement instead of type affinity.
- Keep the database file on local disk, not a network filesystem, to avoid locking issues.

## Common pitfalls
- Assuming rigid typing → SQLite uses type affinity by default; values may be stored as a different type than declared unless you use STRICT tables.
- Expecting high write concurrency → SQLite serializes writers; it suits single-writer or low-write-concurrency workloads.
- Running many inserts in autocommit mode → wrap them in a transaction for orders-of-magnitude speedup.
- Placing the DB file on NFS/network shares → file locking is unreliable there.

## Examples
```sql
PRAGMA journal_mode = WAL;

CREATE TABLE notes (
  id INTEGER PRIMARY KEY,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
) STRICT;
```

## Further reading
- Datatypes / type affinity: https://sqlite.org/datatype3.html
- Write-Ahead Logging: https://sqlite.org/wal.html

## Related skills
- ../postgresql — full client/server RDBMS for larger workloads
- ../mysql — client/server RDBMS alternative
