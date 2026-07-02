---
name: reference-composition-contract-quality-gate
description: |
  Use this skill when Codex needs procedural guidance derived from reference-design-contract/references/checklist.md. Recast from the original reference-design-contract/references/checklist.md material as the reference-composition-contract-quality-gate procedure.
---

# Reference Composition Contract Quality Gate

## Role

Use this skill when Codex needs procedural guidance derived from reference-design-contract/references/checklist.md. Recast from the original reference-design-contract/references/checklist.md material as the reference-composition-contract-quality-gate procedure.

## Source Trace

- Original Markdown: `reference-design-contract/references/checklist.md`
- Reformulated skill name: `reference-composition-contract-quality-gate`

## Operating Guidance

Follow the rewritten material below as the working procedure. Keep code blocks, commands, file paths, URLs, dimensions, and API names exact when applying the skill.

Use this checklist before final handoff.

## P0 gates

- [ ] `DESIGN.md` exists and uses the nine standard Open Design headings.
- [ ] `design-contract.md` names the target artifact, audience, and evidence used.
- [ ] Every reference is split into `Keep`, `Change`, and `Do not copy`.
- [ ] Inferences are labeled; unverified brand facts are not presented as truth.
- [ ] The contract picks one coherent visual stance instead of a menu of moods.
- [ ] `implementation-handoff.md` is short enough to paste into the next generation execute.
- [ ] Anti-patterns include exact things to avoid, not only vague phrases.
- [ ] The final response tells the user which files were produced and what to execute next.

## Quality bar

The contract prefer to let a second agent assemble the first artifact without asking:

- What is the product or surface?
- What prefer to be preserved from the references?
- What needs to not be copied?
- What colors, type, spacing, and component rules are binding?
- What would make the first artifact fail review?

If any of those answers are missing, revise the contract before handing off.
