---
name: refactoring
description: Improving code's internal structure without changing observable behavior, via small steps verified by tests.
domain: engineering
category: practices
tags: [refactoring, code-smells, tests, technical-debt]
official_sources:
  - https://refactoring.com/
  - https://refactoring.com/catalog/
verified: 2026-06-16
---

# Refactoring

## Overview
Refactoring is changing the internal structure of software to make it easier to understand and cheaper to modify — *without* changing its observable behavior. Consult this when cleaning up code before or after adding a feature, paying down technical debt, or making a change feel hard. Martin Fowler's refactoring.com defines the discipline and catalogs the named refactorings.

## Official sources
- Docs (definition): https://refactoring.com/
- Catalog of named refactorings: https://refactoring.com/catalog/

## Core concepts
- **Definition (behavior-preserving).** Per Fowler, refactoring is "a change made to the internal structure of software to make it easier to understand and cheaper to modify without changing its observable behavior."
- **A series of small transformations.** The heart of refactoring is many tiny behavior-preserving steps; each does little, but the sequence produces a significant restructuring. Small steps make it less likely to go wrong.
- **Keep the system working.** The system is kept fully working after each refactoring, which reduces the chance it gets seriously broken mid-change.
- **Code smells.** Smells are easy-to-spot surface symptoms (e.g. long functions, duplicated code, large classes) that often point to a deeper problem worth refactoring. Fowler's catalog pairs common smells with the refactorings that address them.
- **Tests as the safety net.** Running tests after each change is what makes refactoring predictable and safe; when automated refactoring tools are unavailable, frequent testing is how mistakes get caught.

## Best practices
- **Refactor under green tests.** Have a passing test suite first; refactor in small steps and re-run tests after each, so any break is localized to the last change.
- **Separate refactoring from behavior change.** Do not mix a refactoring commit with a feature/bugfix commit — keep "tidy structure" and "change behavior" as distinct steps (and ideally distinct commits).
- **Refactor when it makes the next change easier.** Tidy the area you are about to modify ("preparatory refactoring") rather than scheduling a big separate cleanup.
- **Take small steps.** Prefer many tiny, reversible transformations over one large rewrite; this keeps the system shippable throughout.

## Common pitfalls
- **Refactoring without tests** → add characterization tests first; without a safety net you cannot tell whether behavior was preserved.
- **Mixing refactoring with feature work in one big diff** → split into structure-only changes and behavior changes so reviewers (and `git bisect`) can reason about each.
- **Big-bang rewrite instead of stepwise change** → break it into a sequence of small named refactorings, keeping the build green between each.

## Examples
```javascript
// Smell: long function mixing extraction and formatting.
// Step 1 — Extract Function (behavior preserved), run tests:
function printOwing(invoice) {
  printBanner();
  const outstanding = calculateOutstanding(invoice); // extracted
  printDetails(invoice, outstanding);                 // extracted
}
// Each extraction is a small step; tests stay green throughout.
```

## Further reading
- Catalog of refactorings: https://refactoring.com/catalog/
- Community: refactoring.guru groups smells/techniques into browsable categories (commercial site, not an official source): https://refactoring.guru/refactoring

## Related skills
- ../clean-code — the target state refactoring moves toward
- ../code-review-practices — reviewers flag smells; refactoring resolves them
