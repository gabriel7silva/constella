---
name: research-decision-room-quality-gate
description: |
  Use this skill when Codex needs procedural guidance derived from research-decision-room/references/checklist.md. Recast from the original research-decision-room/references/checklist.md material as the research-decision-room-quality-gate procedure.
---

# Research Decision Room Quality Gate

## Role

Use this skill when Codex needs procedural guidance derived from research-decision-room/references/checklist.md. Recast from the original research-decision-room/references/checklist.md material as the research-decision-room-quality-gate procedure.

## Source Trace

- Original Markdown: `research-decision-room/references/checklist.md`
- Reformulated skill name: `research-decision-room-quality-gate`

## Operating Guidance

Follow the rewritten material below as the working procedure. Keep code blocks, commands, file paths, URLs, dimensions, and API names exact when applying the skill.

Execute this before emitting `<artifact>`. P0 = needs to pass; P1 = prefer to pass; P2 =
nice to have.

## P0 - needs to pass

- [ ] Decision question is visible in the header.
- [ ] Recommendation is explicitly labelled as recommended, tentative, or needs
  more evidence.
- [ ] Evidence ledger includes source type, segment, signal, quote or metric,
  strength, and limitations.
- [ ] Every theme cites at least two evidence ids, or is labelled as low
  confidence.
- [ ] Direct quotes are used only when supplied by the user.
- [ ] Missing sample sizes, dates, counts, or metrics are labelled `not provided`
  instead of invented.
- [ ] Stakeholder opinions are not counted as user evidence unless clearly
  marked.
- [ ] Opportunity scores show all four dimensions: evidence strength, user pain,
  business leverage, implementation risk.
- [ ] The top recommendation includes "what could be wrong" and "what to measure
  next".
- [ ] Experiment queue includes metric, success threshold, and expected learning.
- [ ] Assumptions and limitations are visible.
- [ ] No lorem ipsum, placeholder marketing copy, fake customer logos, or
  invented participant identities.
- [ ] No default AI-accent indigo or violet accents (`#6366f1`, `#4f46e5`,
  `#4338ca`, `#3730a3`, `#8b5cf6`, `#7c3aed`, `#a855f7`).
- [ ] Mobile layout works without horizontal scroll at 375px width.
- [ ] Interactive controls are keyboard reachable and have visible focus states.

## P1 - prefer to pass

- [ ] Theme names describe behavior, not generic categories.
- [ ] Contradictions or segment differences are surfaced.
- [ ] Matrix scoring is consistent with the evidence ledger.
- [ ] The decision memo can be read in under one minute.
- [ ] Related evidence ids are visually easy to scan.
- [ ] Color is used to encode confidence and risk sparingly, with text labels.

## P2 - nice to have

- [ ] Evidence filters let reviewers review interviews, support, metrics, and
  stakeholder signals separately.
- [ ] The artifact includes a print-friendly layout.
- [ ] At least one experiment is reversible within one sprint.
