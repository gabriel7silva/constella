---
name: nextjs
description: React meta-framework for full-stack apps — file-system routing, Server Components, SSR/SSG/ISR; consult when building or debugging a Next.js app.
domain: stack
category: meta
tags: [react, ssr, rsc, app-router, vercel]
official_sources:
  - https://nextjs.org/docs
  - https://github.com/vercel/next.js
verified: 2026-06-16
---

# Next.js

## Overview
Next.js is a React framework (by Vercel) for building full-stack web applications. It layers file-system routing, server-side rendering, static generation, and React Server Components on top of React, plus built-in bundling, image optimization, and data-fetching primitives. Read this when scaffolding a Next.js app or reasoning about rendering modes, the App Router, or caching.

## Official sources
- Docs: https://nextjs.org/docs
- Repo: https://github.com/vercel/next.js
- Install / getting started: https://nextjs.org/docs/app/getting-started/installation

## Install / setup
```bash
npx create-next-app@latest
```

## Core concepts
- **App Router vs Pages Router.** The App Router (`app/` directory) is the recommended model and uses React Server Components by default; the older Pages Router (`pages/`) remains supported.
- **File-system routing.** Routes are derived from the folder/file structure. In the App Router, special files such as `layout.tsx`, `page.tsx`, `loading.tsx`, and `error.tsx` define UI and conventions per route segment.
- **Server vs Client Components.** Components render on the server by default; add the `"use client"` directive to opt a component into client-side interactivity (state, effects, browser APIs).
- **Rendering strategies.** Pages can be statically rendered (SSG), dynamically rendered per request (SSR), or incrementally regenerated (ISR), giving per-route control over freshness vs performance.
- **Root layout.** The App Router requires a root `layout.tsx` containing the `<html>` and `<body>` tags; it wraps all routes.
- **Built-in optimizations.** First-class `next/image`, `next/font`, and a default bundler (Turbopack) ship out of the box; a `public/` folder serves static assets from the base URL.

## Best practices
- Prefer the **App Router** for new projects — it is the recommended setup that `create-next-app` enables by default (per the official installation docs).
- Keep components as **Server Components** unless they need interactivity; only push `"use client"` to the leaf components that actually need it, to minimize client JS.
- Use **Module Path Aliases** (`@/*` via `tsconfig.json` `paths`/`baseUrl`) for clean imports — Next.js supports these natively.
- Use the appropriate **package.json scripts** (`next dev`, `next build`, `next start`) for each stage; run linting through your own npm scripts (Next.js 16 no longer lints automatically during `next build`).

## Common pitfalls
- Using browser-only APIs or React hooks in a Server Component → mark the component with `"use client"` or move that logic into a dedicated client component.
- Forgetting the required root `layout.tsx` with `<html>`/`<body>` → Next.js auto-creates one in dev, but production builds expect it; add it explicitly.
- Assuming `next build` runs the linter (older behavior) → since Next.js 16 you must invoke the linter via your own npm script.

## Examples
```tsx
// app/page.tsx — a Server Component route at "/"
export default function Page() {
  return <h1>Hello, Next.js!</h1>
}
```

## Further reading
- App Router getting started: https://nextjs.org/docs/app/getting-started
- create-next-app reference: https://nextjs.org/docs/app/api-reference/cli/create-next-app

## Related skills
- ../remix — React meta-framework built on web fundamentals
- ../gatsby — React static-site framework
- ../vite — build tool used by many React SPAs
