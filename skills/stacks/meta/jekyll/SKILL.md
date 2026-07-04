---
name: jekyll
description: Jekyll is the Ruby blog-aware static site generator that powers GitHub Pages; consult when scaffolding a Jekyll site, editing _config.yml, working with Liquid templates, layouts, includes, collections, front matter, or running `bundle exec jekyll serve`.
domain: stack
category: meta
tags: [jekyll, ssg, static-site, ruby, liquid, github-pages, markdown]
official_sources:
  - https://jekyllrb.com/docs/
  - https://github.com/jekyll/jekyll
  - https://jekyllrb.com/docs/installation/
verified: 2026-06-17
---

# Jekyll

## Overview
Jekyll (by the jekyll org) is a blog-aware static site generator written in Ruby that transforms Markdown and Liquid templates into a static website, and is the engine behind GitHub Pages. It is built around front matter, Liquid templating, and convention-based directories (`_layouts`, `_includes`, `_posts`). Read this when scaffolding a Jekyll site, editing `_config.yml`, writing Liquid templates or collections, or deploying to GitHub Pages.

## Official sources
- Docs: https://jekyllrb.com/docs/
- Repo: https://github.com/jekyll/jekyll
- Install: https://jekyllrb.com/docs/installation/

## Install / setup
```bash
gem install jekyll bundler
jekyll new myblog
cd myblog
bundle exec jekyll serve
```
Commands from the official quickstart: https://jekyllrb.com/docs/

## Core concepts
- **Front matter** — a YAML block (`---`) at the top of a file that sets variables (layout, title, permalink) and tells Jekyll to process the file.
- **Liquid** — the templating language (objects `{{ }}`, tags `{% %}`, filters) used to inject and transform content.
- **Layouts & includes** — reusable templates in `_layouts/` and partial snippets in `_includes/` referenced via `layout:` and `{% include %}`.
- **Posts & collections** — dated posts live in `_posts/` (`YYYY-MM-DD-title.md`); custom `_config.yml` collections group other content.
- **`_config.yml`** — site-wide settings (title, plugins, build options); changes require restarting the server.
- **Bundler & Gemfile** — gem dependencies are managed via a `Gemfile`; run Jekyll through `bundle exec` to use pinned versions.
- **`_site` output** — the generated static site that gets deployed; should be git-ignored.

## Best practices
- Always run via **`bundle exec`** with a committed `Gemfile.lock` so builds are reproducible (https://jekyllrb.com/docs/installation/).
- On Ruby 3.0+, add the missing `webrick` gem (`bundle add webrick`) before serving (https://jekyllrb.com/docs/).
- For GitHub Pages, pin to the **`github-pages` gem** or build with Actions to match the hosted toolchain (https://jekyllrb.com/docs/github-pages/).
- Use **`--livereload`** during development for automatic browser refresh (https://jekyllrb.com/docs/configuration/options/).

## Common pitfalls
- "cannot load such file -- webrick" on Ruby 3.0+ → run `bundle add webrick`.
- Edits to `_config.yml` not taking effect → restart `jekyll serve`; the config is only read at startup.

## Examples
```yaml
---
layout: post
title: "Hello Jekyll"
date: 2026-06-17 10:00:00 -0000
categories: intro
---
Welcome to my **first post** rendered by Jekyll and Liquid.
```

## Further reading
- https://jekyllrb.com/docs/step-by-step/01-setup/ — step-by-step tutorial
- https://jekyllrb.com/docs/liquid/ — Liquid templating reference

## Related skills
- ../hugo — Go SSG alternative with very fast builds
- ../eleventy — JavaScript SSG with flexible template languages
- ../astro — content framework with islands and partial hydration
