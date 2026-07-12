---
name: vitest
description: Vitest is a Vite-native, Jest-compatible testing framework with instant HMR-style watch, ESM/TS support, and built-in coverage; consult when testing Vite/Vue/React/Svelte projects, migrating from Jest, configuring vitest.config, or using in-source and browser-mode testing.
domain: stack
category: testing
tags: [vitest, vite, javascript, typescript, unit-testing, esm, vue]
official_sources:
  - https://vitest.dev/guide/
  - https://github.com/vitest-dev/vitest
  - https://www.npmjs.com/package/vitest
verified: 2026-06-17
---

# Vitest

## Overview
Vitest is a next-generation testing framework powered by Vite that reuses your app's Vite config and transform pipeline for native ESM, TypeScript, and JSX support. Its API is largely Jest-compatible (`describe`/`it`/`expect`), with a fast smart-watch mode. Read this when adding tests to a Vite-based project, migrating from Jest, configuring coverage, or setting up jsdom/browser environments.

## Official sources
- Docs: https://vitest.dev/guide/
- Repo: https://github.com/vitest-dev/vitest
- Install: https://www.npmjs.com/package/vitest

## Install / setup
```bash
npm install -D vitest
```
Source: https://vitest.dev/guide/ (add a `"test": "vitest"` script, then run `npm run test`).

## Core concepts
- **Vite-powered** — reuses `vite.config` plugins/resolve/aliases, so tests transform code like the app does.
- **Jest-compatible API** — `describe`, `it`/`test`, `expect`, `vi.fn()`/`vi.mock()` ease migration.
- **Smart watch** — reruns only tests affected by changed modules via the module graph.
- **Environments** — `node`, `jsdom`, or `happy-dom` per file via `// @vitest-environment` or config.
- **In-source testing** — colocate tests inside source using `import.meta.vitest`.
- **Coverage** — `--coverage` backed by v8 or istanbul providers.
- **`vi` utility** — mocks, spies, fake timers, and module stubbing namespace.
- **Browser mode** — run component tests in a real browser via the experimental browser runner.

## Best practices
- Share one config: import the app's Vite plugins so tests resolve identically (https://vitest.dev/config/).
- Pick the lightest environment per suite; default `node` is fastest (https://vitest.dev/guide/environment).
- Use `vi.mock` hoisting awareness and `vi.resetAllMocks()` between tests (https://vitest.dev/api/vi).
- Enable `globals: true` only if you want Jest-style implicit globals (https://vitest.dev/config/#globals).

## Common pitfalls
- Forgetting `await` on async expectations → use `await expect(p).resolves` / `.rejects`.
- `vi.mock` not applied → it is hoisted; keep factory pure and import the mocked module after.
- Tests pass in Jest but fail here on ESM → rely on Vite resolution, not Jest's CJS transforms.

## Examples
```ts
import { expect, test } from 'vitest';
import { sum } from './sum';

test('adds 1 + 2 to equal 3', () => {
  expect(sum(1, 2)).toBe(3);
});
```

## Further reading
- https://vitest.dev/api/ — full test and `expect` API
- https://vitest.dev/guide/migration — migrating from Jest

## Related skills
- ../jest — the framework Vitest's API mirrors
- ../cypress — pairs with Vitest for E2E coverage above unit tests
- ../playwright — browser-level E2E to complement Vitest unit tests
