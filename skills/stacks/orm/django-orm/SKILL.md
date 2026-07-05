---
name: django-orm
description: Django's built-in ORM — models, QuerySets, migrations, and the admin; consult for relational data access inside a Django project.
domain: stack
category: orm
tags: [orm, python, django, models, queryset, migrations]
official_sources:
  - https://docs.djangoproject.com/en/stable/topics/db/
  - https://github.com/django/django
verified: 2026-06-16
---

# Django ORM

## Overview
The Django ORM ships with the Django web framework and is the single, definitive source of truth for your data: each model maps to a database table, and you query through lazy QuerySets. It includes a migration system and integrates with the Django admin. Read this when building data access inside a Django project rather than as a standalone library (the ORM is not distributed separately).

## Official sources
- Docs: https://docs.djangoproject.com/en/stable/topics/db/
- Repo: https://github.com/django/django

## Core concepts
- **Models**: subclasses of `django.db.models.Model`; each field maps to a column and each model to a table.
- **QuerySets**: lazy, chainable query objects (`Model.objects.filter(...)`) that hit the database only when evaluated.
- **Managers**: the `objects` manager is the query entry point; custom managers add reusable query logic.
- **Migrations**: schema changes are captured by `makemigrations` and applied with `migrate`.
- **Relationships**: `ForeignKey`, `ManyToManyField`, `OneToOneField` model associations with related-object access.
- **Aggregation & raw SQL**: `annotate`/`aggregate` for grouped queries, plus escape hatches for raw SQL when needed.

## Best practices
- Use `select_related` (joins) and `prefetch_related` (separate queries) to avoid N+1 when traversing relations (per docs).
- Always create and review migrations with `makemigrations`/`migrate`; keep them in version control.
- Defer or restrict columns with `only()`/`defer()` and `values()` when you do not need full model instances.
- Wrap multi-step writes in `transaction.atomic()` for atomicity.

## Common pitfalls
- Iterating related objects in a loop without `select_related`/`prefetch_related` → N+1 query storms.
- Assuming QuerySets execute immediately → they are lazy and re-evaluating one repeatedly re-runs the query; cache with `list()` when reused.

## Examples
```python
from django.db import models

class User(models.Model):
    name = models.CharField(max_length=50)

# querying
ada = User.objects.create(name="Ada")
adults = User.objects.filter(name="Ada").select_related()
```

## Further reading
- https://docs.djangoproject.com/en/stable/topics/db/queries/ — making queries
- https://docs.djangoproject.com/en/stable/topics/db/optimization/ — query optimization

## Related skills
- ../sqlalchemy — standalone Python ORM/toolkit alternative
- ../prisma — type-safe ORM in the TS ecosystem
