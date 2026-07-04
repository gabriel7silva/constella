---
name: lit
description: Lightweight base library for building fast, standards-based Web Components; consult for LitElement, reactive properties, and html templates.
domain: stack
category: frontend
tags: [lit, web-components, custom-elements, shadow-dom, templates]
official_sources:
  - https://lit.dev/docs/
  - https://github.com/lit/lit
verified: 2026-06-16
---

# Lit

## Overview
Lit is a small library for building fast, lightweight Web Components on top of native browser standards (Custom Elements, Shadow DOM). Its `LitElement` base class adds reactive properties and efficient declarative templates via tagged template literals, with no heavy framework runtime. Read this when authoring reusable, framework-agnostic components that work in any page or framework.

## Official sources
- Docs: https://lit.dev/docs/
- Repo: https://github.com/lit/lit
- Install / download: https://lit.dev/docs/getting-started/

## Install / setup
Install via npm (copied verbatim from lit.dev/docs/getting-started/):

```bash
npm i lit
```

Then import the base class and helpers:

```javascript
import {LitElement, html} from 'lit';
import {customElement, property} from 'lit/decorators.js';
```

## Core concepts
- **Web Components** — Lit builds on native Custom Elements and Shadow DOM, so components are portable across frameworks.
- **`LitElement`** — base class providing the reactive update lifecycle.
- **Reactive properties** — `@property()`/`@state()` trigger efficient re-renders when they change.
- **`html` templates** — tagged template literals describe markup; Lit updates only the dynamic parts.
- **Scoped styles** — `static styles` with the `css` tag are encapsulated via Shadow DOM.
- **Reactive update lifecycle** — `willUpdate`, `render`, `updated` hooks run around each render.

## Best practices
- Use `@property()` for public attributes/properties and `@state()` for internal reactive state.
- Define styles with the `css` tagged literal in `static styles` so they're parsed once and shared.
- Keep `render()` a pure function of reactive properties; perform side effects in `updated()`.
- For npm projects use the `lit` package, not the CDN bundles, to avoid shipping redundant code.

## Common pitfalls
- Mutating objects/arrays in place without reassigning → Lit detects property changes by identity; assign a new value or call `requestUpdate()`.
- Forgetting to register the element (`@customElement('x-y')` or `customElements.define`) → the tag won't upgrade.
- Expecting global CSS to pierce Shadow DOM → style inside the component or use documented theming hooks (CSS custom properties / `::part`).

## Examples
```typescript
import {LitElement, html} from 'lit';
import {customElement, state} from 'lit/decorators.js';

@customElement('my-counter')
export class MyCounter extends LitElement {
  @state() count = 0;
  render() {
    return html`<button @click=${() => this.count++}>Clicked ${this.count} times</button>`;
  }
}
```

## Further reading
- https://lit.dev/docs/components/overview/ — component authoring guide
- https://lit.dev/docs/templates/overview/ — templating reference

## Related skills
- ../alpine — declarative behavior in markup
- ../htmx — hypermedia-driven interactivity
