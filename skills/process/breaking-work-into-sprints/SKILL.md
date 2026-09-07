# Skill — breaking-work-into-sprints

**Trigger:** A backlog of well-formed issues/stories exists and must be sliced into deliverable increments (sprints) with a goal and a Definition of Done — before the team starts building.

Produces a Sprint Backlog (Sprint Goal + selected items + a plan) where every increment is potentially releasable and meets a shared Definition of Done.

## When to use
- The work item's backlog (from `specs-to-issues`) is ready and must be scheduled into one or more increments.
- You need to commit to a focused, achievable goal for the next increment rather than "do everything".
- A feature is too large for one increment and must be delivered in usable slices.

## When NOT to use
- Issues/specs do not exist yet — go to `specs-to-issues` / `requirements-to-specs`.
- Decomposing a raw idea into an MVP — that is `idea-to-product` (this skill schedules already-defined work).
- The org does not run iterative increments and uses continuous flow only — adapt the Definition-of-Done and increment-sizing parts, skip the time-box.

## Required context & inputs
- The prioritized backlog of issues (`issues.md`) with acceptance criteria and dependencies.
- The team's capacity, the Product Goal, and the agreed **Definition of Done**.
- Dependency/ordering constraints from `architecture.md`.

## Procedure
Run **Sprint Planning** per the Scrum Guide: a Sprint is a fixed-length container (one month or less) in which ideas turn into value; planning answers **Why** (the Sprint Goal), **What** (selected Product Backlog items), and **How** (the plan to deliver them). Nothing counts as part of the **Increment** until it meets the **Definition of Done** (see Related).

1. **Confirm the Definition of Done.** Make explicit the quality bar an increment must meet to be releasable (built, tested, reviewed, parity-checked, docs updated, deployed/deployable). For Constella, include the 3-axis parity gate and build/typecheck gates.
2. **Refine the backlog (Why-ready).** Ensure top items are small, clear, and estimated. Split any item too large to finish within one Sprint (`specs-to-issues` mechanics). Order by value and dependency.
3. **Set the Sprint Goal (Why).** Define one coherent objective for the increment that delivers user/business value — the single thing the increment is *about*. Items are selected to serve it.
4. **Select the work (What).** Pull the highest-value, dependency-respecting items from the top of the backlog that fit the team's capacity and serve the goal. Do not overcommit; capacity, not ambition, sets the line.
5. **Plan the delivery (How).** Break selected items into the concrete tasks needed to meet the Definition of Done (build, test, review, integrate). This is the Sprint Backlog.
6. **Sequence within the increment.** Order tasks so dependencies are satisfied and a usable slice emerges early; front-load the riskiest item.
7. **Make each increment releasable.** Each Sprint must produce at least one valuable, usable Increment that meets the Definition of Done — not a half-done layer.
8. **Reserve continuous refinement.** Keep refining the rest of the backlog during the increment so the next planning is fast.

## Output format
- A `sprint-plan.md` (or tracker sprint/board) per increment containing: the **Sprint Goal**, the **selected items** (links to issues), the **delivery plan** (task breakdown per item), the **Definition of Done** in force, and the dependency-aware sequence.
- For multi-sprint features, a short increment roadmap listing each Sprint Goal and the releasable slice it ships.

## Quality & validation rules
- Every selected item fits within the increment and traces to the Sprint Goal; nothing selected is unrelated to the goal.
- The increment is potentially releasable and every included item can meet the Definition of Done — no item is "done except for testing/review".
- Selection respects capacity (no overcommit) and dependency order (nothing scheduled before its blocker).
- The Definition of Done is explicit and shared. Done = the team agrees the plan is achievable and the increment, if completed, ships real value.

## Failure handling
- **An item is too big for one Sprint:** split it before committing; never carry an unsplittable giant into the increment.
- **Capacity does not fit the goal:** narrow the Sprint Goal or drop lowest-value items — keep the increment releasable rather than overcommitting.
- **A blocking dependency is unresolved:** reorder or descope; do not schedule blocked work.
- **Scope discovered mid-increment:** add to the backlog for refinement, not to the current Sprint, unless it serves the goal and capacity allows; record the change.
- Log the goal, commitments, and any descoping in `sprint-plan.md` for the increment review.

## Related
- Sources: https://scrumguides.org/scrum-guide.html (2020 Scrum Guide — Sprint, Sprint Planning, Increment, Definition of Done)
- Skills: ../specs-to-issues, ../requirements-to-specs, ../idea-to-product
