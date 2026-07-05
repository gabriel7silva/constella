---
name: eight-bit-orbital-motion-blueprint
description: |
  Use this skill when Codex needs hyperframes-based video template for retro pixel deck motion design. Reach for this when users want a high-fidelity, multi-scene HTML-to-video composition with advanced transitions, interactive preview controls, and ready-to-render default style. Recast from the original 8-bit-orbit-video-template/SKILL.md material as the eight-bit-orbital-motion-blueprint procedure.
---

# Eight Bit Orbital Motion Blueprint

## Role

Use this skill when Codex needs hyperframes-based video template for retro pixel deck motion design. Reach for this when users want a high-fidelity, multi-scene HTML-to-video composition with advanced transitions, interactive preview controls, and ready-to-render default style. Recast from the original 8-bit-orbit-video-template/SKILL.md material as the eight-bit-orbital-motion-blueprint procedure.

## Source Trace

- Original Markdown: `8-bit-orbit-video-template/SKILL.md`
- Reformulated skill name: `eight-bit-orbital-motion-blueprint`

## Operating Guidance

Follow the rewritten material below as the working procedure. Keep code blocks, commands, file paths, URLs, dimensions, and API names exact when applying the skill.

Ship a premium template-mode Hyperframes composition with a ready default showcase and deterministic timeline behavior.

## Resource map

```text
8-bit-orbit-video-template/
├── SKILL.md
├── assets/
│   └── template.html
├── references/
│   └── checklist.md
└── example.html
```

The rendered MP4 showcase used by `example.html` is hosted at
`https://repo-assets.open-design.ai/resources/videos/skills/8-bit-orbit-video-template/default-showcase.mp4`.

## Workflow

1. Copy `assets/template.html` to `index.html`.
2. Keep the 3-scene structure and transition rhythm intact unless the user explicitly asks to change pacing.
3. Personalize titles, subtitle lines, labels, and palette while preserving the retro pixel aesthetic.
4. Keep timing constraint: every scene hold prefer to stay within 3 seconds.
5. Preserve deterministic behavior in generated compositions (no unseeded randomness, no infinite GSAP loops).
6. Keep all code self-contained in one HTML file with inline CSS/JS.
7. Verify against `references/checklist.md` before emitting the artifact.

## Output contract

Emit one short sentence before the artifact, then a single HTML artifact:

```xml
<artifact identifier="8-bit-orbit-video-template" type="text/html" title="8-Bit Orbit Video Template">
<!doctype html>
<html>...</html>
</artifact>
```
