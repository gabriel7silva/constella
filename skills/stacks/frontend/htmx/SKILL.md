---
name: htmx
description: HTML-over-the-wire hypermedia library that adds AJAX, SSE, and swaps via attributes; consult for server-rendered interactivity without SPA JS.
domain: stack
category: frontend
tags: [htmx, hypermedia, ajax, html-over-the-wire, server-rendered]
official_sources:
  - https://htmx.org/docs/
  - https://github.com/bigskysoftware/htmx
verified: 2026-06-16
---

# htmx

## Overview
htmx is a small dependency-free library that extends HTML with attributes for AJAX, CSS transitions, WebSockets, and Server-Sent Events, letting any element issue requests and swap the returned HTML into the page. It follows the hypermedia (HTML-over-the-wire) approach: the server returns HTML fragments rather than JSON, keeping interactivity logic on the server. Read this when adding dynamic behavior to server-rendered apps without a SPA framework.

## Official sources
- Docs: https://htmx.org/docs/
- Repo: https://github.com/bigskysoftware/htmx
- Install / download: https://htmx.org/docs/#installing

## Install / setup
Load via CDN (copied verbatim from htmx.org/docs/#installing):

```html
<script src="https://cdn.jsdelivr.net/npm/htmx.org@2.0.10/dist/htmx.min.js" integrity="sha384-H5SrcfygHmAuTDZphMHqBJLc3FhssKjG7w/CeCpFReSfwBWDTKpkzPP8c+cLsK+V" crossorigin="anonymous"></script>
```

Or install via npm and import in your bundle:

```bash
npm install htmx.org@2.0.10
```

```javascript
import 'htmx.org';
```

## Core concepts
- **Hypermedia exchange** — the server responds with HTML fragments that htmx swaps into the DOM.
- **`hx-get` / `hx-post` (and other verbs)** — issue AJAX requests from any element.
- **Triggers (`hx-trigger`)** — choose which events fire a request (click, change, load, intervals, etc.).
- **Targets (`hx-target`) and swaps (`hx-swap`)** — control which element is updated and how (`innerHTML`, `outerHTML`, `beforeend`, …).
- **`hx-boost`** — progressively enhances normal links/forms into AJAX requests.
- **Extensions & events** — SSE/WebSocket extensions and a lifecycle event model for hooks.

## Best practices
- Have the server return small HTML partials targeted at the element being swapped.
- Use `hx-target` and `hx-swap` explicitly so updates land where you intend.
- Prefer progressive enhancement (`hx-boost`) so pages still work without JS.
- Pin a specific htmx version (and use the integrity hash / self-host) in production.

## Common pitfalls
- Returning JSON and expecting it to render → htmx swaps HTML; return HTML fragments.
- Forgetting to re-initialize event handlers for swapped content → rely on htmx attributes or `htmx.process()` rather than one-time JS bindings.
- Over-broad swap targets clobbering page state → scope `hx-target` to the smallest fragment that needs updating.

## Examples
```html
<button hx-post="/clicked" hx-target="#result" hx-swap="innerHTML">
  Click me
</button>
<div id="result"></div>
```

## Further reading
- https://htmx.org/docs/ — full documentation
- https://htmx.org/examples/ — official examples (UX patterns)

## Related skills
- ../alpine — pairs well for client-side sprinkles alongside htmx
- ../lit — web components for richer client logic
