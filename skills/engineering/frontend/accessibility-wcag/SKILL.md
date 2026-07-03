---
name: accessibility-wcag
description: Meeting WCAG 2.2 success criteria and applying ARIA Authoring Practices for accessible UI; consult when building or auditing component accessibility.
domain: engineering
category: frontend
tags: [accessibility, a11y, wcag, aria, w3c, wai]
official_sources:
  - https://www.w3.org/WAI/WCAG22/quickref/
  - https://www.w3.org/WAI/ARIA/apg/
  - https://github.com/w3c/wcag
verified: 2026-06-16
---

# Accessibility (WCAG 2.2 & ARIA)

## Overview
WCAG (Web Content Accessibility Guidelines) is the W3C standard defining how to make web content accessible; the ARIA Authoring Practices Guide (APG) shows how to build accessible widgets with ARIA roles, states, and keyboard support. Read this when implementing interactive components, choosing semantics, or auditing a UI for conformance.

## Official sources
- WCAG 2.2 Quick Reference (How to Meet WCAG): https://www.w3.org/WAI/WCAG22/quickref/
- ARIA Authoring Practices Guide (APG): https://www.w3.org/WAI/ARIA/apg/
- Repo: https://github.com/w3c/wcag

## Core concepts
- **POUR principles.** WCAG organizes success criteria under four principles: Perceivable, Operable, Understandable, and Robust (w3.org/WAI/WCAG22/quickref).
- **Conformance levels A / AA / AAA.** Each success criterion has a level; Level AA is the most commonly targeted baseline for sites and apps (w3.org/WAI/WCAG22/quickref).
- **Techniques and failures.** Each criterion links sufficient techniques (ways to satisfy it), advisory techniques, and documented common failures to avoid (w3.org/WAI/WCAG22/quickref).
- **Semantics first, ARIA second.** The APG covers ARIA roles, states, and properties for components that native HTML cannot express, but native HTML semantics are preferred where available (w3.org/WAI/ARIA/apg).
- **Keyboard support.** APG patterns specify the expected keyboard interaction for each widget so it is operable without a mouse (w3.org/WAI/ARIA/apg).
- **Landmark regions.** Use HTML sectioning elements and ARIA landmark roles to structure a page so assistive technology users can navigate it (w3.org/WAI/ARIA/apg/practices/landmark-regions).
- **Accessible name and description.** Elements must expose a name (and optional description) that assistive technology can announce (w3.org/WAI/ARIA/apg).

## Best practices
- Target Level AA across the four POUR principles and use the Quick Reference's filters to track which criteria apply to your technologies (w3.org/WAI/WCAG22/quickref).
- Reach for an established APG design pattern before inventing a custom widget; follow its required roles, states, and keyboard model exactly (w3.org/WAI/ARIA/apg).
- Provide a meaningful accessible name for every interactive control and a landmark structure for every page (w3.org/WAI/ARIA/apg).
- Validate against the sufficient techniques listed for each relevant success criterion rather than guessing (w3.org/WAI/WCAG22/quickref).

## Common pitfalls
- Adding ARIA roles to elements that already have native semantics → prefer the native HTML element; ARIA does not change behavior, only the exposed semantics (w3.org/WAI/ARIA/apg).
- Building a custom widget (menu, dialog, tabs) without keyboard support → implement the keyboard interaction the matching APG pattern specifies (w3.org/WAI/ARIA/apg).

## Examples
```html
<!-- Landmark + accessible name; native button needs no ARIA role. -->
<nav aria-label="Primary">
  <button type="button">Menu</button>
</nav>
```

## Further reading
- https://www.w3.org/WAI/ARIA/apg/patterns/ — full catalog of widget patterns
- https://www.w3.org/WAI/standards-guidelines/wcag/ — WCAG standards overview

## Related skills
- ../frontend-architecture — where accessible components fit in the UI tree
- ../state-management — managing widget state (open/selected) accessibly
