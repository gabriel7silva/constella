---
name: hugo
description: Hugo is the Go-based static site generator known for very fast builds; consult when scaffolding a Hugo site, configuring hugo.toml, working with content/layouts/partials, themes, taxonomies, shortcodes, or running `hugo server`.
domain: stack
category: meta
tags: [hugo, ssg, static-site, go, content, markdown, themes]
official_sources:
  - https://gohugo.io/documentation/
  - https://github.com/gohugoio/hugo
  - https://gohugo.io/installation/
verified: 2026-06-17
---

# Hugo

## Overview
Hugo (by gohugoio) is a static site generator written in Go that renders Markdown content and Go templates into a static site, optimized for very fast builds. It uses a convention-driven directory layout (content, layouts, themes) and a single self-contained binary with no runtime dependencies. Read this when scaffolding or theming a Hugo site, editing `hugo.toml`/`config`, writing templates and shortcodes, or running the dev server.

## Official sources
- Docs: https://gohugo.io/documentation/
- Repo: https://github.com/gohugoio/hugo
- Install: https://gohugo.io/installation/

## Install / setup
```bash
hugo new project quickstart
cd quickstart
git init
git submodule add https://github.com/gohugo-ananke/ananke themes/ananke
echo "theme = 'ananke'" >> hugo.toml
hugo server
```
Commands from the official quick start: https://gohugo.io/getting-started/quick-start/

## Core concepts
- **Content + front matter** — Markdown files under `content/` carry TOML/YAML/JSON front matter that sets title, date, draft, and custom params.
- **Page bundles** — leaf/branch bundles colocate a page's resources (images, data) with its `index.md`/`_index.md`.
- **Templates & lookup order** — Go `html/template` files in `layouts/` selected by a type/kind/layout lookup order (single, list, baseof, partials).
- **Shortcodes** — reusable snippets called inside content (e.g. `{{< figure >}}`) to avoid raw HTML in Markdown.
- **Taxonomies** — built-in tags/categories (and custom taxonomies) generate term and list pages automatically.
- **Hugo Modules** — Go-modules-based dependency system for themes and components, an alternative to git submodules.
- **Hugo Pipes** — asset pipeline for SCSS/PostCSS, minification, fingerprinting via `resources.*` functions.

## Best practices
- Prefer **Hugo Modules** over git submodules for themes and shared components (https://gohugo.io/hugo-modules/).
- Keep work-in-progress as `draft: true` and preview with `hugo server -D`; drafts are excluded from production builds (https://gohugo.io/getting-started/usage/).
- Pin the **Hugo version** and use the `extended` edition when your theme needs SCSS/WebP (https://gohugo.io/installation/).
- Use **Hugo Pipes** (`css.Sass`, `fingerprint`) to bundle and cache-bust assets (https://gohugo.io/functions/css/sass/, https://gohugo.io/hugo-pipes/introduction/).

## Common pitfalls
- Theme not applied → the `theme` key in `hugo.toml` must match the folder name under `themes/`, and submodules must be fetched (`git submodule update --init`).
- SCSS build error "this feature is not available in your current Hugo version" → install the **extended** edition of Hugo.

## Examples
```toml
# hugo.toml
baseURL = 'https://example.org/'
languageCode = 'en-us'
title = 'My Hugo Site'
theme = 'ananke'

[params]
  description = 'A site built with Hugo'
```

## Further reading
- https://gohugo.io/getting-started/quick-start/ — official quick start
- https://gohugo.io/templates/ — template (layout) reference

## Related skills
- ../jekyll — Ruby SSG alternative, the other GitHub Pages classic
- ../eleventy — JavaScript SSG with flexible template languages
- ../astro — content framework with islands and partial hydration
