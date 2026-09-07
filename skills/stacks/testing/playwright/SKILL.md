---
name: playwright
description: Playwright is a Microsoft framework for cross-browser web testing and automation across Chromium, Firefox, and WebKit with auto-waiting, tracing, and parallel execution; consult when writing E2E tests, using locators and web-first assertions, generating tests with codegen, or configuring playwright.config.
domain: stack
category: testing
tags: [playwright, e2e, cross-browser, automation, typescript, web-testing, microsoft]
official_sources:
  - https://playwright.dev/docs/intro
  - https://github.com/microsoft/playwright
  - https://www.npmjs.com/package/playwright
verified: 2026-06-17
---

# Playwright

## Overview
Playwright is a framework for web testing and automation that drives Chromium, Firefox, and WebKit through a single API, with bindings for Node.js, Python, Java, and .NET. Its test runner adds auto-waiting locators, web-first assertions, isolated browser contexts, tracing, and parallelism. Read this when writing cross-browser E2E tests, recording tests with codegen, debugging flakiness with traces, or configuring projects/devices.

## Official sources
- Docs: https://playwright.dev/docs/intro
- Repo: https://github.com/microsoft/playwright
- Install: https://www.npmjs.com/package/playwright

## Install / setup
```bash
npm init playwright@latest
```
Source: https://playwright.dev/docs/intro (scaffolds config, examples, and installs browsers; add browsers later with `npx playwright install --with-deps`).

## Core concepts
- **Locators** — `page.getByRole`/`getByText`/`locator()` are lazy and auto-retry until actionable.
- **Web-first assertions** — `expect(locator).toBeVisible()` polls until the condition holds or times out.
- **Browser contexts** — lightweight isolated sessions give each test fresh cookies/storage in parallel.
- **Fixtures** — the test runner injects `page`, `context`, `request`, and custom fixtures per test.
- **Auto-waiting** — actions wait for elements to be visible, stable, and enabled before acting.
- **Trace viewer** — `--trace on` records DOM, network, and actions for post-mortem debugging.
- **Codegen** — `npx playwright codegen` records interactions into runnable test code.
- **Projects** — config matrix runs the same suite across browsers, devices, and viewports.

## Best practices
- Prefer role/label/text locators over CSS/XPath for resilient, user-facing tests (https://playwright.dev/docs/locators).
- Use web-first `expect` assertions instead of manual waits (https://playwright.dev/docs/test-assertions).
- Keep tests isolated via contexts; share auth state with `storageState` (https://playwright.dev/docs/auth).
- Enable traces/retries in CI to triage flakes (https://playwright.dev/docs/test-retries).

## Common pitfalls
- Manual `waitForTimeout` sleeps → rely on auto-waiting locators and `expect` polling.
- Brittle CSS selectors break on markup changes → use `getByRole`/`getByTestId`.
- Forgetting `await` on actions/assertions → every Playwright call returns a promise.

## Examples
```ts
import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
  await page.goto('https://playwright.dev/');
  await expect(page).toHaveTitle(/Playwright/);
});
```

## Further reading
- https://playwright.dev/docs/test-configuration — `playwright.config` and projects
- https://playwright.dev/docs/trace-viewer — debugging with traces

## Related skills
- ../cypress — in-browser E2E alternative with a time-travel debugger
- ../selenium — WebDriver-standard automation across many languages
- ../puppeteer — lower-level Chrome/Firefox control library
