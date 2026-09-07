# Skill — prioritization-moscow-rice

**Trigger:** A backlog, feature list, or set of competing initiatives needs an explicit, defensible priority order before committing engineering capacity.

Produces a prioritized work list: a MoSCoW categorization for release-scoping plus a RICE-scored ranking for the contested items, with the reasoning recorded.

## When to use
- You have more candidate work than capacity for the next release/sprint and must decide what is in, what waits, and what is cut.
- Stakeholders disagree on order and you need an objective, repeatable tiebreaker.
- Planning a milestone where the "must-have" set defines whether the release ships at all.

## When NOT to use
- A single obvious item with no contention (just do it).
- The decision is architectural rather than about *what* to build — use `process/adr-technical-decisions` and `process/app-planning`.
- You lack any data or even rough estimates for Reach/Impact/Effort and cannot get them — fix that first; do not fabricate scores.

## Required context & inputs
- The candidate list of features/initiatives, each stated as an outcome (not a solution).
- The release goal or business objective they serve.
- Rough estimates per item: how many users it reaches in a fixed time window, expected per-user impact, your confidence, and effort in person-months.
- The org's declared stack and team size (from `.claude/CLAUDE.md`) to calibrate effort.

## Procedure
1. **Frame the timebox.** Fix the period RICE Reach is measured over (e.g. "per quarter") and the capacity available (person-months). Every item is scored against the same window — never mix windows.
2. **First pass — MoSCoW categorize.** Sort every item into exactly one bucket (Dai Clegg's method):
   - **Must have** — release is useless or broken without it. Non-negotiable for *this* timebox.
   - **Should have** — important and high-value, but the release still works if it slips to a future release.
   - **Could have** — nice-to-have, small impact if dropped; the first to be cut if Must/Should overrun.
   - **Won't have (this time)** — explicitly out of scope for this timebox; record it to prevent scope creep and reset stakeholder expectations.
3. **Budget the Musts.** If "Must have" exceeds the capacity from step 1, the release is over-scoped — renegotiate scope or timeline now, before scoring further. Musts must fit.
4. **Second pass — RICE-score the contested tier.** For the Should/Could items competing for the remaining capacity, score each factor:
   - **Reach** — number of people or events affected in the fixed time window (e.g. 1,200 customers/quarter).
   - **Impact** — per-person magnitude on the multiple-choice scale: 3 = massive, 2 = high, 1 = medium, 0.5 = low, 0.25 = minimal.
   - **Confidence** — percentage on the scale: 100% = high, 80% = medium, 50% = low; below that is a moonshot — flag it, don't score it.
   - **Effort** — total person-months across all functions; use whole numbers, or 0.5 for sub-month work. Higher effort lowers the score.
5. **Compute the score** for each item: `RICE = (Reach × Impact × Confidence) ÷ Effort`. This yields impact-per-time-worked.
6. **Rank and slot.** Order the contested items by descending RICE score and fill the remaining capacity top-down. Items that don't fit fall to the next release (re-label them Should/Won't-have-this-time).
7. **Record the decision.** Capture the bucket, the four raw RICE inputs, and the final score per item so the priority is auditable and re-runnable when estimates change.

## Output format
- A `prioritization.md` (or the planning doc's priority section) in the workspace containing:
  - A MoSCoW table: `Item | Bucket | Rationale`.
  - A RICE table for contested items: `Item | Reach | Impact | Confidence | Effort | RICE score`, sorted descending.
  - The fixed time window, the capacity budget, and the cut line (what's in vs. deferred).

## Quality & validation rules
- Every item lands in exactly one MoSCoW bucket; no item is uncategorized.
- The "Must have" set fits within stated capacity (step 3) — if not, the plan is not done.
- RICE uses the canonical scales (Impact 3/2/1/0.5/0.25; Confidence 100/80/50%); no invented values.
- All RICE items share one Reach time window.
- Each score traces to its four raw inputs — a bare number with no inputs is invalid.
- MoSCoW is the scoping lens, RICE is the objective tiebreaker; do not rely on MoSCoW alone for the contested tier.

## Failure handling
- **No reliable estimates** → score Confidence honestly (low/moonshot), mark the item "needs discovery," and exclude it from the committed set rather than guessing high.
- **Must-haves overflow capacity** → stop and renegotiate scope/timeline with stakeholders; do not silently demote a true Must.
- **Stakeholder dispute on a bucket** → resolve by RICE-scoring the disputed item; the higher impact-per-effort wins. Record the disagreement and resolution.
- **Score ties** → break ties by lower Effort (cheaper first) or higher Confidence; note the tiebreak used.

## Related
- Sources:
  - MoSCoW — https://www.productplan.com/glossary/moscow-prioritization/
  - RICE — https://www.intercom.com/blog/rice-simple-prioritization-for-product-managers/
- Skills: `process/app-planning`, `process/adr-technical-decisions`
