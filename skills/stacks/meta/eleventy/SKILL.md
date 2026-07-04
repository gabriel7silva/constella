---
name: eleventy
description: Eleventy (11ty) is the zero-config JavaScript static site generator with pluggable template languages; consult when installing @11ty/eleventy, writing eleventy.config.js, using Nunjucks/Liquid/Markdown templates, collections, data cascade, or running `npx @11ty/eleventy --serve`.
domain: stack
category: meta
tags: [eleventy, 11ty, ssg, static-site, javascript, nunjucks, markdown]
official_sources:
  - https://www.11ty.dev/docs/
  - https://github.com/11ty/eleventy
  - https://www.11ty.dev/docs/get-started/
verified: 2026-06-17
---

# Eleventy (11ty)

## Overview
Eleventy (by the 11ty org) is a simpler, zero-config static site generator that runs on Node.js and transforms a directory of templates into HTML. It is template-language agnostic — Markdown, Nunjucks, Liquid, JavaScript, and more work out of the box — and avoids imposing a client-side framework. Read this when installing Eleventy, configuring `eleventy.config.js`, working with the data cascade, collections, or shortcodes, or running the dev server.

## Official sources
- Docs: https://www.11ty.dev/docs/
- Repo: https://github.com/11ty/eleventy
- Install: https://www.11ty.dev/docs/get-started/

## Install / setup
```bash
npm install @11ty/eleventy
npx @11ty/eleventy --serve
```
Commands from the official getting-started docs: https://www.11ty.dev/docs/

## Core concepts
- **Template languages** — many engines are supported per file extension (`.md`, `.njk`, `.liquid`, `.11ty.js`); pick freely or mix.
- **Data cascade** — data merges from front matter, template/directory data files, global `_data/`, and computed data with a defined precedence.
- **Collections** — tagged content is grouped into collections (`collections.post`) for listing, pagination, and navigation.
- **Permalinks** — the `permalink` front-matter key controls each page's output path independent of the input path.
- **Shortcodes & filters** — reusable functions added via config (`addShortcode`, `addFilter`) callable from any template language.
- **Config file** — `eleventy.config.js` (or `.eleventy.js`) exports a function to register plugins, collections, passthrough copy, and input/output dirs.
- **Passthrough copy** — `addPassthroughCopy` copies static assets (CSS, images) straight to the output untouched.

## Best practices
- Install Eleventy **locally** (devDependency) and run via `npx`, not globally, so versions are pinned per project (https://www.11ty.dev/docs/get-started/).
- Configure passthrough copy and input/output directories in **`eleventy.config.js`** rather than CLI flags for reproducibility (https://www.11ty.dev/docs/config/).
- Use the **data cascade** and `_data/` files for shared data instead of duplicating values in front matter (https://www.11ty.dev/docs/data-cascade/).
- Prefer official plugins (e.g. **Image**, **RSS**, **Syntax Highlight**) over hand-rolled equivalents (https://www.11ty.dev/docs/plugins/).

## Common pitfalls
- Assets (CSS/images) missing from the build → register them with `addPassthroughCopy`; Eleventy only processes recognized template files by default.
- Global install drift → install `@11ty/eleventy` as a project devDependency and invoke with `npx @11ty/eleventy`.

## Examples
```js
// eleventy.config.js
export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("css");
  eleventyConfig.addFilter("uppercase", (s) => String(s).toUpperCase());
  return {
    dir: { input: "src", output: "_site" },
  };
}
```

## Further reading
- https://www.11ty.dev/docs/get-started/ — getting started walkthrough
- https://www.11ty.dev/docs/data-cascade/ — data cascade reference

## Related skills
- ../astro — content framework with islands and partial hydration
- ../hugo — Go SSG alternative with very fast builds
- ../jekyll — Ruby SSG that powers GitHub Pages
