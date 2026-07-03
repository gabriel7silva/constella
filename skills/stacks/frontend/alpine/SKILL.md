---
name: alpine
description: Lightweight framework for composing JavaScript behavior directly in markup via x- attributes; consult for sprinkles of interactivity.
domain: stack
category: frontend
tags: [alpinejs, declarative, markup, lightweight, reactivity]
official_sources:
  - https://alpinejs.dev/start-here
  - https://github.com/alpinejs/alpine
verified: 2026-06-16
---

# Alpine.js

## Overview
Alpine.js is a rugged, minimal framework for composing JavaScript behavior directly in your HTML using `x-` attributes. It offers reactive data, event handling, and DOM bindings without a build step, making it ideal for adding interactivity to mostly server-rendered pages. Read this when you want lightweight, declarative client behavior without a SPA framework.

## Official sources
- Docs: https://alpinejs.dev/start-here
- Repo: https://github.com/alpinejs/alpine
- Install / download: https://alpinejs.dev/essentials/installation

## Install / setup
Add via CDN (copied verbatim from alpinejs.dev/essentials/installation):

```html
<script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
```

Or install via npm and initialize in your bundle:

```bash
npm install alpinejs
```

```javascript
import Alpine from 'alpinejs'

window.Alpine = Alpine
Alpine.start()
```

## Core concepts
- **`x-data`** — declares a reactive component scope with state; required to activate Alpine on an element.
- **Directives** — `x-bind` (`:`), `x-on` (`@`), `x-model`, `x-show`, `x-if`, `x-for` wire state to the DOM.
- **`x-init`** — runs setup logic when a component initializes.
- **Reactivity** — Alpine tracks state in `x-data` and updates bindings when it changes.
- **Magics & globals** — `$el`, `$refs`, `$dispatch`, `$store` provide element refs, events, and shared state.
- **No build step** — works directly from a script tag for progressive enhancement.

## Best practices
- Keep component state inside `x-data`; for shared state use `Alpine.store` / `$store`.
- Register plugins/extensions between importing Alpine and calling `Alpine.start()`.
- Call `Alpine.start()` only once per page to avoid multiple instances.
- Pin a specific version (e.g. `@3.13.3`) in production instead of the floating `@3.x.x` tag.

## Common pitfalls
- Omitting the `defer` attribute on the CDN script → Alpine must defer so the DOM is ready; the docs require it.
- Forgetting `x-data` on a container → directives inside won't activate.
- Putting heavy logic inline in attributes → move it into methods within `x-data` for readability and reuse.

## Examples
```html
<div x-data="{ count: 0 }">
  <button @click="count++">Clicked <span x-text="count"></span> times</button>
</div>
```

## Further reading
- https://alpinejs.dev/start-here — guided introduction
- https://alpinejs.dev/essentials/installation — installation options

## Related skills
- ../htmx — hypermedia requests; pairs well with Alpine sprinkles
- ../lit — web components for heavier client logic
