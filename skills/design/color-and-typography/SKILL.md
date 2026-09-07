---
name: color-and-typography
description: Color systems, type scale, and WCAG contrast ratios for legible, accessible UI; consult when defining palettes, text styles, or checking contrast.
domain: design
category: design
tags: [color, typography, contrast, wcag, accessibility, type-scale]
official_sources:
  - https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
  - https://m3.material.io/styles/color/system/overview
verified: 2026-06-16
---

# Color & Typography

## Overview
Color and typography decisions determine whether an interface is legible and accessible. WCAG 2.2 defines the minimum contrast ratios text must meet; Material Design 3 defines a role-based color system and a tokenized type scale. Read this when building a palette, defining text styles, or validating that foreground/background pairs are readable.

## Official sources
- W3C WCAG 2.2 — Understanding Contrast (Minimum): https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
- Material Design 3 — Color system overview: https://m3.material.io/styles/color/system/overview
- Material Design 3 — Type scale tokens: https://m3.material.io/styles/typography/type-scale-tokens

## Core concepts
- **Contrast ratio (AA)** — normal text needs at least 4.5:1; large-scale text needs at least 3:1 (WCAG 2.2 SC 1.4.3).
- **Large text definition** — at least 18pt, or 14pt bold, qualifies for the 3:1 threshold (WCAG 2.2 SC 1.4.3).
- **Color roles** — M3 assigns semantic roles (primary, on-primary, surface, etc.) rather than raw colors, so pairs are designed to be legible (M3 color system).
- **Color schemes** — light/dark schemes derived from a source color keep contrast and harmony consistent (M3 color system).
- **Type scale** — a tokenized set of named styles (display, headline, title, body, label) encoding size/weight/line-height (M3 type scale tokens).
- **Typographic hierarchy** — using the scale to signal importance and reading order.

## Best practices
- Verify every text/background pair meets at least 4.5:1 (normal) or 3:1 (large) for WCAG AA (WCAG 2.2 SC 1.4.3).
- Pair color roles deliberately (e.g., `on-primary` over `primary`) so contrast is built into the system, not guessed (M3 color roles).
- Define both light and dark schemes from the same source color to preserve contrast across modes (M3 color system).
- Use the type scale tokens for consistent hierarchy instead of arbitrary font sizes (M3 type scale tokens).

## Common pitfalls
- Choosing colors by aesthetics alone and failing AA contrast → measure the ratio and adjust lightness (WCAG 2.2 SC 1.4.3).
- Assuming large text needs 4.5:1 → it only needs 3:1 once it meets the large-text size threshold (WCAG 2.2 SC 1.4.3).
- Hardcoding colors per component instead of using semantic roles → use role tokens so theming and dark mode stay legible (M3 color roles).

## Examples
```css
/* Role-based tokens with a verified-contrast pairing */
:root {
  --color-primary: #4a3aff;       /* background */
  --color-on-primary: #ffffff;    /* text: meets >= 4.5:1 for normal text */
}
.cta { background: var(--color-primary); color: var(--color-on-primary); }
/* Type scale token example */
.headline-large { font-size: 2rem; line-height: 2.5rem; font-weight: 400; }
```

## Further reading
- WCAG 2.2 contrast understanding doc: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
- M3 color & typography styles: https://m3.material.io/styles/color/system/overview

## Related skills
- ../design-systems — encoding color roles and type scale as tokens
- ../graphic-design-basics — applying contrast and hierarchy in layout
