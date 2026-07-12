---
name: web-animation-codrops
description: Distilled Codrops web-animation and interaction techniques (paraphrased); consult for motion, scroll, and creative front-end effects.
domain: reference
category: reference
tags: [animation, interaction, motion, gsap, webgl, css]
official_sources:
  - https://tympanus.net/codrops/
  - https://tympanus.net/codrops/category/tutorials/
verified: 2026-06-16
---

# Web Animation — Codrops Techniques

## Overview
Codrops (tympanus.net/codrops) is a long-running web-creativity resource publishing tutorials, case studies, and open demos on advanced front-end motion and interaction since 2009. It is an inspiration-and-learning source, not a library you install. Read this skill when a task needs interactive motion — scroll-driven reveals, hover and pointer effects, page transitions, text animations, or WebGL/shader-backed visuals — and you want the recurring techniques distilled rather than copied. Paraphrase its ideas; never paste its code or article text.

## Official sources
- Site: https://tympanus.net/codrops/
- Tutorials: https://tympanus.net/codrops/category/tutorials/
- Demos / Creative Hub: https://tympanus.net/codrops/ (linked from the homepage)

## Core concepts
- **Animation libraries vs. native.** Codrops techniques typically lean on GSAP (timelines, easing, ScrollTrigger) and the native Web Animations API / CSS transitions for DOM motion, and Three.js / raw WebGL shaders for canvas-based effects. Pick native CSS for simple state transitions and a library for orchestrated sequences.
- **Scroll-driven interaction.** A core genre: tying animation progress to scroll position (reveals, parallax, pinned sections, horizontal scroll). Modern approaches use the CSS Scroll-Driven Animations spec where supported, or ScrollTrigger / IntersectionObserver otherwise.
- **Pointer- and hover-reactive effects.** Image distortion on hover, magnetic buttons, cursor followers, and tilt effects driven by pointer coordinates mapped to transforms or shader uniforms.
- **Page and element transitions.** Smooth route/section transitions (FLIP technique, shared-element morphs, clip-path/mask reveals) that preserve visual continuity instead of hard cuts.
- **Performance discipline.** Animate compositor-friendly properties (transform, opacity) and avoid layout-thrashing properties (top/left/width/height); offload heavy visuals to GPU via WebGL.

## Best practices
- Animate `transform` and `opacity` rather than geometric/layout properties so the browser stays on the GPU compositor and avoids reflow.
- Drive scroll effects with `IntersectionObserver` (or native scroll-driven animations) instead of high-frequency `scroll` listeners to keep the main thread free.
- Respect `prefers-reduced-motion`: gate non-essential motion behind the media query so the experience degrades gracefully for users who opt out.
- Use easing and staggering deliberately — entrance reveals read better with slight stagger and natural easing than with uniform linear timing.
- Lazy-load and conditionally mount WebGL/Three.js scenes so heavy effects never block first paint on slower devices.

## Common pitfalls
- Animating `width`, `height`, `top`, or `left` causing layout thrash and jank → animate `transform: scale()/translate()` instead.
- Attaching expensive work to a raw `scroll` event that fires on every frame → debounce/throttle or switch to `IntersectionObserver`/scroll-driven animations.
- Shipping motion with no `prefers-reduced-motion` fallback → accessibility regression; always provide a reduced or static path.
- Copying a Codrops demo wholesale (markup, CSS, and JS) into production → respect licensing and rebuild the technique in your own code.

## Examples
```css
/* Reveal on scroll, GPU-friendly, with reduced-motion fallback */
.reveal { opacity: 0; transform: translateY(24px); transition: opacity .6s ease, transform .6s ease; }
.reveal.is-visible { opacity: 1; transform: none; }

@media (prefers-reduced-motion: reduce) {
  .reveal { transition: none; opacity: 1; transform: none; }
}
```
```js
// Toggle the reveal class with IntersectionObserver (not a scroll listener)
const io = new IntersectionObserver(
  (entries) => entries.forEach(e => e.isIntersecting && e.target.classList.add('is-visible')),
  { threshold: 0.2 }
);
document.querySelectorAll('.reveal').forEach(el => io.observe(el));
```

## Further reading
- Codrops tutorials category for technique walkthroughs (study, then re-implement in your own words).
- MDN: Web Animations API and CSS scroll-driven animations for the native-platform equivalents.

## Related skills
- ../react-component-libraries — Magic UI / React Bits package many of these motion patterns as ready components.
- ../gradient-resources — animated and shader gradients pair with Codrops-style hero effects.
