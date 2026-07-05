---
name: code-review-practices
description: How to review and author code changes — what reviewers look for, review speed, and writing useful, kind review comments.
domain: engineering
category: practices
tags: [code-review, pull-request, review-checklist, collaboration]
official_sources:
  - https://google.github.io/eng-practices/review/
  - https://github.com/google/eng-practices
verified: 2026-06-16
---

# Code Review Practices

## Overview
Code review is the process where someone other than the change's author examines the code before it lands, primarily to keep the codebase healthy over time. Consult this when reviewing a pull/change request or preparing your own change for review. Google's Engineering Practices documentation is a well-known, freely published reference for both reviewers and change authors.

## Official sources
- Docs: https://google.github.io/eng-practices/review/
- Repo: https://github.com/google/eng-practices

## Core concepts
- **Purpose of review.** Review exists to maintain the overall health of the codebase over time, not to demand perfection in every change.
- **What reviewers look at.** Google's guide enumerates areas to examine: design, functionality (does it do what the author intended), complexity/simplicity, tests, naming, comments, style-guide compliance, and documentation updates.
- **The reviewer/author split.** Google publishes two complementary guides — one for the *reviewer* (how to review) and one for the *change author* (how to get a change reviewed smoothly).
- **Speed matters.** Reviews should be fast: slow reviews block authors, delay feedback, and degrade team velocity, so reviewers are expected to respond promptly even if a full review takes longer.
- **Alternatives exist.** Pair programming and in-person review are valid substitutes for asynchronous review in some situations.

## Best practices
- **Review for design first, nits last.** Confirm the change is well-designed and does the right thing before quibbling over minor style (which a linter should catch anyway).
- **Be prompt.** Respond to review requests quickly to keep authors unblocked, even when the change is large enough to need follow-up.
- **Write kind, actionable comments.** Explain the reasoning behind a request, and clearly distinguish must-fix issues from optional suggestions (e.g. prefix non-blocking nits).
- **Approve once it improves overall code health.** A change does not have to be perfect to be approved — only a net improvement to the codebase that is appropriately tested.

## Common pitfalls
- **Demanding perfection / endless rounds** → approve once the change improves code health; capture larger ideas as follow-up rather than blocking.
- **Letting reviews sit for days** → prioritize prompt responses; slow reviews are a primary cause of team frustration and slowdown.
- **Vague comments ("this is wrong")** → state the problem, why it matters, and a concrete suggested fix; mark optional items as optional.

## Examples
```text
Review comment styles (author-friendly):

  Blocking:   This query runs inside the loop, so it's O(n) round-trips.
              Move it out of the loop or batch the IDs.

  Optional:   Nit (non-blocking): `getUserData` could be `fetchUser` to
              match the naming used elsewhere in this file.
```

## Further reading
- The Standard of Code Review: https://google.github.io/eng-practices/review/reviewer/standard.html
- How to write code review comments: https://google.github.io/eng-practices/review/reviewer/comments.html
- The CL author's guide: https://google.github.io/eng-practices/review/developer/

## Related skills
- ../clean-code — many review checks (naming, cohesion) are clean-code concerns
- ../git-workflow — PRs and commit hygiene that make changes reviewable
