---
name: jest
description: Jest is a zero-config JavaScript/TypeScript testing framework with a built-in runner, assertions, mocking, snapshots, and coverage; consult when writing or debugging unit tests, mocking modules, snapshot testing, or configuring jest.config for Babel/TS/React/Vue/Node projects.
domain: stack
category: testing
tags: [jest, javascript, typescript, unit-testing, mocking, snapshot, node]
official_sources:
  - https://jestjs.io/docs/getting-started
  - https://github.com/jestjs/jest
  - https://www.npmjs.com/package/jest
verified: 2026-06-17
---

# Jest

## Overview
Jest is a JavaScript testing framework focused on simplicity that works out of the box on most projects (Babel, TypeScript, Node, React, Angular, Vue). It bundles a test runner, `expect` assertions, mocking, snapshot testing, and coverage in one tool. Read this when writing unit/integration tests, mocking modules or timers, debugging snapshot mismatches, or configuring Jest for a JS/TS codebase.

## Official sources
- Docs: https://jestjs.io/docs/getting-started
- Repo: https://github.com/jestjs/jest
- Install: https://www.npmjs.com/package/jest

## Install / setup
```bash
npm install --save-dev jest
```
Source: https://jestjs.io/docs/getting-started (install via your package manager, then run with `npx jest`).

## Core concepts
- **`test` / `it`** — declare a test; pair with a `describe` block to group related cases.
- **`expect` matchers** — `toBe`, `toEqual`, `toContain`, `toThrow`, etc. drive assertions.
- **Snapshot testing** — `toMatchSnapshot()` serializes output to `__snapshots__` and diffs on rerun.
- **Mock functions** — `jest.fn()`, `jest.spyOn()`, and `jest.mock()` replace dependencies and record calls.
- **Setup/teardown** — `beforeEach`/`afterEach`/`beforeAll`/`afterAll` manage shared fixtures.
- **Fake timers** — `jest.useFakeTimers()` controls `setTimeout`/`Date` for deterministic time-based tests.
- **Parallelism** — tests run in isolated worker processes; use `--runInBand` to debug serially.
- **Coverage** — add `--coverage` to emit reports with no extra setup.

## Best practices
- Keep tests isolated and deterministic; reset mocks with `clearMocks: true` (https://jestjs.io/docs/configuration).
- Prefer explicit matchers over generic `toBe` so failures read clearly (https://jestjs.io/docs/expect).
- Review snapshots in code review and regenerate intentionally with `--ci`/`-u` (https://jestjs.io/docs/snapshot-testing).
- Mock only external boundaries (network, fs, time); test real logic (https://jestjs.io/docs/mock-functions).

## Common pitfalls
- Async test passes despite a failed promise → `return`/`await` the promise or use `resolves`/`rejects`.
- Stale snapshots hide regressions → run `jest -u` only after verifying the change is intended.
- Leaked timers/handles hang the run → use fake timers and `--detectOpenHandles`.

## Examples
```js
const sum = require('./sum');

test('adds 1 + 2 to equal 3', () => {
  expect(sum(1, 2)).toBe(3);
});
```

## Further reading
- https://jestjs.io/docs/cli — full CLI flag reference
- https://jestjs.io/docs/configuration — `jest.config.js` options

## Related skills
- ../vitest — Vite-native alternative with a Jest-compatible API
- ../mocha — flexible runner often paired with a separate assertion library
- ../jasmine — BDD framework Jest's API descends from
