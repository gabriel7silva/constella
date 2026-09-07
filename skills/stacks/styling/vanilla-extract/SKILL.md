---
name: vanilla-extract
description: Zero-runtime stylesheets authored in TypeScript that compile to static CSS with locally-scoped, type-safe styles; consult for type-safe CSS in builds.
domain: stack
category: styling
tags: [vanilla-extract, css-in-js, typescript, zero-runtime, scoped]
official_sources:
  - https://vanilla-extract.style/documentation/getting-started/
  - https://github.com/vanilla-extract-css/vanilla-extract
verified: 2026-06-16
---

# vanilla-extract

## Overview
vanilla-extract lets you write styles in TypeScript (or JavaScript) using `.css.ts` files, generating static CSS at build time with zero runtime cost. Class names are locally scoped (like CSS Modules) and the whole API is type-safe. Read this when you want CSS-in-TS authoring without shipping a styling runtime.

## Official sources
- Docs: https://vanilla-extract.style/documentation/getting-started/
- Repo: https://github.com/vanilla-extract-css/vanilla-extract
- Install / download: https://vanilla-extract.style/documentation/getting-started/

## Install / setup
```bash
npm install @vanilla-extract/css
```
Then add a bundler integration (Vite, esbuild, webpack, Next.js, Parcel, Rollup, or Gatsby) per the getting-started guide.

## Core concepts
- **Styles as `.css.ts` files**: author styles in TypeScript; the bundler extracts them into static CSS during build.
- **Locally-scoped class names**: the `style` function returns a unique class name, isolating styles per file like CSS Modules.
- **Zero runtime**: no styling library is shipped to the browser; output is plain CSS.
- **Scoped CSS variables**: `createVar`/theme APIs produce scoped custom properties for theming.
- **Type safety**: styles are typed via CSSType, so invalid properties and values are caught at compile time.
- **Bundler integration required**: a build plugin transforms `.css.ts` files into emitted CSS.

## Best practices
- Reference the value returned by `style` as your class name rather than hardcoding generated names.
- Use the theming/CSS-variable APIs (`createTheme`, `createVar`) to centralize design tokens type-safely.
- Keep style definitions in `.css.ts` files so the bundler can statically extract them at build time.
- Lean on the type checker to validate property names and values instead of relying on runtime checks.

## Common pitfalls
- Skipping the bundler integration → `.css.ts` files won't be transformed into CSS; install the matching plugin for your build tool.
- Expecting runtime dynamic styling like traditional CSS-in-JS → styles are extracted at build time, so prefer variables/variants for dynamic values.

## Examples
```ts
// styles.css.ts
import { style } from '@vanilla-extract/css';

export const container = style({
  padding: 10,
  display: 'flex',
});
```

## Further reading
- https://vanilla-extract.style/documentation/getting-started/ — setup and bundler guides
- https://vanilla-extract.style/documentation/styling/ — styling API reference

## Related skills
- ../css-modules — the locally-scoped CSS model vanilla-extract builds on
- ../styled-components — runtime CSS-in-JS alternative
