---
name: sass
description: CSS preprocessor adding variables, nesting, partials, mixins, and functions that compile to plain CSS; consult when authoring maintainable stylesheets.
domain: stack
category: styling
tags: [sass, scss, css, preprocessor, dart-sass]
official_sources:
  - https://sass-lang.com/documentation/
  - https://github.com/sass/dart-sass
verified: 2026-06-16
---

# Sass

## Overview
Sass is a CSS preprocessor that extends CSS with variables, nesting, partials, mixins, inheritance, and functions, then compiles down to standard CSS. Dart Sass is the canonical, primary implementation of the language. Read this when you want structured, reusable stylesheets that still ship as plain CSS.

## Official sources
- Docs: https://sass-lang.com/documentation/
- Repo: https://github.com/sass/dart-sass
- Install / download: https://sass-lang.com/install/

## Install / setup
```bash
npm install -g sass
```
The npm package is the pure-JavaScript build (slower than the native options); Homebrew (`brew install sass/sass/sass`) and Chocolatey (`choco install sass`) are also documented on the install page.

## Core concepts
- **Variables**: store reusable values (colors, fonts, sizes) and reference them throughout stylesheets.
- **Nesting**: nest selectors to mirror HTML structure, reducing repetition (use sparingly to avoid over-specific selectors).
- **Partials & `@use`/`@forward`**: split styles into underscore-prefixed partial files and load them as modules with namespacing.
- **Mixins**: reusable groups of declarations invoked with `@include`, optionally parameterized.
- **Functions & operators**: built-in and custom functions plus math operators compute values at compile time.
- **Two syntaxes**: `.scss` (CSS-superset, most common) and the indented `.sass` syntax.

## Best practices
- Prefer the module system (`@use` / `@forward`) over the deprecated `@import` for predictable namespacing and scoping.
- Keep nesting shallow to avoid generating overly specific, hard-to-override selectors.
- Organize code into small partials and compose them, rather than one large stylesheet.
- Use the native/embedded Sass binary for speed in builds where compile time matters; the npm pure-JS build is slower.

## Common pitfalls
- Relying on `@import` → it is deprecated in Dart Sass; migrate to `@use`/`@forward` for module-scoped variables and mixins.
- Deeply nesting selectors → produces high-specificity CSS that is brittle and difficult to override.

## Examples
```scss
$primary: #3366ff;

.button {
  background: $primary;
  &:hover { background: darken($primary, 10%); }
}
```

## Further reading
- https://sass-lang.com/documentation/ — full language reference
- https://sass-lang.com/documentation/at-rules/use/ — the module system

## Related skills
- ../css-modules — locally-scoped CSS that pairs with Sass
- ../tailwind — utility-first alternative styling approach
