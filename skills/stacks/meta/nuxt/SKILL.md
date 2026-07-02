---
name: nuxt
description: Vue meta-framework for full-stack apps — SSR, file-based routing, auto-imports, modules; consult when building or debugging a Nuxt app.
domain: stack
category: meta
tags: [vue, ssr, file-routing, full-stack, nitro]
official_sources:
  - https://nuxt.com/docs
  - https://github.com/nuxt/nuxt
verified: 2026-06-16
---

# Nuxt

## Overview
Nuxt is a free, open-source framework that provides an intuitive, extendable way to build type-safe, performant, production-grade full-stack web apps and sites with Vue.js. It adds server-side rendering, file-based routing, automatic imports, data fetching, and a module ecosystem on top of Vue. Read this when scaffolding a Nuxt project or reasoning about its rendering modes, directory structure, or modules.

## Official sources
- Docs: https://nuxt.com/docs
- Repo: https://github.com/nuxt/nuxt
- Install / getting started: https://nuxt.com/docs/getting-started/installation

## Install / setup
```bash
npm create nuxt@latest <project-name>
```

## Core concepts
- **Vue + SSR by default.** Nuxt renders Vue components on the server and hydrates them on the client, with control over rendering mode per route.
- **File-based routing.** Files in the `pages/` directory automatically become routes; the framework wires up the router for you.
- **Auto-imports.** Components, composables, and Vue/Nuxt APIs are auto-imported, reducing boilerplate import statements.
- **Server engine (Nitro).** Nuxt ships a server layer for API routes (`server/`) and deployment to many providers/runtimes.
- **Data fetching.** Composables like `useFetch` / `useAsyncData` fetch data with SSR-aware caching and hydration.
- **Modules.** A large module ecosystem (300+) extends Nuxt with integrations configured in `nuxt.config`.

## Best practices
- Use an **even-numbered, active-LTS Node.js** release (22, 24, etc.) — the official install docs require Node 22.x or newer and recommend the active LTS.
- Let Nuxt **auto-import** components and composables rather than adding manual imports, keeping files lean.
- Configure behavior in **`nuxt.config`** (rendering modes, modules, runtime config) rather than scattering ad-hoc setup.
- Add functionality via official/community **modules** instead of hand-rolling integrations where a maintained module exists.

## Common pitfalls
- Using an odd-numbered Node.js version → install an even-numbered LTS release as the docs instruct, since odd versions are not the supported target.
- Accessing browser-only APIs during SSR → guard such code so it runs only on the client (e.g. `import.meta.client` / lifecycle hooks).
- Manually importing things Nuxt already auto-imports → remove redundant imports to avoid confusion and conflicts.

## Examples
```vue
<!-- pages/index.vue — auto-routed to "/" -->
<script setup>
const { data } = await useFetch('/api/hello')
</script>

<template>
  <h1>{{ data }}</h1>
</template>
```

## Further reading
- Introduction: https://nuxt.com/docs/getting-started/introduction
- Directory structure: https://nuxt.com/docs/guide/directory-structure

## Related skills
- ../sveltekit — Svelte meta-framework with similar file-routing/SSR model
- ../nextjs — React equivalent meta-framework
- ../vite — build tool underpinning Nuxt's dev server
