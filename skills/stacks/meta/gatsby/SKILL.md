---
name: gatsby
description: React-based static-site framework with a GraphQL data layer and plugin ecosystem; consult when building or maintaining a Gatsby site.
domain: stack
category: meta
tags: [react, ssg, graphql, plugins, static-site]
official_sources:
  - https://www.gatsbyjs.com/docs/
  - https://github.com/gatsbyjs/gatsby
verified: 2026-06-16
---

# Gatsby

## Overview
Gatsby is a free, open-source, React-based framework "with performance, scalability, and security built in," used to build fast websites and apps. It pulls data from many sources into a unified GraphQL data layer and renders pages with React, with a large plugin ecosystem. Read this when building or maintaining a Gatsby site, especially content sites that aggregate data from CMSes, Markdown, or APIs.

## Official sources
- Docs: https://www.gatsbyjs.com/docs/
- Repo: https://github.com/gatsbyjs/gatsby
- Install / quick start: https://www.gatsbyjs.com/docs/quick-start/

## Install / setup
```bash
npm init gatsby
```

## Core concepts
- **React + GraphQL data layer.** Pages are React components that query a unified GraphQL layer aggregating data from many sources.
- **Source and transformer plugins.** Plugins pull data in (CMS, filesystem, APIs) and transform it (e.g. Markdown → HTML) into the GraphQL layer.
- **Pages.** Components in `src/pages` become routes automatically; pages can also be created programmatically in `gatsby-node`.
- **Static generation.** Gatsby builds pages ahead of time for fast, secure static delivery (with additional rendering modes available).
- **Configuration files.** `gatsby-config`, `gatsby-node`, `gatsby-browser`, and `gatsby-ssr` configure plugins, build-time APIs, and runtime hooks.

## Best practices
- Scaffold with **`npm init gatsby`** (optionally `npm init gatsby -- -y -ts my-site-name` for defaults + TypeScript) as the quick-start docs show.
- Source and transform data through **plugins** rather than ad-hoc fetching so it flows into the GraphQL layer consistently.
- Query data with **GraphQL** (page queries / `useStaticQuery`) to get exactly the data a component needs.
- Note the quick start targets **intermediate-to-advanced developers**; beginners should start with the official tutorial first (per the docs).

## Common pitfalls
- Expecting `gatsby new` / `create-gatsby` → the current quick-start command is `npm init gatsby`.
- Fetching data imperatively in components instead of via the GraphQL layer → use source/transformer plugins and GraphQL queries for build-time data.
- Treating the quick start as a beginner path → it is aimed at intermediate/advanced users; use the tutorial to learn the fundamentals.

## Examples
```jsx
// src/pages/index.js
import * as React from "react"

export default function Home() {
  return <h1>Hello, Gatsby!</h1>
}
```

## Further reading
- Quick start: https://www.gatsbyjs.com/docs/quick-start/
- Tutorial: https://www.gatsbyjs.com/docs/tutorial/

## Related skills
- ../nextjs — React framework with broader full-stack/SSR support
- ../astro — content-focused islands framework
- ../vite — modern build tooling for SPAs
