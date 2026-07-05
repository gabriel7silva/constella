---
name: state-management
description: Choosing between local UI state, server/async state, and global state in React apps; consult when deciding where data should live and how it updates.
domain: engineering
category: frontend
tags: [state, react, tanstack-query, server-state, context, reducers]
official_sources:
  - https://react.dev/learn/managing-state
  - https://tanstack.com/query/latest
  - https://github.com/TanStack/query
verified: 2026-06-16
---

# State Management

## Overview
Frontend state falls into distinct kinds: local UI state (a component's own data), server/async state (remote data that is cached and can go stale), and shared/global state across components. Picking the right tool for each avoids over-engineering and sync bugs. Read this when deciding where a piece of data should live or which library, if any, to introduce.

## Install / setup
TanStack Query (React) — install command copied verbatim from the official installation page (tanstack.com/query/latest/docs/framework/react/installation):
```bash
npm i @tanstack/react-query
```

## Official sources
- React state docs: https://react.dev/learn/managing-state
- TanStack Query docs: https://tanstack.com/query/latest
- Repo (TanStack Query): https://github.com/TanStack/query

## Core concepts
- **State drives the UI.** You describe UI as states and update state in response to input, letting React re-render rather than mutating the DOM imperatively (react.dev/learn/managing-state).
- **Keep state structure lean.** Avoid redundant or duplicated state; compute derived values during render (react.dev/learn/choosing-the-state-structure).
- **Lift state up to share it.** Move shared state to the closest common parent and pass it down via props (react.dev/learn/sharing-state-between-components).
- **Reducers for complex logic.** `useReducer` consolidates many related state updates into one reducer, keeping event handlers clean (react.dev/learn/extracting-state-logic-into-a-reducer).
- **Context for deep passing.** React context shares data deeply without prop-drilling and pairs with a reducer to scale up app state (react.dev/learn/scaling-up-with-reducer-and-context).
- **Server state is different.** TanStack Query treats remote data as something with a cache and lifecycle — fetched, shared, cached, refetched, and sometimes intentionally stale — distinct from client state (tanstack.com/query/latest).

## Best practices
- Default to local component state; only lift it up or introduce context when multiple components genuinely need it (react.dev/learn/managing-state).
- Use a dedicated server-state library like TanStack Query for fetching, caching, and synchronizing remote data instead of hand-rolling it in component state (tanstack.com/query/latest).
- Reach for `useReducer` once a component juggles several interrelated state transitions (react.dev/learn/extracting-state-logic-into-a-reducer).
- Don't store derived data in state — recompute it in render to prevent it from drifting out of sync (react.dev/learn/choosing-the-state-structure).

## Common pitfalls
- Caching server data in `useState`/context and manually refetching → use TanStack Query, which gives async data a cache and lifecycle (tanstack.com/query/latest).
- Duplicating one source of truth across components → lift it to a common parent or context so there is a single owner (react.dev/learn/sharing-state-between-components).

## Examples
```jsx
import { useQuery } from '@tanstack/react-query';

function Todos() {
  const { data, isPending, error } = useQuery({
    queryKey: ['todos'],
    queryFn: () => fetch('/api/todos').then((r) => r.json()),
  });
  if (isPending) return <p>Loading…</p>;
  if (error) return <p>Failed to load</p>;
  return <ul>{data.map((t) => <li key={t.id}>{t.title}</li>)}</ul>;
}
```

## Further reading
- https://react.dev/learn/choosing-the-state-structure — principles for shaping state
- https://tanstack.com/query/latest/docs — caching, mutations, and invalidation

## Related skills
- ../frontend-architecture — component boundaries and data flow
- ../rendering-strategies-ssr-csr — where state is hydrated and rendered
