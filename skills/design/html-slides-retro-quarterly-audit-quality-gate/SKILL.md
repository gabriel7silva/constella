---
name: html-slides-retro-quarterly-audit-quality-gate
description: |
  Use this skill when Codex needs procedural guidance derived from html-ppt-retro-quarterly-review/references/checklist.md. Recast from the original html-ppt-retro-quarterly-review/references/checklist.md material as the html-slides-retro-quarterly-audit-quality-gate procedure.
---

# Html Slides Retro Quarterly Audit Quality Gate

## Role

Use this skill when Codex needs procedural guidance derived from html-ppt-retro-quarterly-review/references/checklist.md. Recast from the original html-ppt-retro-quarterly-review/references/checklist.md material as the html-slides-retro-quarterly-audit-quality-gate procedure.

## Source Trace

- Original Markdown: `html-ppt-retro-quarterly-review/references/checklist.md`
- Reformulated skill name: `html-slides-retro-quarterly-audit-quality-gate`

## Operating Guidance

Follow the rewritten material below as the working procedure. Keep code blocks, commands, file paths, URLs, dimensions, and API names exact when applying the skill.

## P0

- `assets/template.html` exists and opens directly from disk.
- `example.html` is complete and matches the same visual language as the template.
- Skill frontmatter uses `od.mode: template` and `od.scenario: live-artifacts`.
- Three-slide structure is preserved: cover, priorities, roadmap.
- Headline hierarchy remains bold slab-serif with blue/orange retro treatment.
- Timeline + KPI strip is present on slide 3.
- No sandbox-hostile APIs are used unguarded (`localStorage`, `alert`, `confirm`, `prompt`).

## P1

- Motion pacing feels premium and controlled; scene transitions are legible.
- Scene indicator updates correctly across slides.
- Keyboard interactions (`1/2/3`, `R`) work in local preview.
- Layout keeps clean alignment and readable density at 1920x1080.

## P2

- Decorative effects (grain/shadows) stay subtle enough to avoid visual fatigue.
- Color contrast remains readable for body copy over cream/blue regions.
