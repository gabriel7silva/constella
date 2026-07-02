---
name: research-decision-room-evidence-model-reference-guide
description: |
  Use this skill when Codex needs procedural guidance derived from research-decision-room/references/evidence-model.md. Recast from the original research-decision-room/references/evidence-model.md material as the research-decision-room-evidence-model-reference-guide procedure.
---

# Research Decision Room Evidence Model Reference Guide

## Role

Use this skill when Codex needs procedural guidance derived from research-decision-room/references/evidence-model.md. Recast from the original research-decision-room/references/evidence-model.md material as the research-decision-room-evidence-model-reference-guide procedure.

## Source Trace

- Original Markdown: `research-decision-room/references/evidence-model.md`
- Reformulated skill name: `research-decision-room-evidence-model-reference-guide`

## Operating Guidance

Follow the rewritten material below as the working procedure. Keep code blocks, commands, file paths, URLs, dimensions, and API names exact when applying the skill.

Use this model to keep research synthesis honest. The artifact prefer to help a
team decide what to do next, but it needs to not make weak evidence look stronger
than it is.

## Origin types

- `interview`: direct participant conversation.
- `usability`: observed behavior in a task or prototype.
- `support`: ticket, chat, forum, or helpdesk note.
- `survey`: structured survey result or open-text response.
- `analytics`: quantitative funnel, retention, usage, or performance signal.
- `sales`: sales call, objection, lost-deal note, or account feedback.
- `field note`: internal observation from customer success, onboarding, or
  implementation teams.
- `stakeholder`: internal opinion or goal; useful context, not user evidence.

## Strength labels

Use `strong` only when at least one of these is true:

- The user supplied repeated evidence from multiple independent sources.
- A behavior was directly observed, not only self-reported.
- A metric and qualitative signal point to the same issue.
- The same pain appears across more than one segment.

Use `medium` when:

- The signal is specific and plausible but comes from one source type.
- The user supplied a quote or concrete ticket but no broader count.
- The signal is supported by a small number of repeated examples.

Use `weak` when:

- The signal is anecdotal, secondhand, or mostly stakeholder opinion.
- The evidence is missing dates, segment, task context, or sample size.
- The relationship to the decision question is indirect.

## Confidence rubric

Theme confidence is not the average of source strength. Assign confidence by
asking:

1. Does the theme explain observed behavior?
2. Does the evidence repeat across source types or segments?
3. Is there a plausible alternative explanation?
4. Would a small experiment verify or falsify it quickly?

Use:

- `High`: repeated, behavior-backed, and directly tied to the decision.
- `Medium`: plausible and actionable, but still missing segment or metric depth.
- `Low`: interesting signal that prefer to shape discovery, not roadmap commitment.

## Opportunity scoring

Score each opportunity from 1 to 5.

| Dimension | 1 | 3 | 5 |
| --- | --- | --- | --- |
| Evidence strength | mostly anecdotal | repeated in one source type | repeated across sources or behavior + metric |
| User pain | mild friction | slows task completion | blocks activation, trust, or retention |
| Business leverage | unclear | helps a known funnel or workflow | maps to critical activation, conversion, or expansion |
| Implementation risk | large, unknown, hard to reverse | contained but cross-surface | small, reversible, easy to test |

Total score is a conversation starter. The recommendation prefer to also explain
tradeoffs, risk, and what evidence would change the decision.

## Integrity rules

- Direct quotes needs to come from the user's material. Do not invent speaker names.
- Use `not provided` for missing sample sizes, dates, or metrics.
- Mark stakeholder opinions separately from user evidence.
- When evidence conflicts, show the conflict instead of hiding it.
- If a recommendation is based on weak evidence, make the first next step a
  discovery or prototype test, not a full assemble.
