---
name: shadcn-ui
description: Accessible React components you copy into your project (built on Tailwind + Radix) via a CLI rather than installing as a dependency; consult for owned UI code.
domain: stack
category: styling
tags: [shadcn-ui, react, tailwind, radix, components]
official_sources:
  - https://ui.shadcn.com/docs
  - https://github.com/shadcn-ui/ui
verified: 2026-06-16
---

# shadcn/ui

## Overview
shadcn/ui is a set of beautifully-designed, accessible React components and a code-distribution platform. Rather than installing a component package, you use a CLI to copy component source directly into your project, so you own and can freely modify the code. Components are built on Tailwind CSS and Radix primitives. Read this when you want full ownership of your UI component code.

## Official sources
- Docs: https://ui.shadcn.com/docs
- Repo: https://github.com/shadcn-ui/ui
- Install / download: https://ui.shadcn.com/docs/installation

## Install / setup
```bash
pnpm dlx shadcn@latest init
```
The init command scaffolds configuration (npm, yarn, and bun equivalents are documented). Add individual components afterward with `shadcn@latest add <component>`.

## Core concepts
- **Copy-in, not a dependency**: the CLI writes component source into your repo; you maintain it yourself instead of upgrading a package.
- **Tailwind + Radix foundation**: styling uses Tailwind utilities and behavior/accessibility comes from Radix primitives.
- **CLI workflow**: `init` sets up the project, `add` brings in specific components on demand.
- **Full ownership / open code**: because the code lives in your project, you can edit any component to fit your needs.
- **Framework support**: works with frameworks such as Next.js, Vite, React Router, Astro, and TanStack Start.

## Best practices
- Run `init` once to establish config and conventions before adding components.
- Add only the components you need with the `add` command rather than pulling in everything.
- Treat copied components as your own source — review and adapt them instead of expecting external updates.
- Keep Tailwind tokens/theme aligned so copied components match the rest of your design system.

## Common pitfalls
- Expecting automatic upstream upgrades like an npm package → components are copied into your project; you own maintenance and must re-pull manually for updates.
- Skipping `init` and adding components first → the project lacks the required config/conventions the components rely on.

## Examples
```bash
pnpm dlx shadcn@latest init
pnpm dlx shadcn@latest add button
```

## Further reading
- https://ui.shadcn.com/docs/installation — framework-specific setup
- https://ui.shadcn.com/docs/components — component catalog

## Related skills
- ../tailwind — the utility framework shadcn/ui styles with
- ../mui — alternative prebuilt React component library
