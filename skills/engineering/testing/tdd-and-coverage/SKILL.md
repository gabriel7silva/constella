---
name: testing/tdd-and-coverage
description: Test-driven development's red-green-refactor cycle and how to read code coverage as a guide rather than a goal.
domain: engineering
category: engineering
tags: [tdd, testing, refactoring, coverage, red-green-refactor]
official_sources:
  - https://martinfowler.com/bliki/TestDrivenDevelopment.html
  - https://martinfowler.com/bliki/TestCoverage.html
verified: 2026-06-16
---

# TDD and Meaningful Coverage

## Overview
Test-driven development (TDD) is a workflow where you write a failing test before the production code, make it pass, then refactor — the red-green-refactor cycle. This skill pairs that discipline with a sober view of code coverage: a useful signal for finding untested code, but a poor target to optimize blindly. Read it when adopting TDD on a feature or when a team is being pressured by a coverage number.

## Official sources
- Bliki — Test Driven Development: https://martinfowler.com/bliki/TestDrivenDevelopment.html
- Bliki — Test Coverage: https://martinfowler.com/bliki/TestCoverage.html

## Core concepts
- **Red — green — refactor.** Write a test that fails (red), write the minimum code to pass it (green), then improve the structure of new and old code without changing behavior (refactor). Repeat.
- **List the cases first.** Fowler describes writing out a list of test cases up front, then picking one and applying red-green-refactor to it before moving to the next.
- **Self-testing code.** Because functional code only exists to satisfy a passing test, TDD produces a suite that lets you change code with confidence.
- **Design pressure.** Writing the test first "forces us to think about the interface to the code first," encouraging a clean separation of interface from implementation.
- **Coverage is a tool, not a target.** Coverage shows which lines/branches ran during tests; high coverage does not prove the tests assert the right things, and a fixed coverage percentage as a quality *gate* tends to be counterproductive (Fowler).

## Best practices
- Never skip the refactor step — Fowler calls neglecting it "the most common way... to screw up TDD," leaving a messy aggregation of code fragments.
- Keep each cycle small: one test, the simplest passing change, then clean up.
- Use coverage to *find* untested behavior and obvious gaps, not to chase 100%; review the uncovered lines, do not just read the number.
- Write tests that assert meaningful behavior and outcomes, so coverage reflects real verification rather than mere execution.

## Common pitfalls
- Treating a coverage percentage as the goal → use it diagnostically; high coverage with weak assertions is false comfort.
- Writing tests after the fact and calling it TDD → the value comes from test-first design pressure and the red step proving the test can fail.
- Dropping the refactor step once tests pass → schedule the cleanup as part of the same cycle, not "later."

## Examples
```ts
// 1. RED — write the failing test first
import { expect, test } from 'vitest'
import { slugify } from './slugify'
test('lowercases and hyphenates', () => {
  expect(slugify('Hello World')).toBe('hello-world')
})

// 2. GREEN — minimal implementation to pass
export const slugify = (s: string) =>
  s.toLowerCase().replace(/\s+/g, '-')

// 3. REFACTOR — improve structure/edge handling, keep tests green
```

## Further reading
- Test Coverage (Fowler): https://martinfowler.com/bliki/TestCoverage.html
- Self-Testing Code (Fowler): https://martinfowler.com/bliki/SelfTestingCode.html

## Related skills
- ../testing-strategy-pyramid — where TDD's unit tests sit in the portfolio
- ../unit-integration-e2e — the runners (Vitest) used to execute the cycle
