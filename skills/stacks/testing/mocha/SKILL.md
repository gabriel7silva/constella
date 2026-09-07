---
name: mocha
description: Mocha is a flexible JavaScript test framework for Node.js and the browser that runs tests serially with rich async support and pluggable assertions/reporters; consult when structuring describe/it suites, choosing an assertion library like Chai, testing async code, or configuring .mocharc.
domain: stack
category: testing
tags: [mocha, javascript, node, test-runner, bdd, async, chai]
official_sources:
  - https://mochajs.org/
  - https://github.com/mochajs/mocha
  - https://mochajs.org/getting-started/
verified: 2026-06-17
---

# Mocha

## Overview
Mocha is a feature-rich JavaScript test framework that runs on Node.js and in the browser, making asynchronous testing simple. It provides the test structure (`describe`/`it`), hooks, and reporters but leaves assertions to a library of your choice (commonly Chai). Tests run serially for accurate reporting and correct mapping of uncaught exceptions. Read this when organizing suites, testing promises/callbacks, picking reporters, or configuring Mocha.

## Official sources
- Docs: https://mochajs.org/
- Repo: https://github.com/mochajs/mocha
- Install: https://mochajs.org/getting-started/

## Install / setup
```bash
npm install --save-dev mocha
```
Source: https://mochajs.org/getting-started/ (Mocha 11.x — current latest, 11.7.x — requires Node.js `^18.18.0 || ^20.9.0 || >=21.1.0`; the upcoming v12, still in beta, will require `^20.19.0 || >=22.12.0`; run with `npx mocha`).

## Core concepts
- **`describe` / `it`** — group suites and declare individual test cases (BDD-style).
- **Hooks** — `before`, `after`, `beforeEach`, `afterEach` set up and tear down state.
- **Async support** — return a promise, `await`, or call the `done` callback to test async code.
- **Pluggable assertions** — bring Chai, Node's `assert`, or another library; Mocha ships none.
- **Reporters** — `spec`, `dot`, `tap`, `json`, etc. format results via `--reporter`.
- **Exclusivity/skip** — `.only` and `.skip` focus or omit suites and tests.
- **Configuration** — `.mocharc.{js,json,yml}` sets specs, timeouts, requires, and flags.
- **Browser support** — runs the same tests in browsers alongside Node.

## Best practices
- Use `--require` to load Babel/TS or setup hooks consistently (https://mochajs.org/interfaces/require/).
- Set realistic timeouts per slow test rather than globally inflating them (https://mochajs.org/features/timeouts/).
- Avoid arrow functions when you need Mocha's `this` context for timeouts (https://mochajs.org/features/arrow-functions/).
- Return promises instead of mixing `done` with async/await (https://mochajs.org/features/asynchronous-code/).

## Common pitfalls
- Calling `done()` and returning a promise both → pick one async style, not both.
- Arrow-function tests break `this.timeout()` → use `function () { ... }`.
- Unhandled rejection passes silently → always `await`/return the async assertion.

## Examples
```js
const assert = require('assert');

describe('Array', () => {
  describe('#indexOf()', () => {
    it('returns -1 when the value is not present', () => {
      assert.equal([1, 2, 3].indexOf(4), -1);
    });
  });
});
```

## Further reading
- https://mochajs.org/running/cli/ — CLI flags and config
- https://www.chaijs.com/ — Chai assertion library commonly paired with Mocha

## Related skills
- ../jasmine — batteries-included BDD framework with built-in assertions
- ../jest — all-in-one runner with bundled assertions and mocking
- ../vitest — Vite-native runner with a Jest-style API
