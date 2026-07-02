---
name: angular
description: Full-featured TypeScript frontend platform with CLI, DI, and reactive primitives; consult for components, signals, and Angular CLI apps.
domain: stack
category: frontend
tags: [angular, typescript, cli, signals, dependency-injection, spa]
official_sources:
  - https://angular.dev/
  - https://github.com/angular/angular
verified: 2026-06-16
---

# Angular

## Overview
Angular is a full-featured, opinionated TypeScript framework and platform for building web applications, with a first-class CLI, dependency injection, routing, forms, and HTTP client included. Modern Angular uses standalone components and signals for reactivity. Read this when scaffolding with the Angular CLI, structuring components/services, or working with DI and signals.

## Official sources
- Docs: https://angular.dev/
- Repo: https://github.com/angular/angular
- Install / download: https://angular.dev/installation

## Install / setup
Install the CLI globally and create a project (copied verbatim from angular.dev/installation):

```bash
npm install -g @angular/cli
```

```bash
ng new <project-name>
```

## Core concepts
- **Components** — classes with a template and styles, declared standalone in modern Angular.
- **Templates** — HTML with Angular syntax: bindings (`[prop]`, `(event)`), control flow (`@if`, `@for`), and interpolation.
- **Signals** — reactive primitives (`signal`, `computed`, `effect`) for fine-grained state.
- **Dependency injection** — services are provided and injected via the DI system (`inject()` / constructor injection).
- **Angular CLI** — `ng generate`, `ng serve`, `ng build` scaffold, run, and bundle apps.
- **Routing** — the Router maps URL paths to components.
- **RxJS** — Observables power async streams (HTTP, events) throughout the framework.

## Best practices
- Prefer standalone components and the new control-flow syntax (`@if`, `@for`) for new code.
- Use signals for component state and `computed` for derived values.
- Use the CLI (`ng generate`) to scaffold consistent components, services, and routes.
- Provide services at the appropriate injector scope (root vs. component) to control lifetimes.
- Keep templates declarative; move logic into the component class or services.

## Common pitfalls
- Forgetting to unsubscribe from long-lived Observables → use `async` pipe or `takeUntilDestroyed` to avoid leaks.
- Doing heavy work in templates → precompute with `computed`/signals or pure pipes.
- Mixing NgModules and standalone patterns inconsistently → follow the standalone-first guidance for new projects.

## Examples
```typescript
import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-counter',
  standalone: true,
  template: `<button (click)="count.set(count() + 1)">Clicked {{ count() }} times</button>`,
})
export class CounterComponent {
  count = signal(0);
}
```

## Further reading
- https://angular.dev/overview — platform overview and guides
- https://angular.dev/tools/cli — Angular CLI reference

## Related skills
- ../react — component UI library
- ../vue — progressive reactive framework
