---
name: gradient-resources
description: CSS gradient functions plus generators for static and animated/shader gradients; consult when crafting backgrounds, accents, or hero visuals.
domain: reference
category: reference
tags: [gradient, css, background, webgl, color, design]
official_sources:
  - https://developer.mozilla.org/en-US/docs/Web/CSS/gradient
  - https://craft-gradients.artcreativecode.com/
verified: 2026-06-16
---

# Gradient Resources & CSS Techniques

## Overview
Gradients are the workhorse of modern backgrounds, buttons, and hero visuals. The MDN `<gradient>` reference (developer.mozilla.org) is the canonical, standards-aligned source for the CSS gradient functions and their syntax, color stops, and color-space interpolation. For richer or animated looks, Craft Gradients (craft-gradients.artcreativecode.com) is an interactive WebGL/shader gradient generator with presets you can record, embed, and export. Read this skill when you need correct CSS gradient syntax or a generator for static and animated gradient visuals.

## Official sources
- MDN CSS `<gradient>`: https://developer.mozilla.org/en-US/docs/Web/CSS/gradient
- MDN `linear-gradient()`: https://developer.mozilla.org/en-US/docs/Web/CSS/gradient/linear-gradient
- Craft Gradients (WebGL generator): https://craft-gradients.artcreativecode.com/

## Core concepts
- **`<gradient>` is an `<image>`.** Per MDN, a gradient is a CSS `<image>` with no intrinsic size; it scales to its container and is used wherever an image is valid (e.g. `background-image`).
- **Three base functions + repeating variants.** `linear-gradient()` (along a line/angle), `radial-gradient()` (from a center outward), and `conic-gradient()` (around a center) — each with a `repeating-` counterpart for banded/striped patterns.
- **Color stops and positions.** Stops define where colors sit (`red 0%, blue 100%`); hard stops (two stops at the same position) create crisp bands; hints control the midpoint of a transition.
- **Color-space interpolation.** Gradients interpolate in a chosen color space (sRGB, oklab, lch, display-p3, etc.) and use alpha-premultiplied math to avoid muddy grays when fading to transparent — choosing `in oklch`/`in oklab` often yields more even, vivid transitions than sRGB.
- **Static CSS vs. animated WebGL.** CSS gradients are static (animatable only indirectly, e.g. moving `background-position`); shader/WebGL generators like Craft Gradients produce genuinely animated, organic gradients exported as embeds or recordings.

## Best practices
- Layer multiple gradients in one `background` (comma-separated) to build depth — e.g. a radial highlight over a linear base — instead of stacking extra DOM elements.
- Choose a perceptual color space (`in oklch` / `in oklab`) for smoother, more uniform transitions, and use alpha-aware fades to avoid the gray-band artifact when fading to transparent. (See MDN interpolation notes.)
- For "animated" CSS gradients, animate `background-position` on an oversized `background-size` rather than re-rendering colors, keeping it compositor-friendly.
- Use hard color stops to create flat color blocks, stripes, or geometric backgrounds from a single gradient declaration.
- Reach for a WebGL generator (Craft Gradients) only when you need living, organic motion; export and lazy-load it, and provide a static CSS fallback.

## Common pitfalls
- Fading a color to fully transparent and getting an unexpected gray band → the default sRGB transparent is `rgb(0 0 0 / 0)`; fade to the same color at 0 alpha (e.g. `rgba(255,0,0,0)`) or rely on the alpha-premultiplied/oklab interpolation MDN describes.
- Expecting CSS gradients to animate their colors directly → CSS can't tween gradient color stops; animate `background-position` or use a shader/JS approach.
- Heavy full-screen WebGL gradient on every page load → costs performance and battery; prefer CSS where it suffices and lazy-load shader backgrounds.

## Examples
```css
/* Layered static gradient with a perceptual color space */
.hero {
  background:
    radial-gradient(60% 60% at 50% 0%, rgba(99,102,241,.35), transparent 70%),
    linear-gradient(in oklch to bottom, #0f172a, #1e293b);
}

/* "Animated" gradient via background-position (compositor-friendly) */
.animated {
  background: linear-gradient(120deg, #6366f1, #ec4899, #6366f1);
  background-size: 200% 200%;
  animation: pan 8s ease-in-out infinite;
}
@keyframes pan { 0%,100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
```

## Further reading
- MDN pages for `radial-gradient()` and `conic-gradient()` for their full parameter syntax.
- Craft Gradients to design, record, and embed animated shader gradients.

## Related skills
- ../shadcn-tailwind-theming — apply gradients as themed backgrounds/accents via CSS variables.
- ../web-animation-codrops — combine gradients with motion for hero effects.
