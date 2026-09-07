---
name: sveltekit
description: Svelte meta-framework — file routing, SSR/SSG/SPA, load functions, form actions, deploy adapters; consult when building or debugging a SvelteKit app.
domain: stack
category: meta
tags: [svelte, ssr, file-routing, adapters, vite]
official_sources:
  - https://svelte.dev/docs/kit
  - https://github.com/sveltejs/kit
verified: 2026-06-16
---

# SvelteKit

## Overview
SvelteKit is the official application framework for Svelte (maintained by sveltejs), with the tagline "Web development, streamlined." It provides file-system routing, server-side rendering, data-loading and form-action conventions, and deployment adapters, built on top of Vite. Read this when scaffolding a SvelteKit app or reasoning about routing, load functions, or deployment targets.

## Official sources
- Docs: https://svelte.dev/docs/kit
- Repo: https://github.com/sveltejs/kit
- Install / create a project: https://svelte.dev/docs/kit/creating-a-project

## Install / setup
```bash
npx sv create my-app
```

## Core concepts
- **File-system routing.** Routes live under `src/routes`; `+page.svelte`, `+layout.svelte`, `+page.server.ts`, and `+server.ts` files define pages, layouts, server logic, and endpoints by convention.
- **Load functions.** `load` functions (in `+page.js`/`+page.server.js` and layout equivalents) fetch data for a route; server `load` runs only on the server.
- **Form actions.** Server `actions` handle form submissions with progressive enhancement.
- **Rendering modes.** Routes can be server-rendered, prerendered (SSG), or run as an SPA, configurable per route.
- **Adapters.** Deployment adapters target platforms such as Node, static hosting, Cloudflare, Netlify, and Vercel.
- **Built on Vite.** The dev server and build pipeline use Vite, giving fast HMR and the Vite plugin ecosystem.

## Best practices
- Use the official **`sv create`** scaffolder to start a project, then `npm run dev` — this is the path the docs recommend.
- Put server-only/data-fetching logic in **`load` functions** (server variants for secrets/DB access) rather than in components.
- Use **form actions** with `<form>` for mutations to get progressive enhancement instead of hand-written client fetches.
- Choose the **adapter** that matches your deployment target so the build output fits the platform.

## Common pitfalls
- Importing server-only code (secrets, DB clients) into universal modules → keep it in `*.server.*` files / server `load` so it never ships to the client.
- Expecting browser APIs to exist during SSR → guard with the `browser` check from `$app/environment` or run them in lifecycle hooks.
- Forgetting to install/configure an adapter for your host → add the matching deployment adapter before building for production.

## Examples
```svelte
<!-- src/routes/+page.svelte -->
<script>
  export let data;
</script>

<h1>{data.message}</h1>
```
```js
// src/routes/+page.server.js
export function load() {
  return { message: 'Hello from the server' };
}
```

## Further reading
- Introduction: https://svelte.dev/docs/kit/introduction
- Adapters: https://svelte.dev/docs/kit/adapters

## Related skills
- ../nuxt — Vue meta-framework with a comparable model
- ../astro — content-focused framework that also supports Svelte islands
- ../vite — the build tool SvelteKit is built on
