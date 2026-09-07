---
name: css-techniques
description: Modern CSS layout and styling — grid, flexbox, container queries, custom properties; consult when building responsive, maintainable styles.
domain: design
category: design
tags: [css, grid, flexbox, container-queries, custom-properties]
official_sources:
  - https://developer.mozilla.org/en-US/docs/Web/CSS
  - https://web.dev/learn/css
verified: 2026-06-16
---

# CSS Techniques

## Overview
Modern CSS provides dedicated layout systems (Grid for two dimensions, Flexbox for one), element-aware responsiveness (container queries), and reusable values (custom properties), replacing older float and hack-based approaches. MDN is the canonical reference; web.dev's Learn CSS is the official structured course. Read this when laying out pages and components or modernizing legacy stylesheets.

## Official sources
- MDN CSS reference: https://developer.mozilla.org/en-US/docs/Web/CSS
- web.dev — Learn CSS: https://web.dev/learn/css

## Core concepts
- **Box model** — every element is a box of content, padding, border, and margin; `box-sizing` controls how width is computed (MDN/web.dev Box Model).
- **Flexbox** — one-dimensional layout distributing space along a single axis (row or column) (MDN Flexbox; web.dev Flexbox).
- **Grid** — two-dimensional layout using tracks, lines, and named areas for rows and columns simultaneously (MDN Grid; web.dev Grid).
- **Container queries** — style elements based on the size (and style) of their container rather than the viewport (MDN Container Queries; web.dev module 38).
- **Custom properties** — `--name` variables that cascade and can be read at runtime for theming (web.dev Custom Properties).
- **Cascade, specificity, inheritance** — the rules that decide which declaration wins and which values pass to children (web.dev Cascade/Specificity/Inheritance).
- **Logical properties** — writing-mode-aware properties (e.g. `margin-inline`) that adapt to text direction (web.dev Logical Properties).

## Best practices
- Choose Flexbox for one-axis distribution and Grid for two-axis layout instead of forcing one tool to do both (MDN layout modules).
- Use container queries so components adapt to where they are placed, not just the viewport width (MDN Container Queries).
- Drive theming and repeated values through custom properties to avoid magic numbers (web.dev Custom Properties).
- Prefer logical properties (`inline`/`block`) for internationalized, direction-agnostic layouts (web.dev Logical Properties).

## Common pitfalls
- Using absolute positioning or floats for layout → use Grid/Flexbox, which handle alignment and spacing natively (MDN layout).
- Fighting the cascade with `!important` → resolve via specificity and source order per the cascade rules (web.dev Cascade).
- Assuming viewport media queries suffice for reusable components → add container queries so a component reflows in any context (MDN Container Queries).

## Examples
```css
/* Responsive card grid: auto-fit tracks with a minimum width */
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr)); gap: 1rem; }

/* Container query: stack below the container's own breakpoint */
.card-wrap { container-type: inline-size; }
@container (max-width: 24rem) { .card { flex-direction: column; } }
```

## Further reading
- MDN CSS layout guides: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout
- web.dev Learn CSS full module list: https://web.dev/learn/css

## Related skills
- ../responsive-layout — fluid and intrinsic layout strategies built on these primitives
- ../gradients — modern background/image techniques in CSS
