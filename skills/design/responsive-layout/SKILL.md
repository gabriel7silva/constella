---
name: responsive-layout
description: Fluid, breakpoint, and intrinsic layout strategies for any screen; consult when making pages and components adapt across viewports and containers.
domain: design
category: design
tags: [responsive, layout, css-grid, media-queries, container-queries, intrinsic]
official_sources:
  - https://web.dev/learn/design/
  - https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout
verified: 2026-06-16
---

# Responsive Layout

## Overview
Responsive layout makes content adapt gracefully across screen sizes using a mix of fluid units, breakpoints (media queries), and intrinsic techniques where the layout itself flexes without explicit breakpoints. web.dev's Learn Responsive Design is the official course; MDN's Grid module is the canonical reference for the two-dimensional engine that powers intrinsic layouts. Read this when building pages or components that must work everywhere.

## Official sources
- web.dev — Learn Responsive Design: https://web.dev/learn/design/
- MDN — CSS Grid Layout: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout

## Core concepts
- **Media queries** — adapt designs to screen/device characteristics at chosen breakpoints (web.dev — Media queries).
- **Macro vs. micro layouts** — page-level structure vs. flexible components that can be placed anywhere (web.dev — Macro/Micro layouts).
- **Intrinsic layout** — let content and the grid decide sizing (e.g., `auto-fit` + `minmax`) so fewer hard breakpoints are needed (MDN Grid; web.dev layout).
- **Grid tracks, lines, areas** — the structural primitives for two-dimensional responsive layouts (MDN Grid).
- **`fr`, `minmax()`, `auto-fill`/`auto-fit`** — flexible track sizing that distributes space and wraps automatically (MDN Grid).
- **Container queries** — components respond to their container's size, complementing viewport media queries (web.dev — Micro layouts / container queries).
- **Theming & media features** — adapt to preferences like dark mode and reduced motion (web.dev — Theming/Media features).

## Best practices
- Build components as micro layouts that flex anywhere, rather than assuming a fixed page position (web.dev — Micro layouts).
- Prefer intrinsic sizing (`repeat(auto-fit, minmax(...))`) to reduce the number of manual breakpoints (MDN Grid).
- Use media queries for macro page structure and container queries for component-level adaptation (web.dev).
- Honor user preferences (dark mode, reduced motion) via media features as part of responsiveness (web.dev — Media features/Theming).

## Common pitfalls
- Pixel-perfect fixed widths that break between breakpoints → use fluid units and `minmax()` so layouts fill the gaps (MDN Grid).
- Relying only on viewport media queries for reusable components → add container queries so they reflow in any context (web.dev).
- Designing desktop-first and retrofitting small screens → start from flexible, content-driven layouts (web.dev — Macro layouts).

## Examples
```css
/* Intrinsic, breakpoint-light card layout */
.cards { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr)); }

/* Macro layout switch at a deliberate breakpoint */
@media (min-width: 64rem) {
  .page { grid-template-columns: 16rem 1fr; } /* sidebar + content */
}
```

## Further reading
- web.dev Learn Responsive Design modules: https://web.dev/learn/design/
- MDN Grid layout guides: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout

## Related skills
- ../css-techniques — grid, flexbox, and container query fundamentals
- ../graphic-design-basics — grid and spacing principles behind layouts
