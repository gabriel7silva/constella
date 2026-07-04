# Skill — testing-before-done

**Trigger:** A feature or change is being planned, and "done" must be defined as "tested" — the test strategy is decided *before* implementation, not after.

Produces a test plan shaped by the Test Pyramid (the right tests at the right levels) and a definition of done that gates merge on those tests passing.

## When to use
- Starting any non-trivial feature where correctness matters.
- Defining or revising what "done" means for a team or workstream.
- A bug was found by a high-level/manual test and you need to lock it down at the right level.

## When NOT to use
- A throwaway spike or prototype explicitly marked as not production-bound.
- The change is purely a config/copy tweak with no behavior change (still verify, but a full pyramid is overkill).
- Security-specific test design — derive those cases from `process/security-by-design` and feed them in here.

## Required context & inputs
- The feature's acceptance criteria / user stories (from `process/app-planning`).
- The architecture: which units, services/APIs, and UI flows exist (C4 Container/Component views).
- The org's stack and existing test tooling/runner (from `.claude/CLAUDE.md` and the repo).
- Any security mitigations that need proof (from `process/security-by-design`).

## Procedure
1. **Define "done" before coding.** State explicitly: a change is done only when its tests exist, run in CI, and pass. Write this into the plan so it gates merge — testing is not an afterthought phase.
2. **Shape the suite as a pyramid (Fowler/Cohn).** Plan many fast, cheap **unit tests** at the base; fewer **service/integration tests** in the middle (exercise the API/service layer below the UI — "subcutaneous" tests); and very few **UI/end-to-end tests** at the top. The rule: many more low-level unit tests than broad GUI tests.
3. **Assign each acceptance criterion to a level.** For each behavior, choose the *lowest* level that can meaningfully test it:
   - Pure logic / a single function or class → unit test.
   - Interaction across components or a service contract → integration/service test.
   - A full critical user journey end-to-end → one UI/E2E test (reserve these for the handful of journeys that must never break).
4. **Justify every high-level test.** UI/E2E tests are brittle, expensive to write, slow to run, and prone to non-determinism. Only add one when the journey can't be covered lower down. If you're tempted to add many, that's a signal to push coverage down the pyramid.
5. **Set the bug-fix protocol.** When a high-level or manual test exposes a bug, first replicate it with a **unit test**, then fix it. High-level tests are a second line of defense — they catch gaps the unit tests missed, and each gap becomes a new low-level test.
6. **Plan for determinism and speed.** Identify flaky risk (timing, network, shared state) and design isolation/mocks so the base of the pyramid stays fast and trustworthy — a non-deterministic suite erodes trust and gets ignored.
7. **Write tests alongside (or before) the code.** Tests are part of the deliverable, authored with the implementation, not bolted on after. They run in CI on every change.

## Output format
- A `test-plan.md` (or the plan's testing section) in the workspace containing:
  - The definition of done (tests exist + pass in CI gates merge).
  - A coverage table: `Acceptance criterion | Test level | Why this level | Test name/file`.
  - The pyramid shape target (rough ratio of unit : integration : E2E for this feature).
  - The list of critical journeys getting an E2E test (kept short, each justified).
- Security-derived test cases from `process/security-by-design`, slotted into the table at their level.

## Quality & validation rules
- "Done = tested and green in CI" is written down and gates merge.
- Every acceptance criterion maps to at least one planned test.
- The suite is bottom-heavy: unit tests outnumber integration tests, which outnumber E2E tests.
- Each behavior is tested at the lowest level that can verify it; nothing pushed to E2E that a unit test could cover.
- Every E2E/UI test has a one-line justification for why it can't live lower.
- The bug-fix protocol (replicate with a unit test, then fix) is part of the team's definition.
- Tests are deterministic — known flaky vectors are isolated or mocked.

## Failure handling
- **A behavior seems testable only via the UI** → re-examine the architecture for a service/API seam (subcutaneous test) before accepting an E2E test.
- **The suite is slow/flaky** → move coverage down the pyramid and isolate non-determinism; do not paper over flakiness with retries as a permanent fix.
- **A bug recurs** → it lacked a low-level test; add the unit test that reproduces it before re-fixing.
- **Pressure to ship untested** → that change is not done by definition; record the gap as explicit, accepted test debt with an owner rather than silently calling it complete.

## Related
- Sources:
  - Test Pyramid — https://martinfowler.com/bliki/TestPyramid.html
- Skills: `process/app-planning`, `process/security-by-design`, `process/review-code-perf-security`
