---
name: testing/unit-integration-e2e
description: The three test layers and the tooling that implements them — Vitest for unit/integration and Playwright for end-to-end browser tests.
domain: engineering
category: engineering
tags: [testing, vitest, playwright, e2e, integration, unit-tests]
official_sources:
  - https://vitest.dev/guide/
  - https://playwright.dev/docs/intro
verified: 2026-06-16
---

# Unit, Integration, and End-to-End Tests

## Overview
This skill maps the three test layers to concrete tooling: **unit** and **integration** tests with Vitest (a Vite-native test runner) and **end-to-end** browser tests with Playwright. Read it when setting up a test suite in a Vite/TypeScript stack and deciding which framework runs which layer. The strategy for how many tests live at each layer is covered by the sibling test-pyramid skill.

## Official sources
- Docs: Vitest — https://vitest.dev/guide/ ; Playwright — https://playwright.dev/docs/intro
- Repo: https://github.com/vitest-dev/vitest ; https://github.com/microsoft/playwright
- Install: https://vitest.dev/guide/ ; https://playwright.dev/docs/intro

## Install / setup
```bash
# Unit & integration tests (Vitest)
npm install -D vitest

# End-to-end browser tests (Playwright) — scaffolds config, tests/, browsers
npm init playwright@latest
```

## Core concepts
- **Unit tests** isolate a single function/module, run in milliseconds, and pinpoint failures. In Vitest they live in `*.test.ts` / `*.spec.ts` files and use the `expect` matcher API.
- **Integration tests** exercise several units together (e.g. a service plus its DB or HTTP layer). Vitest runs these through the same runner; choose an environment such as `node` or `jsdom`/`happy-dom` for DOM-dependent code.
- **End-to-end (e2e) tests** drive a real browser through real user journeys. Playwright is "an end-to-end test framework for modern web apps" that runs across Chromium, Firefox, and WebKit.
- **Vitest is Vite-native:** it reads your `vite.config.*` by default, so existing Vite plugins and aliases work in tests out of the box (requires Vite >=6 and Node >=20).
- **Playwright runs cross-browser in parallel,** headless by default, with a headed mode and an interactive UI Mode for debugging, plus an HTML reporter.
- **Auto-waiting:** Playwright waits for elements to be actionable before acting, reducing flaky timing-based failures common in older e2e tools.

## Best practices
- Run unit/integration tests with Vitest in watch mode during development (`vitest`) and once in CI (`vitest run`).
- Keep e2e tests few and focused on critical paths; they are the slow, broad top of the pyramid.
- Prefer Playwright's web-first locators and auto-waiting assertions over manual sleeps to avoid flaky tests.
- Run Playwright across the browsers your users actually use; it is supported on Windows, Linux, and macOS, locally or in CI.

## Common pitfalls
- Using Playwright (or any e2e tool) for logic that a Vitest unit test could check → push the assertion down to the cheapest layer.
- Mixing the `@vitest/browser` Playwright provider with a separate `@playwright/test` install in one project can conflict → pick one driver per project (per upstream issues).
- Forgetting to select a DOM environment in Vitest for component/DOM tests → set `environment: 'jsdom'` (or `happy-dom`) so `document` exists.

## Examples
```ts
// Vitest unit test — sum.test.ts
import { expect, test } from 'vitest'
import { sum } from './sum'
test('adds numbers', () => {
  expect(sum(2, 3)).toBe(5)
})
```
```ts
// Playwright e2e test — example.spec.ts
import { test, expect } from '@playwright/test'
test('homepage has title', async ({ page }) => {
  await page.goto('https://example.com')
  await expect(page).toHaveTitle(/Example/)
})
```

## Further reading
- Vitest config reference: https://vitest.dev/config/
- Playwright writing tests: https://playwright.dev/docs/writing-tests

## Related skills
- ../testing-strategy-pyramid — how many tests to write per layer
- ../tdd-and-coverage — red-green-refactor and measuring coverage
