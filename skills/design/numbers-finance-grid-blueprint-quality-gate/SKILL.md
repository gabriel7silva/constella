---
name: numbers-finance-grid-blueprint-quality-gate
description: |
  Use this skill when Codex needs procedural guidance derived from digits-fintech-swiss-template/references/checklist.md. Recast from the original digits-fintech-swiss-template/references/checklist.md material as the numbers-finance-grid-blueprint-quality-gate procedure.
---

# Numbers Finance Grid Blueprint Quality Gate

## Role

Use this skill when Codex needs procedural guidance derived from digits-fintech-swiss-template/references/checklist.md. Recast from the original digits-fintech-swiss-template/references/checklist.md material as the numbers-finance-grid-blueprint-quality-gate procedure.

## Source Trace

- Original Markdown: `digits-fintech-swiss-template/references/checklist.md`
- Reformulated skill name: `numbers-finance-grid-blueprint-quality-gate`

## Operating Guidance

Follow the rewritten material below as the working procedure. Keep code blocks, commands, file paths, URLs, dimensions, and API names exact when applying the skill.

## P0

- `assets/template.html` exists and opens directly from disk.
- `example.html` exists and contains realistic fintech numbers and labels.
- Frontmatter uses `od.mode: template` and `od.scenario: live-artifacts`.
- Exactly three slides are present.
- Prev/Next buttons, dot navigation, and keyboard arrows all work.
- No sandbox-hostile APIs are used (`localStorage`, `sessionStorage`, `alert`, `confirm`, `prompt`, `window.open`).

## P1

- Slide 1 follows split-column Swiss composition with high-contrast hero message.
- Slide 2 presents a left rail + metric cards with internally consistent values.
- Slide 3 uses a three-column action layout with clear hierarchy.
- Typography remains clean and legible at laptop widths (>= 1280px).

## P2

- Hover motion remains restrained (no flashy loops).
- Dot active state is clearly visible on light and dark surfaces.
- Spacing remains consistent across all three slides.
