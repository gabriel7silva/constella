# Skill — specs-to-issues

**Trigger:** Specs with acceptance criteria exist and must be decomposed into well-formed, trackable tracker issues — before work is scheduled or started.

Produces a set of independent, vertically-sliced issues (each with a clear title, context, acceptance criteria, and metadata) that the team can pick up, build, and close.

## When to use
- Specs/user stories are ready and need to become units of work in the tracker (GitHub Issues, Jira).
- A large story (epic) must be broken into stories small enough to deliver.
- Before sprint planning, so the backlog contains well-formed, estimable items.

## When NOT to use
- The specs/acceptance criteria do not yet exist or are untestable — go to `requirements-to-specs`.
- Slicing into time-boxed delivery increments — that is `breaking-work-into-sprints` (this skill produces the items; that skill schedules them).
- Trivial one-line fixes where an issue would be ceremony (still record them, but skip decomposition).

## Required context & inputs
- The `specs.md` (stories + acceptance criteria) and any `architecture.md` / `screen-flows.md`.
- The tracker in use and the org's issue templates/labels/milestones conventions (from `.claude/CLAUDE.md` or the repo).
- Existing related issues (to avoid duplicates and to set dependencies).

## Procedure
Issues track "bug reports, new features and ideas, and anything else you need to write down" (GitHub). Decompose specs into the **story → epic → initiative** hierarchy where needed: stories are small sprint-sized items, epics group related stories, initiatives group epics (Atlassian — see Related).

1. **Classify the work.** Decide whether each spec is a single story, or an **epic** to be split into stories. Group large bodies of epics under an **initiative** if the org tracks that level.
2. **Slice vertically.** Each issue should deliver a thin end-to-end piece of user-visible value (or a deployable internal capability), not a horizontal layer ("all the CSS"). Aim for INVEST-style items: independent, negotiable, valuable, estimable, small, testable.
3. **Write a clear title.** Imperative and specific ("Add wishlist save button to product page"), scannable in a list.
4. **Write the body** from a template: **Context/why** (link the story + problem), **Acceptance criteria** (copy the testable criteria from `specs.md`, as a checklist), **Out of scope**, and **Links** (wireflow node, ADR, related issues).
5. **Add a task list** for multi-step issues so progress is trackable; convert items to **sub-issues** when they are independently workable.
6. **Set metadata.** Assign type/labels, a milestone, and project/board placement; declare **dependencies/blocking** relationships between issues.
7. **Use issue templates/forms** so every issue carries the required fields and contributors open meaningful issues.
8. **De-duplicate and link.** Search existing issues; link or close duplicates; reference related/blocking issues so the graph is navigable.
9. **Confirm each issue is estimable and small** enough to fit one increment; if not, split again.

## Output format
- One tracker issue per unit of work, each with: imperative title; body containing context, acceptance-criteria checklist, out-of-scope, and links; labels/type, milestone, project, and dependency links. Epics link to their child stories; initiatives link to their epics.
- A short `issues.md` (in the planning folder) listing the created issue IDs/links and the epic→story map, for traceability back to `specs.md`.

## Quality & validation rules
- Every story in `specs.md` is represented by at least one issue; no acceptance criterion is dropped.
- Each issue is independently understandable (context + criteria + links) without reading external chat, and is small/estimable enough for one increment.
- Slices are vertical (deliver value), not horizontal (layers). Dependencies are explicit, not implicit.
- Titles are imperative and specific; templates/required fields are populated. Done = a team member could pick any issue and know exactly what "done" means.

## Failure handling
- **An issue is too big to estimate:** split it; if it cannot be split without losing value, mark it an epic and decompose.
- **Acceptance criteria missing or untestable:** stop and return to `requirements-to-specs`; do not create an unverifiable issue.
- **Duplicate found:** link/close rather than create; reconcile scope.
- Record the spec→issue mapping in `issues.md` so traceability survives if issues are reorganized.

## Related
- Sources: https://docs.github.com/en/issues/tracking-your-work-with-issues/about-issues ; https://www.atlassian.com/agile/project-management/user-stories ; https://www.atlassian.com/agile/project-management/epics-stories-themes
- Skills: ../requirements-to-specs, ../breaking-work-into-sprints, ../architecture-before-code
