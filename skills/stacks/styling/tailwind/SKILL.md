---
name: tailwind
description: Utility-first CSS framework that styles UI from small composable classes in markup; consult when building or theming with Tailwind.
domain: stack
category: styling
tags: [tailwind, css, utility-first, vite, design-system]
official_sources:
  - https://tailwindcss.com/docs
  - https://github.com/tailwindlabs/tailwindcss
verified: 2026-06-16
---

# Tailwind CSS

## Overview
Tailwind CSS is a utility-first CSS framework: instead of writing custom stylesheets, you compose UI from small single-purpose classes (`flex`, `pt-4`, `text-3xl`) applied directly in markup. It is designed for rapid UI development and produces only the CSS your project actually uses. Read this when scaffolding styling, theming, or migrating an app to Tailwind.

## Official sources
- Docs: https://tailwindcss.com/docs
- Repo: https://github.com/tailwindlabs/tailwindcss
- Install / download: https://tailwindcss.com/docs/installation

## Install / setup
```bash
npm install tailwindcss @tailwindcss/vite
```
Then register the Vite plugin in `vite.config.ts` and add `@import "tailwindcss";` to your main CSS file (per the official installation guide).

## Core concepts
- **Utility-first**: build designs by combining many small classes in markup rather than authoring bespoke CSS rules.
- **On-demand generation**: the engine scans your source files and emits only the utilities you actually use, keeping output small.
- **Responsive & state variants**: prefixes like `md:`, `hover:`, `focus:`, and `dark:` apply utilities conditionally at breakpoints or interaction states.
- **Theme tokens**: spacing, colors, typography, and breakpoints come from a configurable design-token scale you can extend.
- **First-party plugin integration**: the `@tailwindcss/vite` plugin (and equivalents) wires Tailwind into your bundler's build process.

## Best practices
- Let the build scan real source files so unused utilities are purged automatically; avoid hand-maintaining a list of safe classes unless dynamic class names require it.
- Extract repeated class clusters into components (or `@apply` in a CSS layer) rather than copying long class strings everywhere.
- Customize via the theme/tokens so spacing and color stay consistent across the app instead of using arbitrary one-off values.
- Use the documented responsive and state variants instead of writing custom media queries by hand.

## Common pitfalls
- Constructing class names from string concatenation at runtime → the scanner can't see them, so they get purged; use complete static class strings or a safelist.
- Treating Tailwind as inline styles → it is design-token-constrained utilities; reaching for arbitrary values everywhere defeats the system's consistency.

## Examples
```html
<h1 class="text-3xl font-bold underline">
  Hello world!
</h1>
```

## Further reading
- https://tailwindcss.com/docs/installation — framework-specific setup guides
- https://tailwindcss.com/docs/styling-with-utility-classes — core utility-first workflow

## Related skills
- ../shadcn-ui — component collection built on Tailwind + Radix
- ../unocss — alternative on-demand atomic CSS engine
