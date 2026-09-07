---
name: shadcn-tailwind-theming
description: Theme and generate shadcn/ui + Tailwind components via CSS variables and theme editors; consult when styling or scaffolding a shadcn-based UI.
domain: reference
category: reference
tags: [shadcn, tailwind, theming, css-variables, design-tokens]
official_sources:
  - https://ui.shadcn.com/
  - https://ui.shadcn.com/docs/theming
  - https://tweakcn.com/
verified: 2026-06-16
---

# shadcn/ui + Tailwind Theming

## Overview
shadcn/ui (ui.shadcn.com) is not a dependency you install and import — it is a set of accessible, Radix-based components styled with Tailwind that you copy into your codebase via a CLI and then own and customize. Theming runs entirely through CSS custom properties mapped to Tailwind, so one set of variables restyles every component and powers light/dark modes. Tools like tweakcn (tweakcn.com) and Magic UI Pro (pro.magicui.design) let you generate those variables visually or buy prebuilt blocks. Read this skill when you need to scaffold, theme, or recolor a shadcn-based interface.

## Official sources
- Docs: https://ui.shadcn.com/
- Theming guide: https://ui.shadcn.com/docs/theming
- CLI: https://ui.shadcn.com/docs/cli
- Theme editor (tweakcn): https://tweakcn.com/
- Premium blocks/templates (Magic UI Pro): https://pro.magicui.design/

## Core concepts
- **Copy-in, you-own-it model.** The CLI writes component source into your project (e.g. `components/ui/`). You edit the files directly; there is no black-box package to fight, and updates are deliberate copy-ins, not version bumps.
- **CSS-variable theming.** Colors are defined as CSS custom properties (background, foreground, primary, secondary, muted, accent, destructive, border, ring, etc.) and consumed by Tailwind. Restyling means changing the variables, not editing each component.
- **Light/dark via variable swap.** Dark mode is a second block of the same variables under a `.dark` selector (or media query); components don't change, only the values do.
- **Registry / "Build Your Own".** Components and blocks are distributed through a registry the CLI can pull from, which extends to community registries and prebuilt block collections.
- **Visual theme generation.** tweakcn provides a GUI to tune the palette, radius, and typography and export the exact CSS-variable block to paste into your stylesheet — faster and less error-prone than hand-tuning HSL values.

## Best practices
- Initialize with the official CLI and let it configure paths, Tailwind, and the base color, rather than copying files manually. (See the CLI docs.)
- Theme by editing the CSS-variable layer (and its `.dark` counterpart), not by hardcoding colors inside components — this keeps every component consistent and re-themeable.
- Keep semantic token names (primary, muted, destructive) and map brand colors onto them, so swapping brands is a one-place change.
- Use a generator like tweakcn to produce a coherent, accessible palette and copy its exported variables verbatim, then commit them as your theme source of truth.
- Define both light and dark variable sets together so contrast is verified in both modes before shipping.

## Common pitfalls
- Treating shadcn/ui like an npm component library and trying to `npm install` the components → it is a copy-in CLI distribution; run the CLI to add components.
- Hardcoding hex/HSL colors inside individual components → breaks theming and dark mode; reference the CSS variables instead.
- Forgetting the `.dark` variable block, so dark mode inherits light values → define both sets.
- Pasting a generated palette without checking contrast on text/background pairs → run a contrast check before committing.

## Examples
```css
/* app globals.css — semantic theme tokens consumed by Tailwind */
:root {
  --background: 0 0% 100%;
  --foreground: 240 10% 3.9%;
  --primary: 240 5.9% 10%;
  --primary-foreground: 0 0% 98%;
  --border: 240 5.9% 90%;
  --ring: 240 5.9% 10%;
}
.dark {
  --background: 240 10% 3.9%;
  --foreground: 0 0% 98%;
  --primary: 0 0% 98%;
  --primary-foreground: 240 5.9% 10%;
  --border: 240 3.7% 15.9%;
  --ring: 240 4.9% 83.9%;
}
```

## Further reading
- ui.shadcn.com/docs/theming for the full variable list and conventions.
- tweakcn.com to generate and export a custom theme's variable block.

## Related skills
- ../component-patterns-gallery — anatomy and naming for the components you theme.
- ../react-component-libraries — Magic UI and others that compose with shadcn.
- ../gradient-resources — gradient backgrounds and accents to layer onto themed UIs.
