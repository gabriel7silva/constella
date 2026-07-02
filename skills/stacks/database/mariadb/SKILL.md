---
name: mariadb
description: Community-developed open-source fork of MySQL with extra storage engines and features; consult for MySQL-compatible relational backends.
domain: stack
category: database
tags: [mariadb, sql, rdbms, relational, mysql-fork]
official_sources:
  - https://mariadb.com/docs/
  - https://github.com/MariaDB/server
verified: 2026-06-16
---

# MariaDB

## Overview
MariaDB is a community-developed fork of MySQL started by core members of the original MySQL team, designed as a drop-in replacement with additional storage engines, features, and a permissive license. Read this when you want a MySQL-compatible relational database with the MariaDB ecosystem (e.g., Galera clustering, additional engines).

## Official sources
- Docs: https://mariadb.com/docs/
- Repo (official, MariaDB Foundation/Corporation): https://github.com/MariaDB/server
- Download: https://mariadb.org/download/

## Install / setup
MariaDB ships in the standard repositories of major Linux distributions as the `mariadb-server` package. On Ubuntu/Debian (from the official quickstart install guide):

```bash
sudo apt update
sudo apt install mariadb-server mariadb-client galera-4
sudo mariadb-secure-installation
```

For specific MariaDB versions, the MariaDB download page (mariadb.org/download/) generates tailored repository setup instructions per OS/architecture.

## Core concepts
- MySQL compatibility: largely a drop-in replacement; the `mysql`/`mariadb` client and wire protocol are compatible.
- Pluggable storage engines: InnoDB by default, plus MariaDB-specific engines (Aria, ColumnStore, etc.).
- Galera Cluster: synchronous multi-source replication for high availability (the `galera-4` package).
- Indexes, transactions, and ACID semantics under InnoDB, as in MySQL.
- `mariadb-secure-installation` to harden a new server.
- Character sets/collations: use `utf8mb4` for full Unicode.

## Best practices
- Use InnoDB for transactional, crash-safe workloads (the default engine).
- Use `utf8mb4` rather than legacy `utf8` for full Unicode support.
- Run `mariadb-secure-installation` after install to remove anonymous users and test databases.
- For high availability, evaluate Galera Cluster rather than rolling your own replication.
- Verify query plans with `EXPLAIN` and index columns used in joins and filters.

## Common pitfalls
- Assuming 100% feature parity with the latest MySQL → divergence has grown; check the MariaDB docs for version-specific syntax and functions.
- Using legacy `utf8` and hitting 4-byte character errors → use `utf8mb4`.
- Mixing MariaDB and MySQL client/server versions and assuming identical behavior → confirm compatibility for your versions.
- Skipping `mariadb-secure-installation` on a fresh server → insecure defaults remain.

## Examples
```sql
CREATE TABLE orders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  customer_email VARCHAR(255) NOT NULL,
  total_cents INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

## Further reading
- MariaDB quickstart guides: https://mariadb.com/docs/server/mariadb-quickstart-guides/
- Downloads & repository setup: https://mariadb.org/download/

## Related skills
- ../mysql — the upstream project MariaDB forked from
- ../postgresql — alternative open-source RDBMS
