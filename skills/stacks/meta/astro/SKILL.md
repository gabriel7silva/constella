---
name: astro
description: Content-focused web framework with an islands architecture — ships zero JS by default, supports React/Vue/Svelte; consult for content sites and blogs.
domain: stack
category: meta
tags: [islands, content, ssg, ssr, ui-agnostic]
official_sources:
  - https://docs.astro.build/
  - https://github.com/withastro/astro
verified: 2026-06-16
---

# Astro

## Overview
Astro (by withastro) is "the web framework for content-driven websites" — a build tool whose islands architecture ships HTML with zero client-side JavaScript by default, hydrating only the interactive components ("islands") you opt in. It is UI-agnostic, integrating React, Vue, Svelte, and more. Read this when building content sites, blogs, or marketing pages, or reasoning about partial hydration.

## Official sources
- Docs: https://docs.astro.build/
- Repo: https://github.com/withastro/astro
- Install / setup: https://docs.astro.build/en/install-and-setup/

## Install / setup
```bash
npm create astro@latest
```

## Core concepts
- **Islands architecture.** Pages are mostly static HTML; interactive UI components are isolated "islands" that hydrate independently.
- **Zero JS by default.** Components render to HTML at build/request time and ship no client JavaScript unless explicitly hydrated.
- **`client:*` directives.** Directives like `client:load`, `client:idle`, and `client:visible` control whether and when an island hydrates on the client.
- **UI-framework agnostic.** Astro components (`.astro`) coexist with React, Vue, Svelte, Solid, and others via integrations.
- **Content collections.** Type-safe collections organize and query Markdown/MDX and other content for content-driven sites.
- **Static or server output.** Astro can output a fully static site (SSG) or render on demand (SSR) via adapters.

## Best practices
- Keep most of the page as **static Astro components** and add interactivity only as islands, preserving the zero-JS default.
- Choose the **least eager `client:*` directive** that meets the need (e.g. `client:visible`/`client:idle` over `client:load`) to minimize JS execution.
- Use **content collections** for Markdown/MDX so content is type-checked and queryable rather than ad-hoc imports.
- Run **Node.js v22.12.0 or higher**, as the official install docs require (odd-numbered versions like v23 are not supported).

## Common pitfalls
- Forgetting a `client:*` directive on an interactive component → it renders as static HTML and won't be interactive; add the appropriate directive.
- Defaulting everything to `client:load` → over-hydrates the page and defeats Astro's performance model; pick a lazier directive.
- Using an unsupported (odd-numbered) Node.js version → install Node v22.12.0+ as the docs require.

## Examples
```astro
---
// src/pages/index.astro
import Counter from '../components/Counter.jsx';
---
<h1>Static heading, zero JS</h1>
<Counter client:visible />
```

## Further reading
- Islands architecture: https://docs.astro.build/en/concepts/islands/
- Getting started: https://docs.astro.build/en/getting-started/

## Related skills
- ../nextjs — React meta-framework for full-stack apps
- ../gatsby — alternative React static-site framework
- ../vite — build tooling Astro builds upon
