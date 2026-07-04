---
name: solidjs
description: Fine-grained reactive UI library with JSX and no virtual DOM; consult for signals, derived state, and Solid/SolidStart apps.
domain: stack
category: frontend
tags: [solidjs, signals, reactivity, jsx, ui]
official_sources:
  - https://docs.solidjs.com/
  - https://github.com/solidjs/solid
verified: 2026-06-16
---

# SolidJS

## Overview
SolidJS is a declarative JavaScript UI library that uses JSX but compiles to fine-grained reactivity instead of a virtual DOM: only the exact DOM nodes affected by a state change are updated. Components run once to set up reactive graphs, which makes updates fast and predictable. Read this when working with signals, derived state, or scaffolding a Solid/SolidStart app.

## Official sources
- Docs: https://docs.solidjs.com/
- Repo: https://github.com/solidjs/solid
- Install / download: https://docs.solidjs.com/quick-start

## Install / setup
Solid's official scaffolder is `create-solid` (see docs.solidjs.com/quick-start). The repo README also documents starting from a template (copied verbatim from github.com/solidjs/solid):

```bash
npx degit solidjs/templates/js my-app
cd my-app
npm i
npm run dev
```

For TypeScript, use `solidjs/templates/ts` in place of `solidjs/templates/js`.

## Core concepts
- **Signals** — `createSignal` returns a getter/setter pair; reading a signal in a tracked scope subscribes to it.
- **Fine-grained reactivity** — components run once; only reactive reads re-run when their signals change (no re-render of the whole component).
- **Derived state** — `createMemo` caches computed values; plain functions can also derive values.
- **Effects** — `createEffect` runs side effects when its tracked dependencies change.
- **JSX** — Solid compiles JSX to real DOM nodes and reactive bindings.
- **Control flow** — `<Show>`, `<For>`, `<Switch>` components handle conditional and list rendering reactively.
- **Stores** — `createStore` for nested reactive objects.

## Best practices
- Call signal getters inside the JSX/effect where you want reactivity, not destructured once outside tracking scope.
- Use `<For>` instead of `Array.map` for keyed, efficient list rendering.
- Use `createMemo` for expensive derived values to avoid recomputation.
- Keep component bodies setup-only; put repeated logic in effects/memos, since the body runs just once.

## Common pitfalls
- Reading a signal outside a tracked scope → you get a static snapshot; read it where reactivity is needed.
- Treating components like React (expecting re-renders) → Solid does not re-run component bodies on update.
- Spreading/destructuring props early → access props lazily to preserve reactivity (or use `splitProps`).

## Examples
```jsx
import { createSignal } from 'solid-js';

function Counter() {
  const [count, setCount] = createSignal(0);
  return (
    <button onClick={() => setCount(count() + 1)}>
      Clicked {count()} times
    </button>
  );
}
```

## Further reading
- https://docs.solidjs.com/guides — guides and concepts
- https://docs.solidjs.com/solid-start — SolidStart full-stack framework

## Related skills
- ../svelte — compiler-first reactive framework
- ../react — JSX-based component library
