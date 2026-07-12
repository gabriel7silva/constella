---
name: vite
description: Fast frontend build tool and dev server — native-ESM dev with instant HMR, optimized production builds; consult when scaffolding or configuring SPAs.
domain: stack
category: meta
tags: [build-tool, dev-server, esm, hmr, bundler]
official_sources:
  - https://vite.dev/guide/
  - https://github.com/vitejs/vite
verified: 2026-06-16
---

# Vite

## Overview
Vite (by vitejs) is "next generation frontend tooling" — a build tool with two parts: a dev server that serves source over native ES modules with extremely fast Hot Module Replacement, and a production build command that bundles optimized static assets. It is framework-agnostic (templates for vanilla, React, Vue, Svelte, and more) and is the build layer under many meta-frameworks. Read this when scaffolding a single-page app or configuring builds, plugins, or the dev server.

## Official sources
- Docs / guide: https://vite.dev/guide/
- Repo: https://github.com/vitejs/vite
- Install / scaffolding: https://vite.dev/guide/#scaffolding-your-first-vite-project

## Install / setup
```bash
npm create vite@latest
```

## Core concepts
- **Native-ESM dev server.** In development Vite serves source files as native ES modules, so it does not bundle the whole app up front, enabling fast startup.
- **Hot Module Replacement (HMR).** Edits update modules in place quickly without a full reload.
- **Production build.** `vite build` produces optimized, bundled static assets (Vite uses Rolldown to bundle for production).
- **Framework-agnostic templates.** Scaffolding offers templates for vanilla, React, Vue, Svelte, Solid, and others.
- **Plugin API + JS API.** A typed Plugin API and programmatic JavaScript API let you extend and embed Vite.
- **Dependency pre-bundling.** Vite pre-bundles dependencies to convert them to ESM and speed up dev page loads.

## Best practices
- Scaffold with **`npm create vite@latest`** and pick a template, as the official guide shows.
- Run a supported **Node.js version (20.19+ or 22.12+)** per the docs; upgrade if a template warns it needs higher.
- Use the **`public/`** folder for assets served as-is and `import` other assets so Vite can hash/optimize them.
- Extend behavior through the **Plugin API** rather than patching the build manually.

## Common pitfalls
- Running on an unsupported Node.js version → install Node 20.19+/22.12+ (some templates require higher) as the docs state.
- Expecting the dev server's unbundled behavior to mirror the production bundle exactly → test the output of `vite build` / `vite preview` before deploying.
- Referencing static assets by a guessed path instead of importing them or placing them in `public/` → use imports or `public/` so paths resolve after build.

## Examples
```bash
# Scaffold, then run the dev server
npm create vite@latest my-app
cd my-app
npm install
npm run dev
```

## Further reading
- Features: https://vite.dev/guide/features
- Plugin API: https://vite.dev/guide/api-plugin

## Related skills
- ../sveltekit — meta-framework built on Vite
- ../nextjs — React meta-framework (uses its own bundler, Turbopack)
- ../astro — content framework built on Vite tooling
