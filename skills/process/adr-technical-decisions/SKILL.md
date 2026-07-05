# Skill — adr-technical-decisions

**Trigger:** An architecturally significant technical decision is being made (stack choice, data model, integration approach, cross-cutting pattern) and must be recorded as an Architecture Decision Record before or as it is committed.

Produces a single immutable ADR file capturing the decision, its context, and its consequences, added to the project's decision log.

## When to use
- Choosing a load-bearing technology, library, protocol, or pattern.
- Making a trade-off whose rationale future maintainers will need (and would otherwise guess at).
- Reversing or superseding an earlier architectural decision.

## When NOT to use
- A reversible, low-impact implementation detail with no real trade-off (just do it; a comment suffices).
- The decision isn't made yet and you're still prioritizing options — use `process/prioritization-moscow-rice` first, then record the outcome here.
- General planning (use `process/app-planning`); an ADR records *one* decision, not a whole plan.

## Required context & inputs
- The decision being made and the forces/constraints driving it.
- The alternatives considered and why they were or weren't chosen.
- The existing ADR directory and the next sequence number (check `docs/adr/` or the org's convention).
- The org's stack and constraints (from `.claude/CLAUDE.md`).

## Procedure
1. **Confirm it's architecturally significant.** An ADR documents "a justified design choice that addresses a functional or non-functional requirement that is architecturally significant." If the choice is trivial or easily reversed, don't spend an ADR on it.
2. **Locate the decision log.** Find the ADR directory (commonly `docs/adr/` or `doc/architecture/decisions/`). All ADRs together form the project's **decision log** — the chronological record of architectural choices. If none exists, create the directory and start the sequence at `0001`.
3. **Assign a sequential number and title.** Number ADRs monotonically (`0001`, `0002`, …) so order is preserved. Title it as a short noun phrase naming the decision (e.g. "0007 — Use Drizzle for the ORM").
4. **Write the ADR using the standard sections** (Nygard format):
   - **Title** — the numbered short phrase.
   - **Status** — one of: proposed, accepted, deprecated, or superseded by ADR-NNNN.
   - **Context** — the forces at play: the problem, constraints, and assumptions that make this decision necessary. State alternatives considered.
   - **Decision** — the choice made, stated in active voice ("We will …").
   - **Consequences** — what becomes easier *and* harder as a result; the trade-offs accepted, including downsides.
5. **Keep ADRs immutable.** Once accepted, do not edit the substance of an ADR. If the decision changes, write a **new** ADR and mark the old one `superseded by ADR-NNNN`; mark the new one `supersedes ADR-MMMM`. The log preserves history — never rewrite it.
6. **Set the status correctly.** Use `proposed` while under discussion, flip to `accepted` when committed. Reflect lifecycle changes via new ADRs, not edits.
7. **Link from the work.** Reference the ADR from the plan, the relevant C4 view, and ideally the code/PR that implements it, so the rationale is discoverable from the artifact.

## Output format
- A markdown file `docs/adr/NNNN-<slug>.md` (4-digit number) in the project, containing exactly the sections: Title, Status, Context, Decision, Consequences.
- The decision log is the ordered set of these files; optionally an index/README listing them with status.

## Quality & validation rules
- The file has all five sections; an ADR missing Context or Consequences is incomplete.
- Status is one of the valid lifecycle values and accurate.
- Context names the alternatives considered and the constraints — not just the winner.
- Consequences honestly state the downsides/trade-offs, not only benefits.
- The number is unique and sequential; no gaps reused, no duplicates.
- Superseded decisions are linked in both directions (old ↔ new); accepted ADRs are never edited in substance.

## Failure handling
- **Decision later proves wrong** → write a new ADR that supersedes it; never delete or silently edit the original — the wrong turn is part of the record.
- **Can't articulate consequences** → the decision may be premature; gather more context or spike before recording it as accepted.
- **No ADR directory or convention** → create `docs/adr/` and seed it with `0001` (e.g. "Record architecture decisions in ADRs") to establish the practice.
- **Two ADRs grabbed the same number** → renumber the later one and update any links; numbers must stay unique.

## Related
- Sources:
  - ADR home / definition — https://adr.github.io/
  - ADR templates & examples — https://github.com/joelparkerhenderson/architecture-decision-record
- Skills: `process/app-planning`, `process/prioritization-moscow-rice`
