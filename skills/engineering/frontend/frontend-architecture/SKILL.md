---
name: frontend-architecture
description: Structuring component boundaries, data flow, and code-splitting in modern frontend apps; consult when designing or refactoring UI architecture.
domain: engineering
category: frontend
tags: [components, data-flow, code-splitting, react, architecture, lazy-loading]
official_sources:
  - https://react.dev/learn
  - https://www.patterns.dev/
  - https://github.com/react/react
verified: 2026-06-16
---

# Frontend Architecture

## Overview
Frontend architecture is how you split a UI into components, decide where data lives and how it flows, and control what code ships to the browser and when. Good structure keeps features local, props predictable, and bundles small. Read this when starting a new app, drawing component boundaries, or addressing slow initial loads.

## Official sources
- Docs: https://react.dev/learn
- Patterns reference: https://www.patterns.dev/
- Repo: https://github.com/react/react

## Core concepts
- **Components compose top-down.** A React component is a function returning markup; you nest components and pass data via props, building UI from small reusable pieces (react.dev/learn).
- **One-way data flow.** Data flows down through props; child components do not mutate parent state directly, which makes data movement easy to trace (react.dev/learn).
- **Lifting state up.** When two siblings need the same data, move that state to their closest common parent and pass it down, rather than duplicating it (react.dev/learn/sharing-state-between-components).
- **Single source of truth.** State should not contain redundant or duplicated information; derive values during render instead of storing them (react.dev/learn/choosing-the-state-structure).
- **Code-splitting with lazy loading.** `lazy` defers loading a component's code until it first renders, reducing the initial bundle; it must be paired with `<Suspense>` (react.dev/reference/react/lazy).
- **Rendering / loading patterns.** patterns.dev catalogs reusable approaches such as bundle splitting, the PRPL pattern, and import-on-interaction to ship less JavaScript up front (patterns.dev).

## Best practices
- Push `'use client'` / interactive boundaries as deep into the tree as possible so static parts stay shippable and bundles stay small (react.dev/learn; patterns.dev performance patterns).
- Keep state minimal and derived data computed in render, avoiding state you would have to keep in sync (react.dev/learn/choosing-the-state-structure).
- Split routes and heavy, rarely-used components with `lazy` + `Suspense` so users only download what they need (react.dev/reference/react/lazy).
- Co-locate state with the components that use it, lifting it only as far up as required by shared consumers (react.dev/learn/sharing-state-between-components).

## Common pitfalls
- Declaring a `lazy` component inside another component → declare it at module level; nesting it resets state on every re-render (react.dev/reference/react/lazy).
- Storing redundant or duplicated state (e.g. a `fullName` alongside `firstName`/`lastName`) → compute it during render to avoid sync bugs (react.dev/learn/choosing-the-state-structure).
- Prop-drilling shared data through many layers → reconsider component boundaries or use context where appropriate (react.dev/learn/passing-data-deeply-with-context).

## Examples
```jsx
import { lazy, Suspense } from 'react';

// Module-level: code is split and loaded on first render.
const MarkdownPreview = lazy(() => import('./MarkdownPreview.js'));

export default function Editor() {
  return (
    <Suspense fallback={<Loading />}>
      <MarkdownPreview />
    </Suspense>
  );
}
```

## Further reading
- https://react.dev/learn/thinking-in-react — deriving component structure from a mockup
- https://www.patterns.dev/ — rendering, design, and performance patterns

## Related skills
- ../state-management — choosing where state lives
- ../rendering-strategies-ssr-csr — where components render
