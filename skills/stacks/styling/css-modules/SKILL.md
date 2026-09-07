---
name: css-modules
description: CSS files whose class and animation names are scoped locally by default; consult when isolating component styles without naming collisions.
domain: stack
category: styling
tags: [css-modules, css, scoping, components, build]
official_sources:
  - https://github.com/css-modules/css-modules
verified: 2026-06-16
---

# CSS Modules

## Overview
A CSS Module is a CSS file in which all class names and animation names are scoped locally by default. When imported into JavaScript, it exports a mapping from the local names you wrote to the unique, globally-safe names the build generated. This prevents styles in one file from leaking and affecting the rest of the project. Read this when you want component-scoped CSS without adopting a CSS-in-JS runtime.

## Official sources
- Docs: https://github.com/css-modules/css-modules
- Repo: https://github.com/css-modules/css-modules

## Core concepts
- **Local scope by default**: every class/animation name is rewritten to a unique identifier, so names are isolated per file and cannot collide globally.
- **JS import mapping**: importing a `.module.css` file yields an object mapping your written class names to the generated names you apply in markup.
- **Composition**: a class can `composes:` from another class (same file or imported) to reuse and combine styles without duplicating declarations.
- **Explicit global escape hatch**: `:global(...)` opts specific selectors out of local scoping when you genuinely need a global rule.
- **Build-tool feature**: CSS Modules is a transformation applied by your bundler/loader, not a runtime library.

## Best practices
- Keep one module per component so local names map cleanly to that component's markup.
- Use `composes` to share base styles instead of repeating declarations across modules.
- Reserve `:global` for the rare cases that truly require global selectors; default to local scope.
- Reference classes through the imported object (`styles.button`) rather than hardcoding the generated names.

## Common pitfalls
- Writing plain global selectors expecting them to be scoped → only locally-scoped class/animation names are rewritten; element and `:global` selectors stay global.
- Hardcoding generated class names in HTML → names are build-generated and may change; always go through the imported mapping object.

## Examples
```css
/* submit-button.module.css */
.normal { background: white; }
.error { composes: normal; color: red; }
```
```js
import styles from "./submit-button.module.css";
element.innerHTML = `<button class="${styles.error}">Submit</button>`;
```

## Further reading
- https://github.com/css-modules/css-modules — local scope, composition, naming, theming docs

## Related skills
- ../vanilla-extract — locally-scoped styles authored in TypeScript
- ../sass — preprocessor that pairs well with CSS Modules
