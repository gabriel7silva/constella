---
name: ui-ux-principles
description: Usability heuristics, affordances, and laws of UX to evaluate and design interfaces; consult when reviewing or building user-facing flows.
domain: design
category: design
tags: [usability, heuristics, ux, laws-of-ux, interaction-design]
official_sources:
  - https://www.nngroup.com/articles/ten-usability-heuristics/
  - https://lawsofux.com/
verified: 2026-06-16
---

# UI/UX Principles

## Overview
UI/UX principles are evaluative lenses for making interfaces understandable, efficient, and forgiving. The two most-cited canons are Nielsen's 10 usability heuristics (broad rules of thumb for evaluating interaction design) and the Laws of UX (psychology and cognitive-science principles applied to design). Read this when designing a new flow, doing a heuristic review, or justifying a design decision.

## Official sources
- Nielsen Norman Group — 10 Usability Heuristics: https://www.nngroup.com/articles/ten-usability-heuristics/
- Laws of UX: https://lawsofux.com/

## Core concepts
- **Visibility of system status** — the design keeps users informed about what is happening through timely, appropriate feedback (NN/g heuristic #1).
- **Match between system and the real world** — speak the users' language with familiar words and concepts rather than internal jargon (NN/g #2).
- **User control and freedom** — provide clear "emergency exits" (undo/cancel) so users can leave unwanted states (NN/g #3).
- **Consistency and standards** — users should not have to wonder whether different words or actions mean the same thing; follow platform conventions (NN/g #4).
- **Recognition rather than recall** — minimize memory load by making elements, actions, and options visible (NN/g #6).
- **Aesthetic and minimalist design** — keep only relevant content so it does not compete with the essential (NN/g #8).
- **Laws of UX** — psychology-based principles such as Jakob's Law (users prefer familiar patterns), Hick's Law (more choices increase decision time), Fitts's Law (target acquisition depends on size and distance), and the Aesthetic-Usability Effect (per lawsofux.com).

## Best practices
- Run a heuristic evaluation against NN/g's 10 heuristics before usability testing; they catch a large share of problems cheaply (NN/g).
- Prevent errors rather than only reporting them — the best designs stop problems before they occur (NN/g heuristic #5).
- Apply Hick's Law: reduce or group choices to speed decisions, and stage complex tasks progressively (lawsofux.com).
- Lean on Jakob's Law: reuse established conventions so users transfer existing mental models instead of learning yours (lawsofux.com).

## Common pitfalls
- Treating heuristics as rigid pass/fail checks → use them as discussion prompts to surface issues, weighting severity by frequency and impact (NN/g).
- Hiding system state (no loading or success feedback) → always signal status within a reasonable time (NN/g heuristic #1).
- Overloading a screen to look "complete" → remove non-essential content; clutter reduces relative visibility of what matters (NN/g heuristic #8).
- Inventing novel interaction patterns for common tasks → favor familiar conventions (Jakob's Law) unless a measured benefit justifies the learning cost.

## Examples
```text
Heuristic review checklist (excerpt):
[ ] #1 Status: is progress/loading/success visibly communicated?
[ ] #3 Control: can the user undo or cancel every destructive action?
[ ] #5 Prevention: are invalid inputs blocked before submission?
[ ] #6 Recognition: are key options visible rather than memorized?
```

## Further reading
- NN/g full heuristic articles (one deep-dive per heuristic): https://www.nngroup.com/articles/ten-usability-heuristics/
- Laws of UX individual law pages: https://lawsofux.com/

## Related skills
- ../microinteractions — feedback and state cues that realize "visibility of system status"
- ../design-systems — encoding consistency and standards as reusable components
