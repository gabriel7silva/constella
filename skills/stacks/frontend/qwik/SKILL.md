---
name: qwik
description: Resumable web framework with instant loading and O(1) hydration via lazy execution; consult for Qwik components and SSR resumability.
domain: stack
category: frontend
tags: [qwik, resumability, hydration, ssr, lazy-loading, ui]
official_sources:
  - https://qwik.dev/docs/
  - https://github.com/QwikDev/qwik
verified: 2026-06-16
---

# Qwik

## Overview
Qwik is a JavaScript framework focused on instant-loading web apps through **resumability**: instead of replaying app setup on the client (hydration), it serializes server state into HTML and resumes execution on demand. This makes initial JS execution effectively O(1) regardless of app size. Read this when building Qwik components, optimizing time-to-interactive, or using QwikCity for routing/SSR.

## Official sources
- Docs: https://qwik.dev/docs/
- Repo: https://github.com/QwikDev/qwik
- Install / download: https://qwik.dev/docs/getting-started/

## Install / setup
Create a project with the official CLI (copied verbatim from qwik.dev/docs/getting-started/):

```bash
npm create qwik@latest
```

## Core concepts
- **Resumability** — the app resumes from serialized server state instead of re-running setup (hydration) on the client.
- **The `$` boundary** — `$()` and suffixed APIs (e.g. `onClick$`) mark lazy-loadable, serializable code the optimizer can split.
- **Components** — `component$()` defines components whose handlers load only when needed.
- **Reactive state** — `useSignal()` and `useStore()` hold reactive state across server and client.
- **The Optimizer** — Qwik's build step splits code at `$` boundaries into fine-grained lazy chunks.
- **QwikCity** — the meta-framework for routing, layouts, and data loading/actions.

## Best practices
- Wrap event handlers and lazy logic in `$` (e.g. `onClick$`) so the optimizer can defer them.
- Use `useSignal`/`useStore` for state so values serialize and resume correctly.
- Keep captured closures serializable; avoid referencing non-serializable values across `$` boundaries.
- Use QwikCity `routeLoader$`/`routeAction$` for data instead of ad-hoc client fetching.

## Common pitfalls
- Capturing non-serializable values (DOM nodes, class instances) inside `$` closures → keep captured state serializable.
- Treating Qwik like React (eager hydration mindset) → handlers and components are loaded lazily on interaction.
- Forgetting the `$` suffix on handlers → the optimizer can't lazy-split, hurting the resumability benefit.

## Examples
```tsx
import { component$, useSignal } from '@builder.io/qwik';

export const Counter = component$(() => {
  const count = useSignal(0);
  return <button onClick$={() => count.value++}>Clicked {count.value} times</button>;
});
```

## Further reading
- https://qwik.dev/docs/getting-started/ — getting started
- https://qwik.dev/docs/concepts/resumable/ — resumability concept

## Related skills
- ../react — JSX component library (eager hydration model)
- ../solidjs — fine-grained reactive library
