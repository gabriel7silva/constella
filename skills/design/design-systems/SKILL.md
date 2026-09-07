---
name: design-systems
description: Design tokens, reusable components, and governance for scalable UI; consult when building or maintaining a shared component library.
domain: design
category: design
tags: [design-systems, design-tokens, components, governance, material-design]
official_sources:
  - https://m3.material.io/foundations/design-tokens
  - https://www.designsystems.com/
verified: 2026-06-16
---

# Design Systems

## Overview
A design system is a shared source of truth that pairs design tokens, reusable components, and usage guidelines so designers and engineers ship consistent UI at scale. Material Design 3 (Google's open-source system) defines the token model and component foundations; designsystems.com (Figma's publication) covers process, operations, and governance. Read this when starting, scaling, or governing a component library.

## Official sources
- Material Design 3 — Design tokens: https://m3.material.io/foundations/design-tokens
- Material Design 3 — Foundations: https://m3.material.io/foundations
- DesignSystems.com (by Figma): https://www.designsystems.com/

## Core concepts
- **Design tokens** — named, tokenized values that are the building blocks of UI and are used identically in design, tooling, and code (M3 design tokens).
- **Reference tokens** — the full set of available raw tokenized values, e.g. `md.ref.palette.secondary200` (M3 glossary).
- **System tokens** — semantic roles/choices that make up the system: color, typography, elevation, shape (M3 glossary).
- **Component tokens** — design attributes scoped to a component, such as a button container's color (M3 glossary).
- **Components** — reusable building blocks (buttons, fields, cards) wired to system tokens so a token change propagates everywhere.
- **Foundations** — cross-cutting bases like accessibility, layout, and interaction patterns that underpin every component (M3 foundations).
- **Governance** — the operations and process layer (contribution, versioning, ownership) covered under Design Operations on designsystems.com.

## Best practices
- Layer tokens reference → system → component so raw values stay decoupled from semantic intent (M3 token tiers).
- Use one token set across design tools and code so a single change updates designs and production together (M3 design tokens).
- Bake accessibility into foundations (contrast, focus, hit targets) rather than retrofitting per component (M3 foundations).
- Establish governance — contribution model, ownership, and versioning — so the system evolves without fragmenting (designsystems.com Design Operations).

## Common pitfalls
- Hardcoding raw hex/spacing values in components → reference system tokens so themes and rebrands cascade (M3 token tiers).
- Treating the library as "done" with no governance → assign owners and a contribution/versioning process (designsystems.com).
- Building components before defining tokens and foundations → settle tokens and accessibility bases first, then compose components.

## Examples
```css
/* System tokens (semantic) reference raw palette tokens */
:root {
  --md-sys-color-primary: var(--md-ref-palette-primary40);
  --md-sys-color-on-primary: var(--md-ref-palette-primary100);
}
/* Component consumes only system tokens */
.button { background: var(--md-sys-color-primary); color: var(--md-sys-color-on-primary); }
```

## Further reading
- M3 customization & theming: https://m3.material.io/foundations/customization
- designsystems.com articles on tokens, ops, and governance: https://www.designsystems.com/

## Related skills
- ../color-and-typography — color roles and type scale that tokens encode
- ../ui-ux-principles — consistency and standards realized via shared components
