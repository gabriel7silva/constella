---
name: graphic-design-basics
description: Visual hierarchy, grids, contrast, and spacing fundamentals for UI; consult when composing layouts and establishing visual order.
domain: design
category: design
tags: [visual-hierarchy, grids, contrast, spacing, layout]
official_sources:
  - https://m3.material.io/foundations
  - https://developer.mozilla.org/en-US/docs/Web/CSS
verified: 2026-06-16
---

# Graphic Design Basics

## Overview
Graphic design basics for interfaces are the visual mechanics that guide attention: hierarchy, grids/layout, contrast, and consistent spacing. Material Design 3 foundations codify layout, spacing, and accessible contrast as system-level guidance, while MDN documents the CSS properties that implement them. Read this when a layout feels flat, cluttered, or hard to scan.

## Official sources
- Material Design 3 — Foundations: https://m3.material.io/foundations
- MDN CSS reference: https://developer.mozilla.org/en-US/docs/Web/CSS

## Core concepts
- **Visual hierarchy** — using size, weight, color, and position to signal what matters most and the order to read it (M3 foundations: layout/typography).
- **Grids and layout** — a consistent column/row structure that aligns content and creates rhythm (M3 foundations: layout).
- **Spacing** — predictable gaps between and within elements (margins, padding, gap) that group related items and separate unrelated ones (MDN spacing properties; M3 layout).
- **Contrast** — differences in value/color/scale that make foreground readable and draw the eye; tied to accessible color (M3 foundations: accessibility).
- **Alignment** — shared edges and baselines that make composition feel intentional, expressible via CSS box alignment (MDN alignment).
- **Typographic scale** — a stepped set of sizes/weights that encodes hierarchy in text (M3 type/foundations).

## Best practices
- Establish hierarchy first: decide the primary, secondary, and tertiary elements, then assign size/weight/color accordingly (M3 layout/typography).
- Use a consistent spacing system (multiples of a base unit) rather than ad-hoc pixel values to create rhythm (M3 layout; MDN spacing).
- Ground contrast choices in accessibility so hierarchy is legible to all users (M3 accessibility foundation).
- Align elements to a shared grid; alignment is a low-cost way to make a layout look composed (M3 layout).

## Common pitfalls
- Everything emphasized equally (all bold/large) → establish one clear focal point and demote the rest (M3 hierarchy).
- Random, inconsistent spacing → adopt a spacing scale and apply it systematically (M3 layout; MDN `gap`/`margin`).
- Low-contrast decorative text that fails legibility → verify against accessible contrast guidance (M3 accessibility; see color-and-typography skill).

## Examples
```css
/* Spacing scale via custom properties + grid rhythm */
:root { --space-1: .25rem; --space-2: .5rem; --space-4: 1rem; --space-8: 2rem; }
.section { display: grid; gap: var(--space-8); }
.stack > * + * { margin-block-start: var(--space-4); } /* consistent vertical rhythm */
```

## Further reading
- M3 foundations (layout, accessibility): https://m3.material.io/foundations
- MDN box alignment & spacing: https://developer.mozilla.org/en-US/docs/Web/CSS

## Related skills
- ../color-and-typography — type scale and accessible contrast detail
- ../responsive-layout — translating grids into responsive layouts
