---
name: unocss
description: Instant on-demand atomic CSS engine with no core utilities, fully customizable via presets and rules; consult when building atomic CSS fast and small.
domain: stack
category: styling
tags: [unocss, atomic-css, presets, vite, utility]
official_sources:
  - https://unocss.dev/
  - https://github.com/unocss/unocss
verified: 2026-06-16
---

# UnoCSS

## Overview
UnoCSS is an instant, on-demand atomic CSS engine. Unlike opinionated frameworks, its core ships no utilities; you define behavior through presets and rules, and it generates only the CSS your code uses. It is built for speed and a tiny footprint. Read this when you want a customizable atomic-CSS workflow or to bring your own design-system presets.

## Official sources
- Docs: https://unocss.dev/
- Repo: https://github.com/unocss/unocss
- Install / download: https://unocss.dev/integrations/vite

## Install / setup
```bash
npm install -D unocss
```
The Vite plugin ships in the main `unocss` package and is imported from `unocss/vite` (per the Vite integration docs).

## Core concepts
- **On-demand atomic CSS**: utilities are generated only when used in your source, keeping output minimal.
- **Rules**: define utilities as static entries (`m-1`) or dynamic RegExp matchers that accept arbitrary values.
- **Presets**: bundled collections of rules, variants, and shortcuts that can be shared across projects or teams.
- **Shortcuts**: combine multiple utilities into a single reusable class name.
- **Variants**: transform or conditionally apply utilities (states, breakpoints, custom logic).
- **Unopinionated core**: no built-in utilities by default — behavior comes entirely from your configured presets/rules.

## Best practices
- Compose your styling from presets (official or your own) rather than re-implementing common utilities by hand.
- Use shortcuts to name and reuse recurring utility combinations instead of repeating long class strings.
- Encapsulate a design system as a custom preset so it is shareable and versionable across projects.
- Define dynamic rules with RegExp matchers to support arbitrary values without exploding your config.

## Common pitfalls
- Expecting utilities out of the box → the core is intentionally empty; add a preset (or define rules) or nothing is generated.
- Building class names dynamically the engine can't scan → unused or unseen classes won't be generated; keep classes statically discoverable.

## Examples
```ts
// uno.config.ts
import { defineConfig, presetUno } from 'unocss';

export default defineConfig({
  presets: [presetUno()],
  shortcuts: { btn: 'px-4 py-1 rounded inline-block' },
});
```

## Further reading
- https://unocss.dev/guide/ — concepts and configuration
- https://unocss.dev/presets/ — official presets

## Related skills
- ../tailwind — utility-first framework that inspired UnoCSS
- ../css-modules — alternative scoping-based styling approach
