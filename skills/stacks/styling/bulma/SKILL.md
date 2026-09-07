---
name: bulma
description: Bulma is a free, JavaScript-free CSS framework built on Flexbox/CSS Grid with a readable class API and Sass customization; consult when building responsive layouts with columns, using ready-made components (navbar, card, modal markup), helper/modifier classes, or theming via Sass variables.
domain: stack
category: styling
tags: [bulma, css, sass, flexbox, responsive, frontend, utility-classes]
official_sources:
  - https://bulma.io/documentation/
  - https://github.com/jgthms/bulma
  - https://bulma.io/documentation/start/installation/
verified: 2026-06-17
---

# Bulma

## Overview
Bulma is an open-source, pure-CSS framework based on Flexbox (and CSS Grid). It outputs a single `bulma.css` with no JavaScript, exposing a human-readable class API (`column`, `button is-primary`, `notification`) plus Sass source for deep customization. Read this when building responsive grids with the columns system, applying component/modifier/helper classes, or theming Bulma through Sass variables and CSS custom properties.

## Official sources
- Docs: https://bulma.io/documentation/
- Repo: https://github.com/jgthms/bulma
- Install: https://bulma.io/documentation/start/installation/

## Install / setup
```bash
npm install bulma
```
Command from the official installation page (https://bulma.io/documentation/start/installation/). Import the prebuilt CSS, or `@use "bulma/sass"` to build a customized version.

## Core concepts
- **Columns** — `.columns` container with `.column` children; auto-equal widths, sizes via `is-half`, `is-one-third`, `is-N`.
- **Modifiers** — `is-*` / `has-*` classes alter color, size, state (`is-primary`, `is-large`, `is-loading`).
- **Components** — styled markup for navbar, card, modal, dropdown, menu; behavior (toggling) is left to your own JS.
- **Elements** — single-tag styles: button, box, notification, tag, title.
- **Helpers** — utility classes for spacing (`m-3`, `p-2`), typography, colors, flex, visibility.
- **Responsiveness** — mobile-first with `mobile`/`tablet`/`desktop`/`widescreen`/`fullhd` breakpoints; columns stack below the chosen tier.
- **Sass theming (v1)** — customize via Sass variables and generated CSS variables (`--bulma-*`) for runtime theming.
- **No JavaScript** — Bulma ships zero JS; interactivity is your responsibility.

## Best practices
- Customize by overriding Sass variables and `@use "bulma/sass" with (...)` rather than editing compiled CSS (https://bulma.io/documentation/customize/with-sass/).
- Use the CSS-variables build (`--bulma-*`) for theming/dark mode without recompiling Sass (https://bulma.io/documentation/customize/with-css-variables/).
- Combine helper classes before writing custom CSS for spacing and layout (https://bulma.io/documentation/helpers/).
- Wire your own minimal JS for modal/dropdown/navbar-burger toggles; Bulma only styles them (https://bulma.io/documentation/components/).

## Common pitfalls
- Navbar burger / modal won't open → Bulma has no JS; add a click handler that toggles `is-active`.
- `.column` has no width/gap effect → it must be a direct child of a `.columns` container.
- Sass `with` overrides error → pass variables through the module system (`@use "bulma/sass" with (...)`), not plain `@import` reassignment.

## Examples
```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bulma@1.0.4/css/bulma.min.css">
<section class="section">
  <div class="columns">
    <div class="column is-one-third">
      <div class="box">
        <button class="button is-primary is-fullwidth js-toggle">Open</button>
      </div>
    </div>
  </div>
  <div class="modal" id="m">
    <div class="modal-background"></div>
    <div class="modal-content"><div class="box">Hello</div></div>
  </div>
</section>
<script>
  document.querySelector('.js-toggle').onclick = () =>
    document.getElementById('m').classList.add('is-active');
</script>
```

## Further reading
- https://bulma.io/documentation/columns/ — responsive columns system
- https://bulma.io/documentation/customize/ — Sass and CSS-variable customization
- https://bulma.io/documentation/helpers/ — full helper/utility class reference

## Related skills
- ../bootstrap — component framework alternative that bundles JS plugins
- ../tailwind — utility-first CSS alternative
