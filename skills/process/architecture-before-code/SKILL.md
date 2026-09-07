# Skill — architecture-before-code

**Trigger:** A scoped slice/feature is about to be implemented and it introduces new systems, boundaries, data flows, or integrations — before writing the implementation.

Produces a shared, just-enough architecture description (C4-style diagrams + the load-bearing decisions) so engineers agree on boundaries and data flow before code locks them in.

## When to use
- The work adds a new container (service, app, database, queue), a new integration, or a non-trivial data flow across boundaries.
- Decisions about boundaries, data ownership, or technology are hard to reverse later and must be gotten approximately right early.
- More than one engineer/agent will touch the system and needs a shared mental model.

## When NOT to use
- The change fits cleanly inside an existing component with no new boundary or data-flow (just implement, following existing patterns in `.claude/CLAUDE.md`).
- A current, accurate architecture doc already covers this change.
- It is a pure UI flow with no architectural impact — use `mocks-and-screen-flows`.

## Required context & inputs
- The scoped slice (`mvp-slice.md`) and its requirements/specs.
- The org's `.claude/CLAUDE.md` (declared stack, existing services, runtime root and isolation model, sync/watcher architecture).
- The existing system's current architecture (read the code/structure to know what is already there).

## Procedure
Document with the **C4 model**: describe the software at increasing zoom — **System Context → Containers → Components → (optionally) Code** — using the abstractions person, software system, container, and component (see Related). Keep it "just enough": architecture is the shared understanding of the important, hard-to-change stuff (per Fowler), not exhaustive UML.

1. **System Context diagram.** Show the system as one box, the people (actors) who use it, and the external systems it depends on. Establishes scope and who/what it talks to.
2. **Container diagram.** Decompose the system into deployable/runnable units (web app, API, database, worker, agent runtime) with the technology of each and the data that flows between them. This is the primary architecture artifact for most features.
3. **Component diagram (only where it adds value).** Inside the container you are changing, show the major components and responsibilities. Skip for containers you are not touching.
4. **Define boundaries & ownership.** State which container owns which data, the contract (API/event/schema) at each boundary, and the direction of dependencies. Avoid cyclic dependencies between containers.
5. **Trace the data flow.** Walk the slice's main path across the diagram (a dynamic/sequence view) — request in, transformations, persistence, response out — confirming every hop exists and is owned.
6. **Record the decisions.** For each significant, hard-to-reverse choice (boundary placement, datastore, sync strategy, build vs. integrate), write a short decision: context, options considered, choice, consequences. Prefer one ADR per decision.
7. **Check internal quality.** Confirm the design favors high internal quality (clear seams, low coupling) — this speeds future delivery, not slows it (per Fowler). Reject designs that bypass existing isolation/sync boundaries the org depends on.
8. **Review with the team** before coding; the diagrams are the alignment instrument.

## Output format
- An `architecture.md` (in the work item's planning folder) containing the C4 Context and Container diagrams (and Component where useful), the boundary/ownership/contract notes, and the traced data flow.
- One ADR per significant decision (context · options · decision · consequences), linked from `architecture.md`.

## Quality & validation rules
- Every container has a named responsibility, technology, and the data it owns; every boundary names its contract.
- The slice's main path traces end-to-end across the diagram with no missing or unowned hop.
- Each hard-to-reverse decision has a recorded rationale and considered alternatives (an ADR), so future readers know *why*, not just *what*.
- The design respects the org's existing architectural invariants (e.g. Constella's runtime root, FS isolation/jail, sync-engine/watcher boundaries). Done = a reviewer agrees boundaries and data flow before any implementation begins.

## Failure handling
- **Two valid boundary options and no clear winner:** record both in the ADR with trade-offs and escalate the decision rather than picking silently.
- **Design violates an existing invariant:** stop; either redesign within the invariant or raise an explicit, justified ADR to change it.
- **Architecture grows beyond the slice:** scope the diagram to this slice and note future containers as out-of-scope rather than designing the whole platform.
- Keep `architecture.md` and ADRs updated if implementation forces a change, so the doc stays the source of truth.

## Related
- Sources: https://c4model.com/ ; https://martinfowler.com/architecture/ ; ADRs — https://adr.github.io/
- Skills: ../mocks-and-screen-flows, ../requirements-to-specs, ../specs-to-issues
