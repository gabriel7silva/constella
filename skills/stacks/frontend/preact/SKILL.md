---
name: preact
description: Tiny (~4kB) React-compatible UI library with the same modern API; consult for lightweight apps and React-to-Preact aliasing.
domain: stack
category: frontend
tags: [preact, react-alternative, virtual-dom, hooks, lightweight, ui]
official_sources:
  - https://preactjs.com/guide/v10/getting-started/
  - https://github.com/preactjs/preact
verified: 2026-06-16
---

# Preact

## Overview
Preact is a fast, ~4kB alternative to React with the same modern API (components, virtual DOM, hooks). It targets bundle-size-sensitive projects and can often run existing React code via the `preact/compat` aliasing layer. Read this when you need React-like ergonomics with a tiny footprint or are migrating between React and Preact.

## Official sources
- Docs: https://preactjs.com/guide/v10/getting-started/
- Repo: https://github.com/preactjs/preact
- Install / download: https://preactjs.com/guide/v10/getting-started/

## Install / setup
Scaffold a project with the official `create-preact` initializer (copied verbatim from preactjs.com/guide/v10/getting-started/):

```bash
npm init preact
```

To add Preact to an existing build:

```bash
npm install preact
```

## Core concepts
- **Components & virtual DOM** — same component model and diffing approach as React.
- **Hooks** — `useState`, `useEffect`, etc. via `preact/hooks`.
- **JSX / `h`** — JSX compiles to Preact's `h` (hyperscript) factory; configurable per build.
- **`preact/compat`** — alias layer mapping `react`/`react-dom` to Preact so many React libraries work unchanged.
- **Signals** — `@preact/signals` offers fine-grained reactive state as an alternative to hooks.
- **Small footprint** — the runtime is intentionally tiny, reducing load and parse time.

## Best practices
- Import hooks from `preact/hooks` (not from a `react` import) unless using `preact/compat`.
- Use `preact/compat` aliases in your bundler when consuming React-ecosystem libraries.
- Consider `@preact/signals` for performant shared state in larger apps.
- Pin the Preact major version and verify third-party React libs against `compat`.

## Common pitfalls
- Assuming 100% React API parity → some React internals/behaviors differ; test libraries under `compat`.
- Mixing real `react` and Preact in one bundle without aliasing → configure the bundler alias so only one runtime loads.
- Forgetting JSX pragma config when not using a preset → set the JSX import source / `h` pragma per the docs.

## Examples
```jsx
import { render } from 'preact';
import { useState } from 'preact/hooks';

function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>Clicked {count} times</button>;
}

render(<Counter />, document.getElementById('app'));
```

## Further reading
- https://preactjs.com/guide/v10/getting-started/ — getting started guide
- https://preactjs.com/guide/v10/switching-to-preact/ — switching from React via compat

## Related skills
- ../react — the API Preact mirrors
- ../solidjs — fine-grained reactive alternative
