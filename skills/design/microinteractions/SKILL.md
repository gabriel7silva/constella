---
name: microinteractions
description: Trigger-feedback pairs, state cues, and transitions that confirm actions; consult when designing button states, validation, and small feedback moments.
domain: design
category: design
tags: [microinteractions, feedback, transitions, state, ux]
official_sources:
  - https://www.nngroup.com/articles/microinteractions/
  - https://developer.mozilla.org/en-US/docs/Web/CSS/transition
verified: 2026-06-16
---

# Microinteractions

## Overview
Microinteractions are small, single-purpose trigger-feedback pairs that confirm an action or communicate a state change through contextual UI changes. Nielsen Norman Group defines the concept; MDN documents CSS transitions, a primary way to implement smooth state feedback. Read this when designing button/hover/focus states, form validation, toggles, loading, or any small "did that work?" moment.

## Official sources
- Nielsen Norman Group — Microinteractions: https://www.nngroup.com/articles/microinteractions/
- MDN — CSS transition: https://developer.mozilla.org/en-US/docs/Web/CSS/transition

## Core concepts
- **Microinteraction** — a trigger-feedback pair where feedback is a narrowly targeted, contextual (usually visual) response to the trigger (NN/g).
- **Trigger** — what starts it: a user action (click, gesture, voice) or a change in system state (NN/g).
- **Feedback** — the small, highly contextual UI change that responds to the trigger, often visual, sometimes auditory (NN/g).
- **State cues** — visible distinctions between default, hover, focus, active, disabled, loading, success, and error states.
- **Transitions** — `transition` smoothly interpolates between state property values over a duration, easing, and optional delay (MDN transition).

## Best practices
- Pair every meaningful trigger with immediate, proportionate feedback so the user knows it registered (NN/g).
- Keep microinteractions single-purpose and narrowly targeted rather than bundling multiple effects (NN/g).
- Use CSS transitions for smooth, declarative state changes and list only the properties you intend to animate (MDN transition).
- Cover the full state matrix (hover, focus-visible, active, disabled, loading, error/success) so feedback is complete and accessible.

## Common pitfalls
- Transitioning `all` → name specific properties to avoid janky, unintended animations (MDN transition).
- Silent triggers with no feedback (e.g., a submit that appears to do nothing) → add an immediate visual response (NN/g).
- Overloading one microinteraction with several effects → keep it focused on a single, contextual response (NN/g).

## Examples
```css
/* State cues with a scoped transition */
.btn {
  background: var(--bg);
  transition: background-color 150ms ease, box-shadow 150ms ease;
}
.btn:hover { background: var(--bg-hover); }
.btn:focus-visible { box-shadow: 0 0 0 3px var(--focus-ring); }
.btn[aria-busy="true"] { opacity: .6; cursor: progress; } /* loading cue */
```

## Further reading
- NN/g microinteractions article: https://www.nngroup.com/articles/microinteractions/
- MDN transition reference: https://developer.mozilla.org/en-US/docs/Web/CSS/transition

## Related skills
- ../animation-motion — richer scripted motion via the Web Animations API
- ../ui-ux-principles — "visibility of system status" that feedback fulfills
