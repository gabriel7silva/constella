---
name: symfony
description: Symfony — the PHP framework and set of reusable components for building web apps, REST APIs, and CLI tools with routing, dependency injection, Doctrine ORM, and Twig. Consult when scaffolding a Symfony project, defining controllers/routes with attributes, configuring services and bundles, building forms, or using the Symfony CLI / composer create-project.
domain: stack
category: backend
tags: [symfony, php, doctrine, twig, mvc, composer, backend]
official_sources:
  - https://symfony.com/doc/current/index.html
  - https://github.com/symfony/symfony
  - https://symfony.com/doc/current/setup.html
verified: 2026-06-17
---

# Symfony

## Overview
Symfony is a mature PHP framework built from decoupled, reusable components (HttpFoundation, Routing, DependencyInjection, Console). It powers full-stack web apps, APIs, and microservices, and many of its components underpin other PHP projects (including Laravel and Drupal). Read this when scaffolding a Symfony app, wiring services, defining attribute-based routes, or using Doctrine and Twig.

## Official sources
- Docs: https://symfony.com/doc/current/index.html
- Repo: https://github.com/symfony/symfony
- Install: https://symfony.com/doc/current/setup.html

## Install / setup
```bash
# Full-featured web app (Symfony CLI):
symfony new my_project_directory --version="8.1.*" --webapp
# Or with Composer:
composer create-project symfony/skeleton:"8.1.*" my_project_directory
cd my_project_directory && composer require webapp
```
Source: https://symfony.com/doc/current/setup.html

## Core concepts
- **Front controller & kernel** — all requests route through `public/index.php` into the HTTP kernel.
- **Routing** — `#[Route]` attributes on controller methods map URLs to actions.
- **Controllers** — extend `AbstractController`; return a `Response` (or Twig `render()`).
- **Service container & DI** — autowiring + autoconfiguration wire services; configured in `config/services.yaml`.
- **Doctrine ORM** — entities, repositories, and migrations for database access.
- **Twig** — templating engine for views (`templates/`).
- **Bundles & Flex** — reusable plugins; Symfony Flex installs recipes that auto-configure them.
- **Console** — `bin/console` runs commands (cache clear, migrations, custom commands).

## Best practices
- Use attribute-based routing and constructor injection (autowiring) for services (https://symfony.com/doc/current/best_practices.html).
- Store config in environment variables via `.env`, never commit secrets; use the Secrets vault (https://symfony.com/doc/current/configuration/secrets.html).
- Keep controllers thin; push logic into services (https://symfony.com/doc/current/controller.html).
- Use Doctrine migrations rather than auto-updating the schema in production (https://symfony.com/doc/current/doctrine.html).

## Common pitfalls
- Editing `config/services.yaml` to register every class manually → rely on autowiring/autoconfiguration instead.
- Forgetting to clear the prod cache after config changes → run `bin/console cache:clear --env=prod`.
- Running `doctrine:schema:update --force` in prod → generate and run migrations instead.

## Examples
```php
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

class HelloController extends AbstractController
{
    #[Route('/hello/{name}', name: 'hello')]
    public function index(string $name = 'World'): JsonResponse
    {
        return $this->json(['message' => "Hello $name"]);
    }
}
```

## Further reading
- https://symfony.com/doc/current/best_practices.html — official best practices
- https://symfony.com/components — the reusable Symfony components

## Related skills
- ../codeigniter — lighter-weight PHP MVC alternative
- ../nginx — serve Symfony's public/ front controller behind Nginx + PHP-FPM
