# Skill — product-discovery

**Trigger:** A new product, feature, or initiative is proposed and the problem space, the users, or "is this worth building" is still uncertain — i.e. before any spec or mock exists.

Produces an evidence-backed problem statement plus the user-needs and constraints that justify (or kill) the work, so the team commits to building the right thing.

## When to use
- New work was just born (DM @ada / `/planner New Work`) and the requestor described a *desired outcome*, not a validated problem.
- There are many unknowns, stakeholders are not aligned on the goal, a new market/regulation/strategy shift triggered the request, or a chronic problem keeps recurring.
- You are tempted to jump straight to a mock or schema but cannot yet name *who* hurts, *what* they are trying to accomplish, and *what evidence* says so.

## When NOT to use
- The problem is already validated and documented (a discovery artifact or prior spec already states the user, the job, and the evidence) — go to `idea-to-product` or `requirements-to-specs`.
- The change is a bug fix, a small refactor, or a 1:1 reproduction of an approved mock (Constella parity work) where the "right thing" is already fixed.
- The work is purely internal/technical with no end-user-facing behavior to validate.

## Required context & inputs
- The raw request and who asked for it (the requestor / stakeholder).
- The org's `.claude/CLAUDE.md` (declared product, stack, existing personas/journeys).
- Any existing research, analytics, support tickets, or prior solutions attempted for this problem.
- Access to (or a documented stand-in for) the target users.

## Procedure
Discovery is the **Discover → Define** half of the Double Diamond: diverge to explore the problem space, then converge on one evidenced problem statement (see Related). Run it as a bounded phase, not open-ended research.

1. **Frame the inquiry.** Write the open questions discovery must answer ("Who experiences this? What are they trying to get done? How often / how costly? What have they tried?"). Timebox the phase explicitly.
2. **Interview stakeholders.** Capture the business objective, constraints, success metric, and every solution already attempted (so you do not re-propose a known failure).
3. **Run exploratory user research.** Use interviews, field/diary studies, or a short survey to learn the problem space firsthand. Talk to real users (or the closest available proxy); record verbatim pains, not feature requests.
4. **Synthesize (converge).** Affinity-map the findings. Cluster pains into a small set of user-needs statements. Separate *observed evidence* from *assumption* — flag every assumption as a risk to validate.
5. **Write the problem statement.** One paragraph: the user, the job/outcome they cannot achieve today, the evidence, and the cost of leaving it unsolved. It must be falsifiable.
6. **Test the three lenses.** Confirm a solution would be **desirable** (users want it), **viable** (the org can sustain it), and **feasible** (buildable on the current stack). If any lens fails, say so.
7. **Produce light artifacts only as needed:** persona(s), a journey map or service blueprint of the current painful experience, and a high-level concept — *not* a finished design.
8. **Recommend go / pivot / no-go** with the evidence that drives the recommendation.

## Output format
- A `discovery.md` (in the work item's planning folder) containing: open questions, stakeholder notes, research method + participants, synthesized user-needs, the **problem statement**, assumptions-as-risks, the desirability/viability/feasibility verdict, and a go/pivot/no-go recommendation.
- Optional supporting artifacts (persona, current-state journey map) linked from `discovery.md`.

## Quality & validation rules
- The problem statement names a real user and a real job, and is backed by at least one piece of gathered evidence (interview quote, datum, ticket) — never by assumption alone.
- Every assumption is listed as a risk with how it would be validated. Done = no un-flagged assumptions masquerading as fact.
- Discovery answered its open questions or explicitly states which remain open and why. The phase has a recorded end; it is not still "in progress" when a recommendation is made.
- No solution detail (screens, schemas, endpoints) leaked into discovery output.

## Failure handling
- **Cannot reach users / no evidence available:** do not fabricate findings. Record the gap, mark the related needs as unvalidated assumptions, and lower the recommendation confidence.
- **Findings contradict the original request:** reframe the problem (hand off to `problem-framing`) and report the conflict to the requestor rather than forcing the original solution.
- **Discovery keeps expanding:** stop at the timebox, ship the strongest evidenced problem statement you have, and list remaining unknowns as follow-up.
- Record blockers and the decision trail in `discovery.md` so the next phase inherits the reasoning.

## Related
- Sources: https://www.nngroup.com/articles/discovery-phase/ ; Double Diamond — https://www.designcouncil.org.uk/our-resources/the-double-diamond/
- Skills: ../problem-framing, ../idea-to-product, ../mocks-and-screen-flows
