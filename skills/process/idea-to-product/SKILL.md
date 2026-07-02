# Skill — idea-to-product

**Trigger:** A validated problem (or a strong raw idea) exists and must become a small, buildable, testable slice — before writing specs or code for the whole thing.

Produces a scoped MVP slice with its riskiest assumption, the experiment that tests it, and the success metric — so the team ships the smallest thing that produces validated learning.

## When to use
- Discovery/framing produced a problem worth solving and you must decide *what to build first*.
- The idea is large and you need to carve a thin end-to-end slice rather than build everything at once.
- You want evidence the solution works before investing in the full feature.

## When NOT to use
- The problem itself is not yet validated — go to `product-discovery` / `problem-framing` first.
- The slice is already chosen and specced — go to `requirements-to-specs`.
- Scope is being cut into delivery increments for an *already-committed* feature — that is sprint slicing (`breaking-work-into-sprints`), not idea-to-MVP.

## Required context & inputs
- The validated problem statement / job-to-be-done (`discovery.md`, `problem-framing.md`).
- The success metric the business cares about.
- The org's `.claude/CLAUDE.md` stack and constraints (what is cheap vs expensive to build).

## Procedure
Apply the Lean Startup **Build–Measure–Learn** loop with a Minimum Viable Product: the smallest thing that lets you start the learning loop and gather **validated learning** (see Related). Optimize for fastest learning, not most features.

1. **State the value & growth hypotheses.** Write the leap-of-faith assumptions the idea depends on (does the user want this? will it produce the intended outcome?). These are the things that, if false, kill the product.
2. **Rank by risk.** Identify the single riskiest assumption — the one whose failure is most likely and most damaging. The MVP exists to test *that*.
3. **Design the MVP slice.** Define the thinnest end-to-end path through the product that exercises the riskiest assumption and delivers real value to one user for one job. Cut everything not required to learn. (A concierge, mock, or single-flow build often suffices.)
4. **Define Measure.** Pick a clear, actionable success metric and the threshold that counts as validation vs. invalidation *before* building. Avoid vanity metrics.
5. **Specify Learn.** State, in advance, what result will make you persevere, pivot, or stop.
6. **Scope the build.** List what is in the slice and explicitly what is deferred. Keep the slice releasable and observable.
7. **Hand the slice off** to `requirements-to-specs` (to make it testable) and `specs-to-issues` (to make it trackable).

## Output format
- An `mvp-slice.md` (in the work item's planning folder) with: value & growth hypotheses, the ranked riskiest assumption, the MVP slice definition (in-scope path + explicit out-of-scope list), the success metric + validation threshold, and the persevere/pivot/stop criteria.

## Quality & validation rules
- The slice is end-to-end (a user can complete one real job), releasable, and instrumented to produce the chosen metric.
- The riskiest assumption is named and the slice demonstrably tests it. Done = building this slice will produce validated learning, not just output.
- The success threshold and pivot/persevere criteria were written *before* building, so the result cannot be rationalized after the fact.
- Out-of-scope items are explicit, preventing scope creep.

## Failure handling
- **Slice still too big to ship fast:** cut to a single flow or a non-code experiment (concierge/Wizard-of-Oz) that still tests the riskiest assumption.
- **No measurable success metric available:** treat that as the first risk to resolve — define how learning will be observed before building anything.
- **MVP invalidates the assumption:** that is a successful experiment; record the learning and route back to `problem-framing` to pivot rather than forcing the build.
- Log hypotheses, metric, and outcome so the next loop iteration builds on real evidence.

## Related
- Sources: https://leanstartup.co/ ; https://www.nngroup.com/articles/minimum-viable-product/
- Skills: ../product-discovery, ../problem-framing, ../requirements-to-specs, ../breaking-work-into-sprints
