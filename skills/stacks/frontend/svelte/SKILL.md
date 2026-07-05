---
name: svelte
description: Compiler-first UI framework that converts components to efficient JS with no runtime virtual DOM; consult for Svelte/SvelteKit apps.
domain: stack
category: frontend
tags: [svelte, sveltekit, compiler, reactivity, ui]
official_sources:
  - https://svelte.dev/docs
  - https://github.com/sveltejs/svelte
verified: 2026-06-16
---

# Svelte

## Overview
Svelte is a UI framework that shifts work to a compile step: instead of shipping a runtime that diffs a virtual DOM, it compiles components into small, imperative JavaScript that surgically updates the DOM. SvelteKit is the official application framework built on top of it (routing, SSR, data loading). Read this when building Svelte components or a SvelteKit app.

## Official sources
- Docs: https://svelte.dev/docs
- Repo: https://github.com/sveltejs/svelte
- Install / download: https://svelte.dev/docs/svelte/getting-started

## Install / setup
The docs recommend SvelteKit; create a project with the `sv` CLI (copied verbatim from svelte.dev/docs/svelte/getting-started):

```bash
npx sv create myapp
cd myapp
npm install
npm run dev
```

## Core concepts
- **Compiler** — Svelte compiles `.svelte` components at build time; there is no runtime virtual DOM.
- **Components** — `.svelte` files combine `<script>`, markup, and `<style>` (scoped by default).
- **Runes (Svelte 5)** — `$state`, `$derived`, `$effect`, and `$props` declare reactive state and derived values.
- **Props** — declared with `$props()` (Svelte 5); passed as attributes from parent.
- **Bindings** — `bind:value` and event handlers (`onclick`) wire UI to state.
- **Stores** — shared reactive state across components.
- **SvelteKit** — filesystem routing, server/client load functions, and SSR/SSG.

## Best practices
- Use runes (`$state`, `$derived`) for reactivity in Svelte 5 rather than the older reactive-label syntax.
- Keep styles in the component; Svelte scopes them automatically.
- Use SvelteKit for routing, SSR, and data loading rather than wiring it by hand.
- Derive values with `$derived` instead of manually keeping copies in sync.

## Common pitfalls
- Mixing Svelte 4 reactive statements (`$:`) with Svelte 5 runes → follow one model per the version you target.
- Expecting a virtual DOM diffing API → Svelte updates are compiled; think in terms of reactive declarations, not re-renders.
- Forgetting that component CSS is scoped → use `:global(...)` when you intentionally need global styles.

## Examples
```svelte
<script>
  let count = $state(0);
</script>

<button onclick={() => count++}>
  Clicked {count} times
</button>
```

## Further reading
- https://svelte.dev/docs/svelte/overview — Svelte language docs
- https://svelte.dev/docs/kit — SvelteKit application framework

## Related skills
- ../vue — reactive SFC-based framework
- ../solidjs — fine-grained reactive library
