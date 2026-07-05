---
name: django
description: Full-featured, batteries-included Python web framework with ORM, admin, and auth; consult for rapid, secure server-rendered apps and APIs.
domain: stack
category: backend
tags: [django, python, orm, mvc, web-framework, backend]
official_sources:
  - https://docs.djangoproject.com/en/stable/
  - https://github.com/django/django
verified: 2026-06-16
---

# Django

## Overview
Django is a high-level Python web framework that encourages rapid development and clean, pragmatic design — "the web framework for perfectionists with deadlines." It ships batteries-included: an ORM, automatic admin site, authentication, forms, templating, and security defaults. Read this when building data-driven Python web apps or APIs where you want strong conventions and built-in tooling.

## Official sources
- Docs: https://docs.djangoproject.com/en/stable/
- Repo: https://github.com/django/django
- Install: https://docs.djangoproject.com/en/stable/topics/install/

## Install / setup
```bash
python -m pip install Django
```
On Windows the docs show `py -m pip install Django`. (Source: https://docs.djangoproject.com/en/stable/topics/install/)

## Core concepts
- **Projects vs apps** — a project is the deployable site; apps are reusable, focused components registered in `INSTALLED_APPS`.
- **MTV pattern** — Django's take on MVC: Models (data), Templates (presentation), Views (request handling).
- **ORM & migrations** — models map to DB tables; `makemigrations` / `migrate` evolve the schema.
- **URLconf & views** — `urls.py` routes paths to view functions/classes that return `HttpResponse`.
- **Admin site** — an auto-generated CRUD interface for registered models.
- **Settings & middleware** — central `settings.py` config plus a middleware stack for cross-cutting request/response processing.

## Best practices
- Run `makemigrations` and `migrate` to manage schema changes; never edit the database schema out of band (https://docs.djangoproject.com/en/stable/topics/migrations/).
- Keep secrets and environment-specific values out of source; review the deployment checklist before going live (https://docs.djangoproject.com/en/stable/howto/deployment/checklist/).
- Use the ORM's `select_related` / `prefetch_related` to avoid N+1 queries (https://docs.djangoproject.com/en/stable/topics/db/optimization/).
- Rely on built-in protections (CSRF, XSS escaping, SQL parameterization) rather than rolling your own (https://docs.djangoproject.com/en/stable/topics/security/).

## Common pitfalls
- Running with `DEBUG = True` in production → leaks tracebacks and settings; set `DEBUG = False` and configure `ALLOWED_HOSTS` (https://docs.djangoproject.com/en/stable/ref/settings/#debug).
- Triggering N+1 queries by iterating querysets that lazily hit related objects → use `select_related`/`prefetch_related` to batch the joins.

## Examples
```python
# views.py
from django.http import HttpResponse

def index(request):
    return HttpResponse("Hello, world.")
```

## Further reading
- https://docs.djangoproject.com/en/stable/intro/tutorial01/ — official tutorial
- https://docs.djangoproject.com/en/stable/howto/deployment/checklist/ — deployment checklist

## Related skills
- ../flask — lighter-weight Python alternative
- ../fastapi — async, typed Python API framework
