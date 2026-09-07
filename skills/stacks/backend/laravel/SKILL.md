---
name: laravel
description: Full-featured PHP web framework with Eloquent ORM, Blade, queues, and Artisan; consult when building or maintaining a Laravel backend.
domain: stack
category: backend
tags: [php, laravel, mvc, eloquent, web-framework]
official_sources:
  - https://laravel.com/docs
  - https://github.com/laravel/laravel
verified: 2026-06-16
---

# Laravel

## Overview
Laravel is a PHP web application framework with expressive syntax that provides structure for full-stack apps and API backends. It bundles routing, dependency injection, the Eloquent ORM, queues, scheduled jobs, real-time broadcasting, and testing out of the box. Read this when scaffolding, routing, persisting data, or organizing a Laravel codebase.

## Official sources
- Docs: https://laravel.com/docs
- Repo: https://github.com/laravel/laravel (application skeleton); framework at https://github.com/laravel/framework
- Install / download: https://laravel.com/docs/installation

## Install / setup
```bash
# Install the Laravel installer via Composer (requires PHP + Composer)
composer global require laravel/installer

# Create a new application
laravel new example-app

# Start dev server, queue worker, and Vite together
cd example-app
npm install && npm run build
composer run dev
```

## Core concepts
- Request lifecycle: requests enter through `public/index.php`, pass through middleware, are dispatched by the router, and return a response — understanding this order is key to debugging.
- Routing & controllers: routes in `routes/web.php` and `routes/api.php` map URIs to closures or controllers; conventions make controller/file placement predictable.
- Eloquent ORM: each model maps to a database table; relationships, migrations, and seeders manage schema and data.
- Service container & facades: the container resolves dependencies via injection; facades provide a static-style interface to container-bound services.
- Blade templates: Laravel's templating engine for full-stack rendering, with components and layouts.
- Configuration via `.env`: environment-specific values live in `.env` (not committed); the `config/` directory holds documented options.

## Best practices
- Keep `.env` out of source control; each environment supplies its own credentials (https://laravel.com/docs/installation#environment-based-configuration).
- Serve the app from the web root (the `public/` directory), never from a subdirectory, to avoid exposing sensitive files (https://laravel.com/docs/installation#directory-configuration).
- Use migrations and seeders for schema/data so environments stay reproducible.
- Use starter kits for authentication scaffolding rather than rolling your own (https://laravel.com/docs/starter-kits).

## Common pitfalls
- Committing `.env` or serving from a subdirectory → exposes credentials and source; keep `.env` ignored and serve from the public root.
- Treating Laravel only as full-stack → it also works as an API backend with Sanctum auth; choose the path that matches your frontend.
- Forgetting to run `php artisan migrate` after switching from the default SQLite to MySQL/PostgreSQL → create the database and run migrations.

## Examples
```php
// routes/web.php
use Illuminate\Support\Facades\Route;

Route::get('/users/{id}', function (string $id) {
    return \App\Models\User::findOrFail($id);
});
```

## Further reading
- https://laravel.com/docs/lifecycle — Request lifecycle
- https://laravel.com/docs/eloquent — Eloquent ORM
- https://laravel.com/docs/sanctum — API authentication

## Related skills
- ../rails — another convention-driven full-stack web framework
- ../adonisjs — TypeScript framework with comparable full-stack ergonomics
