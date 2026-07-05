---
name: mysql
description: Popular open-source relational database from Oracle; consult for schema design, SQL, storage engines (InnoDB), and replication.
domain: stack
category: database
tags: [mysql, sql, rdbms, relational, innodb]
official_sources:
  - https://dev.mysql.com/doc/
  - https://github.com/mysql/mysql-server
verified: 2026-06-16
---

# MySQL

## Overview
MySQL is a widely deployed open-source relational database maintained by Oracle, known for speed, reliability, and broad ecosystem support. Read this when building on a MySQL backend: designing tables, choosing storage engines, writing SQL, or configuring replication.

## Official sources
- Docs: https://dev.mysql.com/doc/
- Repo (official, Oracle): https://github.com/mysql/mysql-server
- Install / download: https://dev.mysql.com/downloads/

## Install / setup
On Debian/Ubuntu, MySQL provides the APT Repository (mysql-apt-config) from dev.mysql.com/downloads/. The Community Server, MySQL Shell, MySQL Router, and Workbench are listed there. On macOS the recommended path is via the MySQL Installer / DMG, and on Windows via the MySQL Installer for Windows.

```bash
# After installing the APT repo config package from dev.mysql.com/downloads/repo/apt/
sudo apt update
sudo apt install mysql-server
```

(Follow the exact repo-config steps on the official APT Repository download page for your distribution.)

## Core concepts
- Relational model with ACID transactions when using a transactional storage engine.
- Storage engines: InnoDB (default, transactional, row-level locking, foreign keys) vs MyISAM (non-transactional, table locks).
- Indexes: B-tree by default; covering, composite, and full-text indexes available.
- Replication: source/replica (formerly master/slave) for read scaling and availability.
- Character sets and collations: use `utf8mb4` for full Unicode (including emoji).
- The `mysql` client and MySQL Shell for administration and scripting.

## Best practices
- Use the InnoDB storage engine for transactional integrity and crash recovery (it's the default).
- Use `utf8mb4` character set rather than the legacy `utf8` (which is limited to 3-byte sequences).
- Add appropriate indexes and verify with `EXPLAIN`; avoid functions on indexed columns in WHERE clauses.
- Define explicit foreign keys and constraints under InnoDB to enforce referential integrity.
- Run `mysql_secure_installation` to harden a fresh server.

## Common pitfalls
- Choosing `utf8` and later hitting 4-byte character failures → use `utf8mb4` from the start.
- Relying on MyISAM for data that needs transactions or crash safety → use InnoDB.
- Wrapping indexed columns in functions (e.g., `WHERE DATE(col) = ...`) → prevents index use.
- Assuming default isolation; MySQL/InnoDB defaults to REPEATABLE READ → know the level your app needs.

## Examples
```sql
CREATE TABLE users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

## Further reading
- The InnoDB storage engine: https://dev.mysql.com/doc/refman/en/innodb-storage-engine.html
- Optimization: https://dev.mysql.com/doc/refman/en/optimization.html

## Related skills
- ../mariadb — community-driven MySQL fork
- ../planetscale — managed MySQL-compatible (Vitess) platform
- ../postgresql — alternative open-source RDBMS
