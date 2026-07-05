# Skill — validating-ux-navigation

**Trigger:** A new app, feature area, or redesign needs its information architecture (IA), navigation, and user flows validated *before* the UI is finalized in code.

Produces a validated IA + navigation design backed by evidence from a structured usability test, with a prioritized list of problems found.

## When to use
- Designing or restructuring how content/features are organized and how users move between them.
- A flow exists but users get lost, can't find features, or abandon a task.
- Before committing navigation markup, to avoid costly structural rework later.

## When NOT to use
- Pure visual styling with no structural/flow change (use design/component skills instead).
- The information architecture is already validated and only copy is changing.
- You cannot recruit even a handful of representative users and the change is low-risk — at minimum do an expert heuristic review instead, and say so.

## Required context & inputs
- The content inventory: every page/screen/feature the product offers.
- The primary user roles and their top tasks (what they come to accomplish).
- The current or proposed navigation components (global nav, breadcrumbs, filters, footer).
- Access to 5+ representative users per distinct user group for testing.

## Procedure
1. **Separate IA from navigation (NN/g distinction).** Treat them as two layers: **IA** is the underlying organization, structure, and naming of content (lives in spreadsheets/diagrams, invisible to users); **navigation** is the visible UI (global nav, breadcrumbs, filters, footers) — "the tip of the iceberg" sitting on top of the IA. Validate the IA *first*; navigation design follows from it.
2. **Build the IA.** Run the four NN/g IA activities:
   - **Content inventory** — locate and list all existing content/features.
   - **Content audit** — judge each item's usefulness, accuracy, and effectiveness; drop dead weight.
   - **Information grouping** — group content by user-centered relationships (how users think, not the org chart).
   - **Taxonomy development** — define standardized, user-tested labels and naming.
3. **Map the user flows.** For each top task, lay out the step-by-step path through the IA the user must take. Flag steps with ambiguous labels, dead ends, or excessive depth.
4. **Design navigation from the IA.** Choose navigation components that expose the grouping from step 2. Navigation must reflect the IA, not fight it.
5. **Plan the usability test (Day 1).** Pick 3-5 representative tasks phrased as goals ("find and X"), not instructions. Recruit ~5 participants per user group — five participants uncover the majority of the most common problems. Decide qualitative (discover problems) vs. quantitative (benchmark success rate / time-on-task); for pre-launch validation, run qualitative.
6. **Conduct the test (Day 2).** A facilitator gives one task at a time and observes behavior and listens for feedback. The facilitator must **not** lead, hint, or rescue the participant — stay neutral so the data stays valid; ask follow-up questions only to clarify, after the attempt.
7. **Analyze and recommend (Day 3).** Cluster observed problems by where they occur in the IA/flow, rank by severity (how many users hit it × how badly it blocks the task), and propose specific IA/navigation/label fixes.
8. **Iterate.** Revise the IA or navigation for high-severity issues and, for risky changes, re-test with a fresh set of ~5 users.

## Output format
- A `ux-validation.md` in the workspace containing:
  - The IA artifact: content inventory + the grouped taxonomy (sitemap/tree).
  - Flow diagrams for the top tasks.
  - The test plan: tasks, participant profile and count, qual/quant choice.
  - Findings table: `Problem | Location in IA/flow | Users affected | Severity | Recommended fix`.
- Navigation spec derived from the validated IA (component list + labels).

## Quality & validation rules
- IA is defined and audited *before* navigation is finalized (step 1 ordering is mandatory).
- Every navigation label traces to a taxonomy term from the IA — no orphan labels.
- The test used ≥5 participants per user group and tasks phrased as goals, not click-by-click instructions.
- The facilitator did not lead participants; findings reflect observed behavior, not the team's opinions.
- Every reported problem has a severity and a concrete fix; "users were confused" with no location/fix is not a finding.
- High-severity fixes are re-tested before being declared resolved.

## Failure handling
- **Can't recruit 5 users** → run with the most you can get plus an expert heuristic review, and label confidence as reduced; do not present thin results as definitive.
- **Test reveals the IA grouping is wrong** → return to step 2 (regroup), do not patch with navigation tweaks over a broken structure.
- **Facilitator bias suspected** → discard tainted sessions and re-run with neutral facilitation rather than reporting compromised data.
- **No clear top tasks** → stop and define them with stakeholders; you cannot validate flows for undefined goals.

## Related
- Sources:
  - IA vs. navigation — https://www.nngroup.com/articles/ia-vs-navigation/
  - Usability testing 101 — https://www.nngroup.com/articles/usability-testing-101/
- Skills: `process/app-planning`
