---
name: codeigniter
description: CodeIgniter 4 — a small, fast PHP MVC framework for building web apps and APIs with minimal configuration. Consult when scaffolding a CodeIgniter 4 app starter, defining routes and controllers, using the Query Builder or models, building RESTful resources, or running the spark CLI and server.
domain: stack
category: backend
tags: [codeigniter, php, mvc, composer, rest, query-builder, backend]
official_sources:
  - https://codeigniter.com/user_guide/
  - https://github.com/codeigniter4/CodeIgniter4
  - https://codeigniter.com/user_guide/installation/installing_composer.html
verified: 2026-06-17
---

# CodeIgniter

## Overview
CodeIgniter 4 is a lightweight PHP MVC framework prized for a small footprint, fast performance, and near-zero configuration. It provides routing, controllers, models with a fluent Query Builder, validation, and the `spark` CLI without imposing heavy conventions. Read this when building a small-to-mid PHP app or API where you want explicit control and minimal boilerplate.

## Official sources
- Docs: https://codeigniter.com/user_guide/
- Repo: https://github.com/codeigniter4/CodeIgniter4
- Install: https://codeigniter.com/user_guide/installation/installing_composer.html

## Install / setup
```bash
composer create-project codeigniter4/appstarter project-root
cd project-root && php spark serve
```
Source: https://codeigniter.com/user_guide/installation/installing_composer.html (creates `project-root` with the latest framework as a dependency; `spark serve` starts the dev server on :8080).

## Core concepts
- **MVC structure** — `app/Controllers`, `app/Models`, `app/Views` hold the application code.
- **Routing** — `app/Config/Routes.php` maps URLs to controller methods; auto-routing is opt-in.
- **Controllers** — extend `BaseController`; return strings, views, or responses.
- **Models & Entities** — extend `CodeIgniter\Model` for CRUD, validation, and result hydration.
- **Query Builder** — chainable, DB-agnostic query API via `$this->db->table(...)`.
- **spark CLI** — `php spark` runs migrations, generators, the dev server, and custom commands.
- **Filters** — request/response middleware (auth, CSRF, CORS) configured in `Config\Filters`.
- **Environment config** — `.env` plus `app/Config/*` classes; set `CI_ENVIRONMENT`.

## Best practices
- Disable auto-routing and define explicit routes for security (https://codeigniter.com/user_guide/incoming/routing.html).
- Use `ResourceController`/`ResourcePresenter` for RESTful endpoints (https://codeigniter.com/user_guide/incoming/restful.html).
- Configure the database and base URL via `.env`, keep it out of version control (https://codeigniter.com/user_guide/general/configuration.html).
- Use the Model layer and validation rather than raw queries for user input (https://codeigniter.com/user_guide/models/model.html).

## Common pitfalls
- Leaving auto-routing (legacy) enabled exposes unintended methods → set routing to defined routes only.
- Wrong `baseURL` in `app/Config/App.php`/`.env` breaks asset and redirect URLs → set it correctly per environment.
- Forgetting `CI_ENVIRONMENT=production` leaves verbose error output on → set it for prod.

## Examples
```php
namespace App\Controllers;

use CodeIgniter\RESTful\ResourceController;

class Users extends ResourceController
{
    protected $modelName = \App\Models\UserModel::class;
    protected $format = 'json';

    public function show($id = null)
    {
        return $this->respond($this->model->find($id));
    }
}
```

## Further reading
- https://codeigniter.com/user_guide/intro/index.html — framework overview and welcome
- https://codeigniter.com/user_guide/database/query_builder.html — Query Builder reference

## Related skills
- ../symfony — heavier, component-based PHP framework
- ../nginx — front CodeIgniter with Nginx + PHP-FPM
