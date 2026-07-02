# Skill — mocks-and-screen-flows

**Trigger:** A scoped slice or feature needs a UI and you are about to design or build screens — before any component or page code is written.

Produces a wireflow (screen mocks wired by interaction arrows) that maps every screen state and transition for the flow, so engineers build from an unambiguous visual + behavioral spec.

## When to use
- A user-facing flow must be designed: you know the job-to-be-done but not the exact screens, states, and transitions.
- The app is dynamic (content/state changes on a few core screens, AJAX-style updates, checkout/filter/onboarding flows) where a static screen-by-screen wireframe set would not capture behavior.
- In Constella, before reproducing or extending UI, to nail the 3-axis parity target (visual + structure + behavior) the build will be judged against.

## When NOT to use
- The flow is a large static website with many discrete linked pages and little dynamic behavior — a sitemap + page wireframes fit better than a wireflow.
- An approved mock/`Spec.html` already exists and is canonical — build to it (parity work), do not re-design.
- No UI is involved (pure backend/data work).

## Required context & inputs
- The scoped slice (`mvp-slice.md`) and the job-to-be-done / problem statement.
- The org's design system / existing components and `.claude/CLAUDE.md` UI conventions, plus any prototype baseline to match.
- The list of user goals/tasks this flow must support.

## Procedure
Build a **wireflow**: wireframe-style page layouts connected by a simplified flowchart of interactions, where an arrow leaves the specific UI element a user acts on and points to the resulting screen *state* (see Related).

1. **List the tasks & happy path.** Enumerate the user goals this flow serves and the primary (happy-path) sequence of steps to complete each.
2. **Sketch low-fidelity first.** Rough each distinct screen as a wireframe (layout, key elements, content placeholders) — paper/whiteboard fidelity. Resolve structure before visual polish.
3. **Wire interactions.** From each actionable element (button, link, field, filter), draw an arrow to the resulting state. That state may be a *new* screen, the *same* screen with changed content, or a feedback element (confirmation, error, loading).
4. **Cover non-happy states.** Add empty, loading, error, validation-failure, and permission-denied states as their own nodes — these are where builds usually diverge from intent.
5. **Map branches & loops.** Show decision points (auth required, item in/out of stock) and back/cancel paths so no transition is undefined.
6. **Raise fidelity to mocks.** Once the flow is complete and reviewed, raise the wireframes to mocks using the design system so visual detail matches the build target.
7. **Annotate behavior.** Note any logic an image cannot convey (validation rules, what data populates a region, side effects of an action) next to the relevant arrow/node.
8. **Review against the tasks.** Walk each user task through the wireflow end-to-end; confirm every step has a screen and every action has a defined result.

## Output format
- A wireflow artifact (image/Figma link, or `Spec.html`-style page in the work item folder) showing every screen state as a node and every interaction as a labeled arrow to its resulting state.
- A short `screen-flows.md` listing the tasks covered, each screen state, and the behavior annotations (validation, data sources, side effects) keyed to the wireflow.

## Quality & validation rules
- Every actionable element has exactly one defined resulting state; no dangling or ambiguous transitions.
- Empty / loading / error / edge states are present, not just the happy path.
- Every user task from step 1 can be traced node-to-node through the wireflow to completion.
- Mocks reference real design-system components and (for parity work) match the prototype baseline. Done = an engineer could build the flow without guessing any state or transition.

## Failure handling
- **A transition's target state is unknown:** stop and resolve it with the product owner; do not let engineering invent it.
- **Flow has too many screens to wireflow cleanly:** split into sub-flows (one wireflow per task) and link them.
- **Mock conflicts with design-system constraints:** flag the conflict in `screen-flows.md` and resolve before build, not during.
- Record open UI questions in `screen-flows.md` so the build phase inherits them.

## Related
- Sources: https://www.nngroup.com/articles/wireflows/ ; https://www.nngroup.com/articles/wireframe-fidelity/
- Skills: ../idea-to-product, ../requirements-to-specs, ../architecture-before-code
