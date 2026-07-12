---
name: puppeteer
description: Puppeteer is a Node.js library providing a high-level API to control Chrome or Firefox via DevTools Protocol or WebDriver BiDi for automation, scraping, PDFs, and headless testing; consult when launching browsers, navigating pages, evaluating DOM, intercepting requests, or capturing screenshots.
domain: stack
category: testing
tags: [puppeteer, headless-chrome, automation, node, scraping, devtools-protocol, screenshots]
official_sources:
  - https://pptr.dev/guides/getting-started
  - https://github.com/puppeteer/puppeteer
  - https://pptr.dev/guides/installation
verified: 2026-06-17
---

# Puppeteer

## Overview
Puppeteer is a JavaScript library that provides a high-level API to control Chrome or Firefox over the DevTools Protocol or WebDriver BiDi. It runs headless by default and is used for browser automation, end-to-end testing, scraping, generating PDFs/screenshots, and pre-rendering. Read this when launching and driving a browser, navigating and evaluating pages, intercepting network traffic, or capturing rendered output from Node.js.

## Official sources
- Docs: https://pptr.dev/guides/getting-started
- Repo: https://github.com/puppeteer/puppeteer
- Install: https://pptr.dev/guides/installation

## Install / setup
```bash
npm i puppeteer
```
Source: https://pptr.dev/guides/installation (downloads a compatible Chrome for Testing; use `puppeteer-core` to skip the browser download).

## Core concepts
- **Browser / Page** — `puppeteer.launch()` opens a browser; `browser.newPage()` creates tabs.
- **Navigation** — `page.goto()` with `waitUntil` controls load completion.
- **`page.evaluate`** — runs functions in the page context to read or manipulate the DOM.
- **Selectors & waits** — `page.waitForSelector()`, `$`, and `$$` locate elements reliably.
- **Request interception** — `page.setRequestInterception(true)` to block, mock, or modify requests.
- **Screenshots & PDFs** — `page.screenshot()` and `page.pdf()` capture rendered output.
- **Headless modes** — runs headless by default; pass `headless: false` to watch interactively.
- **Chrome for Testing** — a pinned browser auto-downloaded for reproducible automation.

## Best practices
- Always `await browser.close()` (use try/finally) to avoid leaked processes (https://pptr.dev/guides/getting-started).
- Wait on selectors/network, not arbitrary timeouts, before interacting (https://pptr.dev/guides/page-interactions).
- Use `puppeteer-core` plus a managed browser in CI/Docker (https://pptr.dev/guides/installation).
- Keep page-context code in `evaluate` pure; it is serialized and cannot close over Node vars (https://pptr.dev/guides/evaluate-javascript).

## Common pitfalls
- `evaluate` callback can't see outer variables → pass them as `evaluate` arguments.
- Acting before the element exists → `await page.waitForSelector()` first.
- Forgetting to close the browser leaks Chrome processes → close in a `finally` block.

## Examples
```js
import puppeteer from 'puppeteer';

const browser = await puppeteer.launch();
const page = await browser.newPage();
await page.goto('https://example.com');
const title = await page.title();
console.log(title);
await browser.close();
```

## Further reading
- https://pptr.dev/api — full Page/Browser API reference
- https://pptr.dev/guides/request-interception — mocking and blocking requests

## Related skills
- ../playwright — multi-browser successor with a built-in test runner and auto-waiting
- ../selenium — WebDriver-standard automation across many languages
- ../cypress — in-browser E2E testing framework
