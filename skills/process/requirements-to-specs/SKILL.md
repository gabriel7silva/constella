# Skill — requirements-to-specs

**Trigger:** Requirements exist (from discovery, a slice, or stakeholder input) and must become testable specs with explicit acceptance criteria — before they are decomposed into issues or implemented.

Produces user stories with testable acceptance criteria (the "Confirmation" of each story) so every requirement has an unambiguous, verifiable definition of done.

## When to use
- You have requirements/needs and must turn them into something a team can build *and verify*.
- A requirement is stated vaguely ("users should be able to manage their data") and needs concrete, testable conditions.
- Before `specs-to-issues`, so each issue inherits clear acceptance criteria.

## When NOT to use
- The problem/slice is not yet validated — go to `product-discovery` / `idea-to-product`.
- Acceptance criteria already exist and are testable — go straight to `specs-to-issues`.
- It is exploratory research with no commitment to build.

## Required context & inputs
- The validated requirements / `mvp-slice.md` and problem statement.
- The wireflow + behavior annotations (`screen-flows.md`) and `architecture.md` if they exist.
- The org's `.claude/CLAUDE.md` conventions and (for Constella) the canonical `Spec.html` PAGES `beh:`/`cmp:` parity definitions.

## Procedure
Capture requirements lightweightly as **user stories** and confirm each with **acceptance criteria** — the conditions a story must satisfy to be complete, written as clear, concise, testable statements (Atlassian; the 3 C's = Card, Conversation, Confirmation — see Related).

1. **Express each requirement as a user story.** Use the template: *"As a [persona], I want to [action], so that [benefit/outcome]."* Keep it user-centric and solution-light.
2. **Hold the conversation.** Note the open questions and assumptions for each story; resolve them with the product owner. The card is a placeholder for this conversation, not a full spec.
3. **Write acceptance criteria (the Confirmation).** For each story, list the conditions that must be true for it to be done. Prefer:
   - **Scenario-oriented (Given/When/Then)** for behavior with clear pre-conditions, actions, and outcomes; and/or
   - **Rule-oriented checklists** for constraints, validations, and states.
4. **Make criteria testable.** Each criterion must be objectively pass/fail — no "fast", "intuitive", or "nice". State concrete values, states, and error cases.
5. **Cover non-happy paths.** Add criteria for empty/error/permission/validation states surfaced in the wireflow.
6. **Add non-functional acceptance** where relevant (performance budget, accessibility, security, and — for Constella — visual + structural parity to the baseline at the spec'd viewport).
7. **Check sizing.** A story should be small enough to build and verify within one increment; if its criteria sprawl, split it (defer the split mechanics to `specs-to-issues`/`breaking-work-into-sprints`).
8. **Get sign-off** on the criteria from whoever validates "done."

## Output format
- A `specs.md` (in the work item's planning folder): one section per user story (`As a … I want to … so that …`) followed by its acceptance criteria as Given/When/Then scenarios and/or a checklist, plus any non-functional criteria and a link to the relevant wireflow node.

## Quality & validation rules
- Every requirement maps to at least one story, and every story has at least one acceptance criterion.
- Every acceptance criterion is testable (objectively pass/fail) — a tester or automated check could confirm it without judgment calls.
- Non-happy-path and applicable non-functional criteria are present, not just the happy path.
- Criteria are solution-aware but not over-prescriptive of implementation. Done = each story's "done" is unambiguous and signed off, and (for Constella) parity criteria reference the canonical `Spec.html` behavior/component definitions.

## Failure handling
- **A requirement cannot be made testable:** it is too vague — loop back to the product owner / `problem-framing` to sharpen it; do not write a criterion you cannot verify.
- **Criteria reveal hidden complexity:** split the story and flag scope growth to planning.
- **Conflict between stories' criteria:** record the conflict and resolve before issues are created.
- Log unresolved questions per story in `specs.md` so they block, rather than silently leak into, implementation.

## Related
- Sources: https://www.atlassian.com/agile/project-management/user-stories ; https://www.atlassian.com/work-management/project-management/acceptance-criteria ; Given/When/Then (Gherkin) — https://cucumber.io/docs/gherkin/reference/
- Skills: ../idea-to-product, ../mocks-and-screen-flows, ../specs-to-issues, ../breaking-work-into-sprints
