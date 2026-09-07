---
name: ember
description: Ember.js — an opinionated, batteries-included JavaScript framework for ambitious web applications, built around Ember CLI, the Glimmer rendering engine, routing, components, and services. Consult when scaffolding or working in an Ember app, using ember-cli (ember new/serve/generate), writing Glimmer components or templates (.hbs), defining routes/models/controllers/services, wiring Ember Data, or upgrading via the conventional file layout and addon ecosystem.
domain: stack
category: frontend
tags: [ember, emberjs, ember-cli, glimmer, ember-data, frontend, javascript]
official_sources:
  - https://guides.emberjs.com/release/
  - https://github.com/emberjs/ember.js
  - https://cli.emberjs.com/release/
verified: 2026-06-17
---

# Ember.js

## Overview
Ember.js is a productive, opinionated frontend framework for building scalable single-page applications, with strong conventions, a powerful router, and a first-class CLI/build pipeline. It bundles routing, components (Glimmer), services, and an optional data layer (Ember Data) so teams share one idiomatic structure. Read this when scaffolding an Ember app, generating routes/components/services, writing Handlebars templates, or upgrading an existing Ember codebase.

## Official sources
- Docs: https://guides.emberjs.com/release/
- Repo: https://github.com/emberjs/ember.js
- Install: https://cli.emberjs.com/release/basic-use/

## Install / setup
```bash
npm install -g ember-cli
ember new my-app --lang en --strict
cd my-app
npm start   # dev server at http://localhost:4200 (runs vite dev)
```
Commands from the Ember CLI Basic Use guide and the Quick Start (https://cli.emberjs.com/release/basic-use/, https://guides.emberjs.com/release/getting-started/quick-start/).

## Core concepts
- **Router & Routes** — `app/router.js` maps URLs to route handlers that load models and render templates.
- **Components (Glimmer)** — reusable UI; `.gjs`/`.gts` or paired `.hbs` + backing class; the modern default rendering layer.
- **Templates** — Handlebars `.hbs` with helpers, modifiers, and `{{outlet}}` for nested routing.
- **Services** — long-lived singletons (auth, state, API) injected with `@service`.
- **Ember Data** — store, models, adapters, and serializers for talking to a JSON/REST API.
- **Ember CLI** — scaffolding/build tool; `ember generate`, `ember serve`, `ember build`, Embroider + Vite build pipeline (Broccoli is the legacy/classic build).
- **Addons** — npm packages following Ember conventions to extend apps (`ember install <addon>`).
- **Octane edition** — Glimmer components, native classes, decorators (`@tracked`, `@action`), and template tags as the current idiom.

## Best practices
- Prefer Glimmer components, `@tracked` state, and `@action` over legacy Classic components (https://guides.emberjs.com/release/upgrading/current-edition/).
- Use `ember generate <blueprint>` to keep files in the conventional layout and tests in sync (https://cli.emberjs.com/release/basic-use/cli-commands/).
- Put shared, stateful logic in services and inject with `@service` (https://guides.emberjs.com/release/services/).
- Keep route model hooks for data loading; keep components presentational (https://guides.emberjs.com/release/routing/specifying-a-routes-model/).
- Adopt Embroider for modern bundling and tree-shaking on new apps (https://github.com/embroider-build/embroider).

## Common pitfalls
- Mutating tracked state in render → derive with getters or update inside `@action` handlers, not during rendering.
- Forgetting `{{outlet}}` in a parent template → nested routes render nothing; add the outlet.
- Skipping `ember generate` and hand-creating files → broken resolver lookups; use blueprints so naming/paths match.

## Examples
```javascript
// app/components/counter.js
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

export default class CounterComponent extends Component {
  @tracked count = 0;

  @action increment() {
    this.count += 1;
  }
}
```
```handlebars
{{! app/components/counter.hbs }}
<button type="button" {{on "click" this.increment}}>
  Clicked {{this.count}} times
</button>
```

## Further reading
- https://guides.emberjs.com/release/tutorial/part-1/ — Super Rentals official tutorial
- https://api.emberjs.com/ember/release/ — full API reference
- https://github.com/embroider-build/embroider — next-gen build system

## Related skills
- ../react — component-based SPA alternative with a different rendering model
- ../vue — progressive framework comparison for SFC/component design
- ../angular — another opinionated, batteries-included SPA framework
