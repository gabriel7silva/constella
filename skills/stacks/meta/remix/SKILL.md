---
name: remix
description: React meta-framework built on web fundamentals (nested routes, loaders/actions); note v2's successor is React Router v7. Consult for Remix apps.
domain: stack
category: meta
tags: [react, ssr, web-standards, loaders, react-router]
official_sources:
  - https://remix.run/docs
  - https://github.com/remix-run/remix
verified: 2026-06-16
---

# Remix

## Overview
Remix is a React framework, by the remix-run team, focused on web standards (the Fetch API, forms, HTTP caching) and progressive enhancement, using nested routes with server `loader`/`action` functions for data flow. Read this when working on a Remix codebase or deciding between Remix and its successor. Important: the official v2 docs state that "the latest version of Remix is now React Router v7"; the `remix-run/remix` repo currently hosts Remix 3 (in beta as of mid-2026). Confirm which line a project targets before relying on version-specific details.

## Official sources
- Docs (v2): https://remix.run/docs
- Repo: https://github.com/remix-run/remix
- Install / quickstart (v2): https://remix.run/docs/en/main/start/quickstart

## Install / setup
```bash
npx create-remix@latest
```

## Core concepts
- **Nested routes.** The route hierarchy maps to nested UI; parent routes render layout around child route outlets, and each route can own its own data and error boundary.
- **Loaders.** A route's `loader` runs on the server to provide data for that route on GET requests; the component reads it via `useLoaderData`.
- **Actions.** A route's `action` runs on the server to handle mutations (typically form POSTs), pairing with HTML `<Form>` for progressive enhancement.
- **Web standards first.** Remix builds on the Fetch `Request`/`Response`, forms, and HTTP semantics rather than bespoke abstractions.
- **Server rendering + progressive enhancement.** Pages render on the server and work before/without client JS, then enhance once hydrated.

## Best practices
- **Decide your framework line first.** Per the official docs, new projects should generally adopt React Router v7 (Remix v2's successor); use the v2 docs only when maintaining an existing v2 app.
- Co-locate **`loader`/`action`/component** in the route module so data and UI for a route live together.
- Use Remix's **`<Form>`** and actions for mutations to get progressive enhancement and proper revalidation rather than manual client fetch wiring.
- Lean on **web-standard `Request`/`Response`** objects in loaders/actions instead of framework-specific request shims.

## Common pitfalls
- Starting a brand-new project on Remix v2 without realizing it has moved to React Router v7 → check the official banner/docs and choose the current line deliberately.
- Putting data-loading logic in client effects → move it to the route `loader` so it runs on the server with SSR and revalidation.
- Confusing `remix-run/remix` (now Remix 3 beta) with the v2/React Router v7 lineage → verify the exact package and version a repo depends on.

## Examples
```tsx
// app/routes/_index.tsx
import { useLoaderData } from "@remix-run/react";

export async function loader() {
  return { message: "Hello from the server" };
}

export default function Index() {
  const { message } = useLoaderData<typeof loader>();
  return <h1>{message}</h1>;
}
```

## Further reading
- React Router v7 (Remix's successor): https://reactrouter.com/
- Remix 3 (beta) repo README: https://github.com/remix-run/remix

## Related skills
- ../nextjs — alternative React meta-framework
- ../vite — Remix v2 uses Vite for its dev/build pipeline
