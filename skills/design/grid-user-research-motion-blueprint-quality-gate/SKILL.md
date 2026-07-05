---
name: grid-user-research-motion-blueprint-quality-gate
description: |
  Use this skill when Codex needs procedural guidance derived from swiss-user-research-video-template/references/checklist.md. Recast from the original swiss-user-research-video-template/references/checklist.md material as the grid-user-research-motion-blueprint-quality-gate procedure.
---

# Grid User Research Motion Blueprint Quality Gate

## Role

Use this skill when Codex needs procedural guidance derived from swiss-user-research-video-template/references/checklist.md. Recast from the original swiss-user-research-video-template/references/checklist.md material as the grid-user-research-motion-blueprint-quality-gate procedure.

## Source Trace

- Original Markdown: `swiss-user-research-video-template/references/checklist.md`
- Reformulated skill name: `grid-user-research-motion-blueprint-quality-gate`

## Operating Guidance

Follow the rewritten material below as the working procedure. Keep code blocks, commands, file paths, URLs, dimensions, and API names exact when applying the skill.

## P0

- `assets/template.html` exists and opens directly from disk.
- `example.html` is complete and uses realistic user-research labels and values.
- Skill frontmatter uses `od.mode: template` and `od.scenario: live-artifacts`.
- Exactly three slides are present, and nav dots reflect active slide.
- Keyboard navigation works (`ArrowLeft` / `ArrowRight`) and click navigation works.
- Participant donut and legend percentages are consistent (sum to 100%).
- No sandbox-hostile APIs are used (`localStorage`, `sessionStorage`, `alert`, `confirm`, `prompt`, `window.open`).

## P1

- Visual language stays Swiss-editorial: warm paper tone, thin rule lines, restrained typography.
- Motion remains subtle and legible: no looping flashy effects or jitter.
- Layout remains readable on common laptop widths (>= 1280px) without overlap.
- Right-panel evidence card in slide 3 includes caption and not just decorative framing.

## P2

- Dot navigation is clearly visible on both light and dark room environments.
- Legend hover emphasis does not hide percentage values.
- Slide transitions feel consistent in duration and easing.
