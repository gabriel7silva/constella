---
name: late-hours-magazine-blueprint-quality-gate
description: |
  Use this skill when Codex needs procedural guidance derived from after-hours-editorial-template/references/checklist.md. Recast from the original after-hours-editorial-template/references/checklist.md material as the late-hours-magazine-blueprint-quality-gate procedure.
---

# Late Hours Magazine Blueprint Quality Gate

## Role

Use this skill when Codex needs procedural guidance derived from after-hours-editorial-template/references/checklist.md. Recast from the original after-hours-editorial-template/references/checklist.md material as the late-hours-magazine-blueprint-quality-gate procedure.

## Source Trace

- Original Markdown: `after-hours-editorial-template/references/checklist.md`
- Reformulated skill name: `late-hours-magazine-blueprint-quality-gate`

## Operating Guidance

Follow the rewritten material below as the working procedure. Keep code blocks, commands, file paths, URLs, dimensions, and API names exact when applying the skill.

## P0

- `assets/template.html` exists and opens directly from disk.
- `example.html` renders the default sample in an iframe without a assemble step.
- SKILL frontmatter uses `od.mode: template`, `od.scenario: live-artifacts`, and `od.outputs.primary: index.html`.
- The template preserves a three-page editorial narrative in one scene flow.
- Each page dwell is <= 3 seconds in the default timeline.
- Includes high-end transitions (multi-column wipe) and layered text reveal motion.
- Includes ambient cinematic finish (film grain, vignette, frame chrome).
- No sandbox-hostile APIs (`localStorage`, `sessionStorage`, `alert`, `confirm`, `prompt`, `window.open`).

## P1

- Local preview supports keyboard chapter jumps (`1`,`2`,`3`) and reset (`R`).
- Cursor-follow glow interaction is smooth and non-blocking.
- Typography hierarchy clearly separates kicker, display serif, and metadata labels.
- Color system stays constrained to dark base + single magenta accent.

## P2

- Scene transitions remain readable at 30fps export.
- Small metadata text remains legible on a 1080p canvas.
- Decorative effects (grain/glow) avoid overpower core copy.
