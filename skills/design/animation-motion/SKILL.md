---
name: animation-motion
description: Motion design principles and the Web Animations API for purposeful, performant UI animation; consult when adding transitions or animated feedback.
domain: design
category: design
tags: [animation, motion, web-animations-api, easing, transitions]
official_sources:
  - https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API
  - https://m3.material.io/styles/motion/overview
verified: 2026-06-16
---

# Animation & Motion

## Overview
Motion communicates change, hierarchy, and continuity when used purposefully; the Web Animations API (WAAPI) is the standard scriptable way to create and control animations in JavaScript. MDN documents the API; Material Design 3 motion guidance supplies the principles (easing, duration, transitions). Read this when adding animated feedback, page/element transitions, or coordinated motion.

## Official sources
- MDN — Web Animations API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API
- Material Design 3 — Motion overview: https://m3.material.io/styles/motion/overview
- Material Design 3 — Easing and duration: https://m3.material.io/styles/motion/easing-and-duration/tokens-specs

## Core concepts
- **Element.animate()** — shortcut that creates and plays an animation on an element and returns an `Animation` object (MDN WAAPI).
- **KeyframeEffect** — describes the animatable properties/values (keyframes) plus timing options (MDN WAAPI).
- **Animation** — object exposing playback controls (play, pause, reverse, finish) and a timeline (MDN WAAPI).
- **AnimationTimeline / DocumentTimeline** — the time source; `document.timeline` is the default (MDN WAAPI).
- **Element.getAnimations() / Document.getAnimations()** — enumerate animations affecting an element or document (MDN WAAPI).
- **Easing and duration** — motion tokens that define acceleration curves and timing for consistent, natural movement (M3 easing and duration).

## Best practices
- Use `Element.animate()` for imperative, controllable animations and `getAnimations()` to coordinate or cancel them (MDN WAAPI).
- Apply system easing/duration tokens so motion is consistent across the product rather than ad-hoc per component (M3 easing and duration).
- Animate compositor-friendly properties (transform, opacity) for smooth, performant motion.
- Make motion purposeful — reinforce a state change or spatial relationship, not decoration (M3 motion overview).

## Common pitfalls
- Long or non-interruptible animations that block the user → keep durations short and let `Animation` controls pause/reverse (MDN WAAPI; M3 duration).
- Inconsistent easing per component → centralize on shared easing/duration tokens (M3 easing and duration).
- Ignoring reduced-motion users → respect `prefers-reduced-motion` and scale back non-essential animation.

## Examples
```js
// WAAPI: fade + slide in, then control playback
const anim = card.animate(
  [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }],
  { duration: 200, easing: 'cubic-bezier(0.2, 0, 0, 1)', fill: 'both' }
);
anim.onfinish = () => card.classList.add('is-ready');
// Respect user preference
if (matchMedia('(prefers-reduced-motion: reduce)').matches) anim.finish();
```

## Further reading
- MDN WAAPI guides and interfaces: https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API
- M3 motion specs and tokens: https://m3.material.io/styles/motion/overview

## Related skills
- ../microinteractions — small animated feedback cues built on these APIs
- ../css-techniques — transitions and keyframes as a declarative alternative
