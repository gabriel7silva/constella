# Skill — app-planning

**Trigger:** A new app, service, or major feature area is being started and needs an end-to-end plan — scope, architecture, and milestones — *before* code is written.

Produces a planning document that defines what is being built (scope), how it is structured (C4 architecture views), and how it will be delivered (agile backlog and milestones).

## When to use
- Kicking off a greenfield app or a substantial new module.
- The work is large enough to span multiple sprints and needs a shared mental model across the team/agents.
- Stakeholders need to agree on scope and sequence before implementation starts.

## When NOT to use
- A bounded change to existing code with an obvious shape (just implement it).
- The plan exists and only one technical decision is open — use `process/adr-technical-decisions`.
- You only need a priority order for an existing backlog — use `process/prioritization-moscow-rice`.

## When NOT to use (continued)
- UX/IA validation of an existing flow — use `process/validating-ux-navigation`.

## Required context & inputs
- The product goal and target users (who, and what outcome).
- The org's declared stack, runtime layout, and constraints (from `.claude/CLAUDE.md`).
- Known external systems the app must integrate with (auth, payment, data sources).
- Any non-functional requirements: scale, latency, compliance, offline support.

## Procedure
1. **State scope as outcomes.** Write the problem statement and 3-7 concrete user outcomes. Explicitly list what is *out* of scope for v1 to prevent creep (mirror the MoSCoW "Won't have this time" bucket).
2. **Identify users and external systems.** Enumerate the people/roles (actors) and the external software systems the app talks to. This is the raw material for the C4 System Context view.
3. **Draw the C4 System Context view (Level 1).** One diagram: your software system in the middle, the people and external systems around it, and the relationships between them. This is the "big picture" — keep it free of technology detail.
4. **Draw the C4 Container view (Level 2).** Decompose your system into containers — separately runnable/deployable units (web app, API, database, worker, SPA, mobile app). Show the technology choice per container and how containers communicate. This is where the stack is committed.
5. **Draw the C4 Component view (Level 3) for the risky containers only.** For each container with non-trivial internal structure, show its major components and responsibilities. Skip containers that are simple CRUD. (Level 4 / Code is generated from the IDE — do not hand-draw it.)
6. **Define the agile work hierarchy.** Translate scope into the Atlassian hierarchy: group outcomes into **epics** (large bodies of work toward one goal), break each epic into **user stories** sized to fit in a single sprint. Stories that would take weeks become their own epic. The set of epics/stories is the product backlog.
7. **Prioritize the backlog.** Apply `process/prioritization-moscow-rice` to order stories and define the v1 cut line.
8. **Sequence into milestones.** Group stories into milestones/iterations along a roadmap, each milestone delivering a coherent, demonstrable increment. Sequence by dependency and priority, front-loading the riskiest architectural assumptions to validate them early.
9. **Plan the cross-cutting work up front.** Before milestone 1, ensure the plan includes: a threat model entry point (`process/security-by-design`), a test strategy (`process/testing-before-done`), and ADRs for the load-bearing stack/architecture choices made in steps 4-5.

## Output format
- A `PLAN.md` (or equivalent planning doc) in the workspace containing:
  - Scope: problem statement, in-scope outcomes, explicit out-of-scope list.
  - Architecture: C4 Context and Container views (as diagrams or structured text), plus Component views for complex containers.
  - Stack: the technology committed per container, each with a link to its ADR.
  - Delivery: epics → stories backlog, prioritized, grouped into milestones on a roadmap.
- Diagrams may live in `examples/` or be embedded; reference them from `PLAN.md`.

## Quality & validation rules
- Every in-scope outcome maps to at least one epic; every epic to at least one story; no orphan stories.
- The C4 views are consistent: every container in Level 2 traces to a system in Level 1; every component in Level 3 lives inside a Level 2 container.
- Each container's technology choice is named (no "TBD" on load-bearing choices) and the choice with trade-offs is backed by an ADR.
- Every user story is small enough to fit one sprint; anything larger is promoted to an epic.
- Milestone 1 exercises the highest-risk architectural assumption, not just the easiest work.
- Out-of-scope list is non-empty (a plan with nothing excluded is under-scoped).

## Failure handling
- **Scope keeps growing** → freeze v1 scope, move new asks to "Won't have this time," and revisit after the first milestone.
- **A container's tech choice is contested** → spike it or open an ADR; do not let the diagram hide an unresolved decision.
- **Stories won't fit a sprint** → split them; if a story can't be split, it's an epic — re-decompose.
- **No external systems identified** → re-check; almost every app has auth/data/observability dependencies. An empty Context view usually means the analysis is incomplete.

## Related
- Sources:
  - C4 model — https://c4model.com/
  - Agile (epics/stories/backlog) — https://www.atlassian.com/agile/project-management/epics-stories-themes
- Skills: `process/prioritization-moscow-rice`, `process/adr-technical-decisions`, `process/security-by-design`, `process/testing-before-done`
