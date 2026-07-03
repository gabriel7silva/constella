---
name: component-patterns-gallery
description: Canonical UI component anatomy, naming, and patterns; consult to name, structure, and document components consistently with real design systems.
domain: reference
category: reference
tags: [components, design-system, ui-patterns, anatomy, accessibility]
official_sources:
  - https://component.gallery/
  - https://alignui.com/
verified: 2026-06-16
---

# Component Patterns & Anatomy Gallery

## Overview
When you build a UI component you face two recurring questions: what is this thing actually called, and what parts does it have. The Component Gallery (component.gallery) answers the first by cataloging interface components from real-world design systems — each entry lists the component, its alternate names, a description, and links to how many systems implement it. AlignUI (alignui.com) answers the second as a production design system with React + Tailwind components and a synced Figma kit. Consult this skill before naming or structuring a component so your vocabulary and anatomy match established conventions instead of ad-hoc invention.

## Official sources
- The Component Gallery: https://component.gallery/
- Components index: https://component.gallery/components/
- Design systems index: https://component.gallery/design-systems/
- AlignUI: https://alignui.com/

## Core concepts
- **Component anatomy.** Most components decompose into named parts (e.g. a card has container, media, header, body, actions; a dialog has overlay, container, title, description, close, footer). Naming the parts is the foundation of an API and of accessible markup.
- **Canonical naming and aliases.** The same pattern goes by different names across systems (Accordion vs. Disclosure vs. Expander; Snackbar vs. Toast; Combobox vs. Autocomplete). The Component Gallery surfaces these aliases so you pick a recognizable name.
- **Compare-across-systems.** For any component you can see how multiple mature design systems solved the same interaction/layout problem, which exposes the variants, props, and states worth supporting.
- **States and variants.** Components are defined as much by their states (default, hover, focus, active, disabled, loading, error, selected) and variants (size, emphasis, intent) as by their static look.
- **Design-to-code parity.** Systems like AlignUI keep a Figma kit and a coded library in sync; treat the design tokens and component contracts as a single source of truth across both.

## Best practices
- Use the canonical component name (and document its aliases) so designers, engineers, and future agents share one vocabulary — look it up in The Component Gallery rather than coining a new term.
- Model the component's full state matrix (hover/focus/active/disabled/loading/error) up front; missing states are where UIs feel unfinished.
- Build interactive components on accessible primitives (correct roles, keyboard support, focus management) — study how reference systems handle ARIA for the pattern before rolling your own.
- Expose variation through a small, named prop API (size, variant/intent, emphasis) rather than many one-off boolean flags.
- Keep design tokens (color, spacing, radius, typography) as the shared layer so Figma and code stay in parity.

## Common pitfalls
- Inventing a bespoke name for a well-known pattern → confuses collaborators and search; reuse the established name and list aliases.
- Shipping only the happy-path visual and forgetting focus/disabled/loading/error states → incomplete, inaccessible component.
- Cloning a screenshot's pixels but skipping keyboard and ARIA semantics → looks right, fails real use; reference how design systems implement the role and interactions.

## Examples
```text
Dialog (aliases: Modal)
  - Overlay        (scrim, click-to-dismiss optional)
  - Container      (focus-trapped, role="dialog", aria-modal="true")
    - Title        (aria-labelledby target)
    - Description  (aria-describedby target)
    - Content
    - Footer       (primary + secondary actions)
    - Close button (aria-label)
  States: open / closed; initial focus + focus return on close
```

## Further reading
- component.gallery component pages for per-pattern anatomy, aliases, and cross-system examples.
- AlignUI docs for a concrete React + Tailwind implementation of these patterns.

## Related skills
- ../shadcn-tailwind-theming — implement these patterns as themeable shadcn/Tailwind components.
- ../react-component-libraries — prebuilt implementations of common components.
