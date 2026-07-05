---
name: react
description: Component-based JavaScript library for building web and native UIs; consult for components, hooks, state, and rendering model.
domain: stack
category: frontend
tags: [react, components, hooks, jsx, ui, spa]
official_sources:
  - https://react.dev/
  - https://github.com/facebook/react
verified: 2026-06-16
---

# React

## Overview
React is a JavaScript library for building user interfaces out of small, composable, stateful components. It uses a declarative model: you describe what the UI should look like for a given state, and React reconciles the DOM (or native views) to match. Read this when building component trees, managing local/shared state, or choosing how to bootstrap a React app.

## Official sources
- Docs: https://react.dev/
- Repo: https://github.com/facebook/react
- Install / download: https://react.dev/learn/creating-a-react-app

## Install / setup
React's docs recommend starting a new app with a framework. The most common scaffolds (copied verbatim from react.dev):

```bash
npx create-next-app@latest
```

```bash
npx create-react-router@latest
```

Note: Create React App is deprecated; see react.dev/learn/creating-a-react-app for current recommendations.

## Core concepts
- **Components** — functions that return JSX describing UI; compose them to build whole interfaces.
- **JSX** — HTML-like syntax that compiles to `React.createElement` calls; expressions go in `{}`.
- **Props** — read-only inputs passed from parent to child; never mutate them.
- **State & hooks** — `useState`, `useEffect`, `useContext`, `useReducer` etc. add memory and side effects to function components.
- **Rendering & reconciliation** — React re-renders components when state/props change and diffs the result to apply minimal DOM updates.
- **Keys** — stable identities for list items so React can track elements across renders.
- **Purity** — components should render as pure functions of their props and state.

## Best practices
- Keep components pure: render based only on props and state, perform side effects in effects/event handlers (react.dev "Keeping Components Pure").
- Lift shared state up to the closest common ancestor rather than duplicating it.
- Give list items stable, unique `key` props (not array index when the list can reorder).
- Prefer composition over inheritance; pass JSX via `children` and props.
- Use the official React DevTools and the Rules of Hooks (call hooks at the top level, only from React functions).

## Common pitfalls
- Mutating state directly (`state.x = 1`) → create new objects/arrays and call the setter so React detects the change.
- Calling hooks conditionally or inside loops → always call hooks unconditionally at the top of the component.
- Overusing `useEffect` for derived data → compute values during render instead; effects are for synchronizing with external systems.

## Examples
```jsx
import { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);
  return (
    <button onClick={() => setCount((c) => c + 1)}>
      Clicked {count} times
    </button>
  );
}
```

## Further reading
- https://react.dev/learn — official Quick Start and full Learn guide
- https://react.dev/reference/react — API reference for hooks and components

## Related skills
- ../vue — alternative reactive UI framework
- ../preact — tiny React-compatible alternative
