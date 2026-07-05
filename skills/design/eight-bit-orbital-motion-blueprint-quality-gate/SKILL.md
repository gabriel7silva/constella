---
name: eight-bit-orbital-motion-blueprint-quality-gate
description: |
  Use this skill when Codex needs procedural guidance derived from 8-bit-orbit-video-template/references/checklist.md. Recast from the original 8-bit-orbit-video-template/references/checklist.md material as the eight-bit-orbital-motion-blueprint-quality-gate procedure.
---

# Eight Bit Orbital Motion Blueprint Quality Gate

## Role

Use this skill when Codex needs procedural guidance derived from 8-bit-orbit-video-template/references/checklist.md. Recast from the original 8-bit-orbit-video-template/references/checklist.md material as the eight-bit-orbital-motion-blueprint-quality-gate procedure.

## Source Trace

- Original Markdown: `8-bit-orbit-video-template/references/checklist.md`
- Reformulated skill name: `eight-bit-orbital-motion-blueprint-quality-gate`

## Operating Guidance

Follow the rewritten material below as the working procedure. Keep code blocks, commands, file paths, URLs, dimensions, and API names exact when applying the skill.

## P0

- `assets/template.html` exists and opens directly from disk.
- `example.html` renders both the editable template preview and the default MP4 showcase.
- Skill frontmatter uses `od.mode: template`, `od.surface: video`, and `od.type: hyperframes`.
- Base composition includes exactly 3 scenes and each scene hold is under 3 seconds.
- Template keeps deterministic logic (seeded randomness only, no `repeat: -1` loops).
- Template avoids sandbox-hostile APIs (`localStorage`, `sessionStorage`, `alert`, `confirm`, `prompt`).

## P1

- Retro 8-bit visual language remains consistent across all three scenes.
- Scene transitions and entrance choreography are clearly visible at normal playback speed.
- Generated artifact remains a single self-contained HTML file.

## P2

- Keyboard preview controls (`1`, `2`, `3`, `r`) work in local preview.
- Mouse glow/parallax interaction remains subtle and does not hurt readability.
