---
name: gradients
description: Tasteful CSS gradients — linear, radial, conic, repeating, and layered meshes; consult when adding depth or color washes to backgrounds.
domain: design
category: design
tags: [css, gradients, backgrounds, color, mesh]
official_sources:
  - https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_images/Using_CSS_gradients
  - https://developer.mozilla.org/en-US/docs/Web/CSS/gradient
verified: 2026-06-16
---

# Gradients

## Overview
CSS gradients are image-type values that transition smoothly between colors without raster assets, used for backgrounds, fills, and layered "mesh" effects. They are widely available (baseline since 2015). MDN documents the gradient data type and a practical usage guide. Read this when adding color washes, subtle depth, or decorative backgrounds in CSS.

## Official sources
- MDN — Using CSS gradients (guide): https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_images/Using_CSS_gradients
- MDN — `<gradient>` data type: https://developer.mozilla.org/en-US/docs/Web/CSS/gradient

## Core concepts
- **linear-gradient()** — colors progress along a straight line at a given angle or direction (MDN gradient).
- **radial-gradient()** — colors radiate outward from a center origin (MDN gradient).
- **conic-gradient()** — colors transition around a center point, useful for pie charts and color wheels (MDN gradient).
- **Repeating variants** — `repeating-linear-gradient()`, `repeating-radial-gradient()`, `repeating-conic-gradient()` tile a gradient to fill the area (MDN gradient).
- **Color stops & hints** — positions control where colors land; hints adjust the midpoint of interpolation (MDN Using gradients).
- **Layering / meshes** — multiple gradients stacked in one `background` (comma-separated) create mesh-like blends (MDN Using gradients).
- **Premultiplied interpolation** — gradients interpolate in alpha-premultiplied space to avoid muddy gray transitions (MDN gradient).

## Best practices
- Stack several positioned radial gradients to approximate a soft "mesh" without images (MDN Using gradients — overlaying gradients).
- Place explicit color stops to control band placement and create hard lines when desired (MDN Using gradients).
- Use `background-blend-mode` to mix layered gradients for richer results (MDN Using gradients).
- When fading to transparent, beware default interpolation muddiness — premultiplied space mitigates it, but verify the midpoint (MDN gradient).

## Common pitfalls
- Fading a color to `transparent` and getting a gray haze → fade to the same hue with `0` alpha (e.g., `rgb(0 0 0 / 0)`) instead of the keyword (MDN gradient interpolation note).
- Overusing high-contrast gradients behind text → keep washes subtle and check contrast of overlaid content.
- Forgetting repeating gradients exist for patterns → use `repeating-*` instead of manually duplicating stops (MDN gradient).

## Examples
```css
/* Layered "mesh": multiple soft radial gradients stacked */
.hero {
  background:
    radial-gradient(40rem 40rem at 10% 20%, #6d5efc55, transparent 60%),
    radial-gradient(30rem 30rem at 90% 30%, #00d4ff44, transparent 60%),
    linear-gradient(160deg, #0b1020, #131a33);
}
```

## Further reading
- MDN Using CSS gradients (overlaying, hints, blending): https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_images/Using_CSS_gradients
- MDN `<gradient>` reference: https://developer.mozilla.org/en-US/docs/Web/CSS/gradient

## Related skills
- ../css-techniques — backgrounds and modern CSS context
- ../color-and-typography — choosing harmonious, accessible colors
