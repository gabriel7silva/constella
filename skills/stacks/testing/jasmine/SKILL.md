---
name: jasmine
description: Jasmine is a dependency-free behavior-driven JavaScript testing framework for browsers and Node.js with built-in matchers, spies, and async support; consult when writing describe/it specs, using expect matchers and spies, testing async code, or running standalone browser and Node suites.
domain: stack
category: testing
tags: [jasmine, javascript, bdd, node, browser-testing, spies, unit-testing]
official_sources:
  - https://jasmine.github.io/
  - https://github.com/jasmine/jasmine
  - https://jasmine.github.io/pages/getting_started.html
verified: 2026-06-17
---

# Jasmine

## Overview
Jasmine is a behavior-driven development (BDD) framework for testing JavaScript that has no dependencies on any other framework and needs no DOM. It runs in browsers and Node.js with the same clean `describe`/`it`/`expect` syntax, bundling matchers, spies, clocks, and async helpers out of the box. Read this when writing unit specs, spying on functions, controlling time, or testing asynchronous code without extra assertion libraries.

## Official sources
- Docs: https://jasmine.github.io/
- Repo: https://github.com/jasmine/jasmine
- Install: https://jasmine.github.io/pages/getting_started.html

## Install / setup
```bash
npm install --save-dev jasmine
```
Source: https://jasmine.github.io/setup/nodejs.html (run `npx jasmine init` to scaffold config, then `npx jasmine`).

## Core concepts
- **`describe` / `it`** — group specs and define expectations in readable BDD style.
- **`expect` + matchers** — built-in `toBe`, `toEqual`, `toContain`, `toThrow`, and custom matchers.
- **Spies** — `spyOn` and `jasmine.createSpy` stub and record function calls and returns.
- **Setup/teardown** — `beforeEach`/`afterEach`/`beforeAll`/`afterAll` manage shared state.
- **Async support** — return a promise, `await`, or use the `done` callback.
- **Clock** — `jasmine.clock()` fakes `setTimeout`/`Date` for deterministic timing.
- **Configuration** — `spec/support/jasmine.json` defines spec dirs, helpers, and patterns.
- **Standalone runner** — a browser distribution runs specs without Node tooling.

## Best practices
- Use `beforeEach` to reset state so specs stay independent (https://jasmine.github.io/tutorials/your_first_suite).
- Prefer specific matchers and write custom ones for clarity (https://jasmine.github.io/tutorials/custom_matchers).
- Spy on collaborators rather than calling real side effects (https://jasmine.github.io/tutorials/your_first_suite).
- Use the clock for time-dependent code instead of real delays (https://jasmine.github.io/tutorials/your_first_suite).

## Common pitfalls
- Async spec finishes before assertions run → return the promise or call `done()`.
- Forgetting to install the clock makes timer tests flaky → `jasmine.clock().install()`/`uninstall()`.
- Shared mutable state leaks across specs → re-initialize in `beforeEach`.

## Examples
```js
describe('A suite', () => {
  it('contains a spec with an expectation', () => {
    expect(true).toBe(true);
  });
});
```

## Further reading
- https://jasmine.github.io/tutorials/your_first_suite — first suite walkthrough
- https://jasmine.github.io/api/edge/global — global matcher and spy API

## Related skills
- ../mocha — flexible runner needing a separate assertion library
- ../jest — Jasmine-derived framework with snapshots and built-in mocking
- ../vitest — Vite-native runner with a Jest-style API
