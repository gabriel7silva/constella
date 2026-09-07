---
name: bootstrap
description: Bootstrap is the popular HTML/CSS/JS framework of responsive grid layout, prebuilt components, and utility classes; consult when building responsive UIs, using the breakpoint grid, navbars, modals, dropdowns, customizing Sass variables, or wiring Popper-based JS plugins.
domain: stack
category: styling
tags: [bootstrap, css, sass, responsive, grid, frontend, utility-classes]
official_sources:
  - https://getbootstrap.com/docs/5.3/getting-started/introduction/
  - https://github.com/twbs/bootstrap
  - https://getbootstrap.com/docs/5.3/getting-started/download/
verified: 2026-06-17
---

# Bootstrap

## Overview
Bootstrap is a mobile-first, open-source CSS and JavaScript framework providing a responsive 12-column grid, prebuilt components (navbar, modal, dropdown, carousel), and a large utility-class API. It ships compiled CSS/JS plus Sass source for theming. Read this when building responsive layouts, composing UI from ready-made components, customizing the design tokens via Sass, or troubleshooting Popper-based interactive plugins.

## Official sources
- Docs: https://getbootstrap.com/docs/5.3/getting-started/introduction/
- Repo: https://github.com/twbs/bootstrap
- Install: https://getbootstrap.com/docs/5.3/getting-started/download/

## Install / setup
```bash
npm install bootstrap@5.3.8
```
Command from the official download page (https://getbootstrap.com/docs/5.3/getting-started/download/). For dropdowns/tooltips/popovers also install `@popperjs/core`.

## Core concepts
- **Responsive grid** — `.container` > `.row` > `.col`; 12 columns with breakpoint infixes (`col-sm-`, `col-md-`, `col-lg-`, `col-xl-`, `col-xxl-`).
- **Breakpoints** — six tiers (xs default, sm 576, md 768, lg 992, xl 1200, xxl 1400px) drive grid, display, and spacing utilities.
- **Components** — markup + classes for navbar, card, modal, dropdown, accordion, toast; interactive ones need Bootstrap's JS bundle.
- **Utility API** — atomic classes for spacing (`m-`/`p-`), display, flex, colors, borders; generatable from Sass maps.
- **JavaScript plugins** — data-attribute (`data-bs-toggle`) or programmatic (`new bootstrap.Modal(el)`) init; Popper powers positioned overlays.
- **Sass theming** — override `$primary`, `$grid-breakpoints`, etc. before `@import "bootstrap/scss/bootstrap"`.
- **CSS variables** — components expose `--bs-*` custom properties for runtime theming.
- **Color modes** — built-in light/dark via `data-bs-theme` attribute (v5.3+).

## Best practices
- Customize through Sass variables/maps, not by editing compiled CSS (https://getbootstrap.com/docs/5.3/customize/sass/).
- Import only the Sass partials you use to shrink output; reuse utilities before writing custom CSS (https://getbootstrap.com/docs/5.3/customize/optimize/).
- Include Popper before/with the JS bundle, or use `bootstrap.bundle.min.js` which bundles it (https://getbootstrap.com/docs/5.3/getting-started/javascript/).
- Use semantic, accessible markup and ARIA per each component's docs (https://getbootstrap.com/docs/5.3/getting-started/accessibility/).

## Common pitfalls
- Dropdowns/tooltips silently do nothing → Popper missing; use the bundle JS or install `@popperjs/core`.
- Nested columns misalign → must wrap child columns in their own `.row`; columns must be direct children of a row.
- Custom Sass overrides ignored → set variables *before* importing Bootstrap, with `!default` removed on your side.

## Examples
```html
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css" rel="stylesheet">
<div class="container">
  <div class="row g-3">
    <div class="col-12 col-md-6">
      <button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#m">Open</button>
    </div>
  </div>
</div>
<div class="modal fade" id="m" tabindex="-1"><div class="modal-dialog"><div class="modal-content">
  <div class="modal-body">Hello</div>
</div></div></div>
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/js/bootstrap.bundle.min.js"></script>
```

## Further reading
- https://getbootstrap.com/docs/5.3/layout/grid/ — full grid system reference
- https://getbootstrap.com/docs/5.3/utilities/api/ — generating and extending utility classes
- https://icons.getbootstrap.com/ — official Bootstrap Icons set

## Related skills
- ../bulma — alternative Flexbox CSS framework, no JS
- ../tailwind — utility-first CSS alternative to component classes
