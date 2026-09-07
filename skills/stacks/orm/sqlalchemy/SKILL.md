---
name: sqlalchemy
description: The de-facto Python SQL toolkit and ORM with Core expression language and full ORM layer; consult for relational data access in Python.
domain: stack
category: orm
tags: [orm, python, sql, database, core, session]
official_sources:
  - https://docs.sqlalchemy.org/
  - https://github.com/sqlalchemy/sqlalchemy
verified: 2026-06-16
---

# SQLAlchemy

## Overview
SQLAlchemy is the de-facto Python SQL toolkit and Object Relational Mapper. It offers two layers: **Core**, a Python SQL expression language and database abstraction, and the **ORM**, which maps classes to tables using the unit-of-work and identity-map patterns. Read this for relational database access in Python when you want full control over SQL alongside high-level ORM mapping.

## Official sources
- Docs: https://docs.sqlalchemy.org/
- Repo: https://github.com/sqlalchemy/sqlalchemy
- Install: https://docs.sqlalchemy.org/en/20/intro.html#installation

## Install / setup
```bash
pip install SQLAlchemy
```

## Core concepts
- **Engine**: the starting point created with `create_engine()`; manages DBAPI connections and the connection pool.
- **Core vs ORM**: Core exposes the SQL Expression Language (`Table`, `select()`); the ORM maps classes via declarative models.
- **Declarative models**: classes inheriting from a `DeclarativeBase` with `Mapped`/`mapped_column` (2.0 style) map to tables.
- **Session**: the ORM's unit of work — tracks changes and flushes them in a transaction; obtain via `Session`/`sessionmaker`.
- **2.0 unified query API**: `select()` with `session.execute()` / `session.scalars()` is the modern querying style.
- **Relationships**: `relationship()` defines associations with configurable lazy/eager loading strategies.

## Best practices
- Create one `Engine` per database and reuse it; do not create engines per request (per docs, the engine owns the pool).
- Scope `Session` to a logical unit of work and use it as a context manager / `session.begin()` so transactions commit or roll back cleanly.
- Use the 2.0-style `select()` API and `Mapped`/`mapped_column` typing for new code.
- Configure relationship loading (`selectin`, `joined`) deliberately to control eager vs lazy loading and avoid N+1.

## Common pitfalls
- Sharing a single `Session` across threads/requests → it is not thread-safe; use a fresh session per unit of work (or `scoped_session`).
- Triggering lazy loads after the session closes → `DetachedInstanceError`; load needed relationships eagerly or keep the session open.

## Examples
```python
from sqlalchemy import create_engine, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, Session

class Base(DeclarativeBase): ...

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50))

engine = create_engine("postgresql+psycopg://localhost/app")
Base.metadata.create_all(engine)
with Session(engine) as session:
    session.add(User(name="Ada"))
    session.commit()
```

## Further reading
- https://docs.sqlalchemy.org/en/20/orm/quickstart.html — ORM quickstart
- https://docs.sqlalchemy.org/en/20/tutorial/index.html — unified tutorial

## Related skills
- ../django-orm — Python ORM bundled with Django
- ../prisma — type-safe ORM in the TS ecosystem
