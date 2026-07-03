# Skill — problem-framing

**Trigger:** A problem statement or request exists but it may be the *wrong* or too-narrow framing — before committing scope, specs, or architecture to it.

Produces a reframed, validated problem statement (often with the underlying job-to-be-done) so the team solves the highest-value version of the problem, not the first one stated.

## When to use
- Discovery surfaced a problem, or a stakeholder handed you one, and you suspect it is stated as a pre-baked solution ("we need a button that…") rather than a need.
- The team is jumping straight to solution mode without checking it understands the problem (the most common and most costly failure — most organizations are weak at diagnosis, not solving).
- Multiple stakeholders describe "the problem" differently.

## When NOT to use
- The problem is already crisply framed, agreed, and evidenced (proceed to `requirements-to-specs` or `architecture-before-code`).
- Reframing would be procrastination: the problem is small, well-understood, and the cost of solving the "wrong" version is trivial.

## Required context & inputs
- The current problem statement and who authored it.
- `discovery.md` / research evidence if it exists (from `product-discovery`).
- Access to at least one outsider (someone not embedded in the problem) and the original stakeholders.

## Procedure
Use Wedell-Wedellsborg's reframing method (HBR, see Related). The goal is **not** to find the "real" problem but to see whether there is a *better* problem to solve. Run a short, repeatable reframing loop.

1. **Establish legitimacy.** Get explicit buy-in that questioning the framing is welcome, so people engage instead of defending the original ask.
2. **Bring in outsiders.** Include at least one person without stake in the current framing; they spot blind spots insiders cannot.
3. **Get definitions in writing.** Have each stakeholder write down, in one or two sentences, what they think the problem is. Compare — divergence reveals the real disagreement.
4. **Ask what's missing.** What does every written definition leave out? Add the missing factors.
5. **Consider multiple categories.** Is this a process problem? An incentive problem? An expectation problem? Re-categorize deliberately.
6. **Analyze positive exceptions.** Where does this problem *not* occur (a person, team, or context that already succeeds)? Study why — the reframe often hides there.
7. **Question the objective.** Ask what goal the stated problem actually serves; a higher goal may have a cheaper or entirely different solution.
8. **Restate as a job-to-be-done.** Express the chosen frame as the outcome the user is trying to achieve ("When [situation], I want to [motivation], so I can [expected outcome]"), independent of any solution.
9. **Pick the better problem** and record why it beats the original framing.

## Output format
- A `problem-framing.md` (in the work item's planning folder) with: the original statement, each stakeholder's written definition, what was missing, alternative categorizations considered, positive exceptions found, the questioned objective, and the **chosen reframed problem statement** expressed as a job-to-be-done, plus a one-line rationale for choosing it.

## Quality & validation rules
- The final problem statement is solution-free: it names a situation, a motivation, and a desired outcome — no UI, schema, or technology.
- At least three of the seven reframing practices were actually applied and their output recorded (not just listed).
- An outsider's input is captured. Done = the reframe is traceable to evidence/perspectives, not to one author's preference.
- The original framing is preserved alongside the new one so the decision is auditable.

## Failure handling
- **Reframing produces no better problem:** keep the original framing and record that it was deliberately validated (this is a success, not a waste).
- **Stakeholders cannot agree on the frame:** escalate the disagreement with the written definitions attached; do not silently pick one.
- **Reframe invalidates prior discovery:** loop back to `product-discovery` to re-validate the new frame before building on it.
- Log the chosen frame and rejected alternatives so later phases do not relitigate them.

## Related
- Sources: https://hbr.org/2017/01/are-you-solving-the-right-problems (Thomas Wedell-Wedellsborg — the seven reframing practices)
- Skills: ../product-discovery, ../idea-to-product, ../requirements-to-specs
