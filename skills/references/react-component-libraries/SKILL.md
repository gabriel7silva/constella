---
name: react-component-libraries
description: Curated React component sources for modern animated UI; consult to find prebuilt components, blocks, and effects instead of building from scratch.
domain: reference
category: reference
tags: [react, components, tailwind, animation, framer-motion, shadcn]
official_sources:
  - https://magicui.design/
  - https://reactbits.dev/
  - https://21st.dev/
verified: 2026-06-16
---

# React Component Libraries (Modern UI)

## Overview
For modern React UIs you rarely need to hand-build hero sections, animated text, marquees, or backgrounds — several curated sources provide them ready to drop in. Magic UI (magicui.design) offers 150+ free, open-source animated components built with React, TypeScript, Tailwind, and Motion, positioned as a companion to shadcn/ui. React Bits (reactbits.dev) is an open collection of 100+ animated, interactive components (text, backgrounds, effects) available in JS/TS and CSS/Tailwind variants. 21st.dev is a community registry of shadcn/Tailwind components and marketing blocks, with an AI "Magic" MCP that generates them inside IDEs. Read this skill to pick the right source for animated or prebuilt UI.

## Official sources
- Magic UI: https://magicui.design/
- React Bits: https://reactbits.dev/
- 21st.dev: https://21st.dev/
- 21st Magic MCP (repo): https://github.com/21st-dev/magic-mcp

## Core concepts
- **Distribution by copy-paste, not just npm.** These sources favor copying component source into your project (often via a CLI like shadcn or jsrepo) so you own and can edit the code, mirroring the shadcn model.
- **Animated/effect components.** Magic UI and React Bits specialize in motion: animated text, shimmer/marquee/border effects, particle and gradient backgrounds, built on Motion/Framer Motion or plain CSS.
- **Variant flavors.** React Bits ships each component in JS or TS and CSS or Tailwind, so you match your stack without rewrites.
- **Blocks vs. components.** 21st.dev separates page-level blocks (heroes, pricing, testimonials, CTAs) from atomic UI components (buttons, inputs, modals) — blocks accelerate landing pages, components fill gaps in a design system.
- **AI generation via MCP.** 21st.dev's Magic MCP server lets IDE agents (Cursor, Windsurf, VS Code/Cline, Claude) generate and write components from natural-language prompts, drawing on the 21st.dev library.

## Best practices
- Prefer these as a companion to shadcn/ui (Magic UI explicitly positions itself this way): use shadcn for primitives and these libraries for animated flourishes and marketing blocks.
- Install via the official CLI/registry path (shadcn or jsrepo where offered) so dependencies and file placement are handled correctly, then customize the copied source.
- Match the component flavor to your stack (TS + Tailwind vs. JS + CSS) at copy time to avoid post-hoc conversion — React Bits offers all four combinations.
- Treat copied components as your code: review, prune unused props, and align them to your theme tokens rather than leaving them as opaque imports.
- Gate heavy animated backgrounds/effects behind `prefers-reduced-motion` and lazy-loading to protect performance and accessibility.

## Common pitfalls
- Assuming everything is an npm package → many components are copy-paste/CLI-installed source you own; check the source's install method.
- Layering many simultaneous animated effects (particles + marquee + gradient + parallax) → visual noise and jank; use motion sparingly and purposefully.
- Pasting components without theming them → they clash with your design tokens; remap colors/spacing to your variables.
- Pulling a component without checking its license/attribution requirements → verify the source's license before shipping.

## Examples
```bash
# Typical install paths (verify the exact command on each source's docs):
# Magic UI / 21st.dev components often add via the shadcn CLI registry:
npx shadcn@latest add "<registry-component-url>"

# React Bits supports CLI install via shadcn or jsrepo, or plain copy-paste of the JSX.
```

## Further reading
- magicui.design and reactbits.dev component galleries for the full catalogs.
- 21st.dev Magic MCP repo (github.com/21st-dev/magic-mcp) for AI-in-IDE component generation.

## Related skills
- ../shadcn-tailwind-theming — theme these components consistently via CSS variables.
- ../web-animation-codrops — understand the motion techniques these components implement.
- ../saas-landing-patterns — assemble blocks into a converting landing page.
