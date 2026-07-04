---
name: cypress
description: Cypress is a JavaScript end-to-end and component testing tool that runs in a real browser with a time-travel debugger, automatic waiting, and network stubbing; consult when writing E2E or component tests, using cy commands and fixtures, intercepting network requests, or configuring cypress.config.
domain: stack
category: testing
tags: [cypress, e2e, javascript, browser-testing, component-testing, automation, web]
official_sources:
  - https://docs.cypress.io/app/get-started/why-cypress
  - https://github.com/cypress-io/cypress
  - https://www.npmjs.com/package/cypress
verified: 2026-06-17
---

# Cypress

## Overview
Cypress is an open-source, JavaScript-based testing tool that runs end-to-end, component, and integration tests directly inside the browser alongside your app. It executes in the same run loop as the page, giving automatic waiting, time-travel snapshots, and direct DOM/network control. Read this when writing E2E or component tests, stubbing network calls, debugging flaky selectors, or configuring the Cypress runner.

## Official sources
- Docs: https://docs.cypress.io/app/get-started/why-cypress
- Repo: https://github.com/cypress-io/cypress
- Install: https://www.npmjs.com/package/cypress

## Install / setup
```bash
npm install cypress --save-dev
```
Source: https://docs.cypress.io/app/get-started/install-cypress (open the runner with `npx cypress open`; requires Node.js 20.x, 22.x, or >=24.x).

## Core concepts
- **`cy` commands** — chained, retriable async actions like `cy.visit()`, `cy.get()`, `cy.click()`.
- **Automatic retry/waiting** — queries retry until assertions pass, removing most manual waits.
- **Selectors** — prefer `data-*` attributes via `cy.get('[data-cy=...]')` for stable targeting.
- **Fixtures** — load static JSON test data with `cy.fixture()`.
- **Network control** — `cy.intercept()` stubs, spies on, and asserts HTTP requests/responses.
- **Component testing** — mount framework components in isolation (React, Vue, Angular, Svelte).
- **Time-travel** — the runner snapshots each command for step-by-step DOM inspection.
- **Config** — `cypress.config.js` defines `baseUrl`, specs, viewport, and env per testing type.

## Best practices
- Target elements with dedicated `data-*` attributes, not CSS/text (https://docs.cypress.io/app/core-concepts/best-practices).
- Do not assign command return values to vars; chain or use aliases (https://docs.cypress.io/app/core-concepts/variables-and-aliases).
- Set state via API/`cy.request` or tasks rather than UI for speed (https://docs.cypress.io/app/core-concepts/best-practices).
- Avoid arbitrary `cy.wait(ms)`; wait on aliased routes instead (https://docs.cypress.io/api/commands/wait).

## Common pitfalls
- Mixing async/await with `cy` chains → use Cypress's command queue and `.then()`, not promises.
- Tests depend on prior test state → make each spec independent and reset between tests.
- Flaky `cy.wait(5000)` sleeps → `cy.intercept` a route, alias it, and `cy.wait('@alias')`.

## Examples
```js
describe('home page', () => {
  it('loads and shows the heading', () => {
    cy.visit('/');
    cy.get('[data-cy=heading]').should('contain', 'Welcome');
  });
});
```

## Further reading
- https://docs.cypress.io/api/table-of-contents — full command and assertion API
- https://docs.cypress.io/app/core-concepts/best-practices — official best-practices guide

## Related skills
- ../playwright — alternative cross-browser E2E framework with multi-context support
- ../selenium — WebDriver-based browser automation across languages
- ../puppeteer — lower-level Chrome/Firefox automation library
