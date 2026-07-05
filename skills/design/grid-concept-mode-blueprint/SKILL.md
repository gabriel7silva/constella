---
name: grid-concept-mode-blueprint
description: |
  Use this skill when Codex needs swiss-inspired creative-mode presentation template skill with bold editorial typography, high-contrast geometric cards, interactive slide navigation, theme switching, hotspot overlays, and palette choreography in a single-file HTML artifact. Reach for this when users ask for a premium presentation-style landing, a Swiss/brutalist deck look, or a creative launch page with rich interactions. Recast from the original swiss-creative-mode-template/SKILL.md material as the grid-concept-mode-blueprint procedure.
---

# Grid Concept Mode Blueprint

## Role

Use this skill when Codex needs swiss-inspired creative-mode presentation template skill with bold editorial typography, high-contrast geometric cards, interactive slide navigation, theme switching, hotspot overlays, and palette choreography in a single-file HTML artifact. Reach for this when users ask for a premium presentation-style landing, a Swiss/brutalist deck look, or a creative launch page with rich interactions. Recast from the original swiss-creative-mode-template/SKILL.md material as the grid-concept-mode-blueprint procedure.

## Source Trace

- Original Markdown: `swiss-creative-mode-template/SKILL.md`
- Reformulated skill name: `grid-concept-mode-blueprint`

## Operating Guidance

Follow the rewritten material below as the working procedure. Keep code blocks, commands, file paths, URLs, dimensions, and API names exact when applying the skill.

Produce a premium Swiss/editorial-style HTML template with strong visual rhythm
and meaningful interactions, then emit it as a single-file artifact.

## Resource map

```text
swiss-creative-mode-template/
├── SKILL.md
├── assets/
│   └── template.html
├── references/
│   └── checklist.md
└── example.html
```

## Workflow

1. Read active `DESIGN.md` and map palette/type/layout decisions into root CSS variables.
2. Copy `assets/template.html` to `index.html`.
3. Keep this structure intact:
   - Hero scene with bold title and geometric frame.
   - Four-step process card row.
   - Stack/architecture diagram scene.
4. Keep these interactions working:
   - Prev/next slide navigation + dot nav.
   - Theme toggle (paper/dark).
   - Palette cycle button (changes accent colors across the template).
   - Hotspot toggle for annotations/details.
5. Keep output self-contained (`<!doctype html>`, inline CSS/JS, no external runtime dependency).
6. Verify against `references/checklist.md` before emitting.

## Output contract

One short sentence before artifact, then:

```xml
<artifact identifier="swiss-creative-mode" type="text/html" title="Swiss Creative Mode Template">
<!doctype html>
<html>...</html>
</artifact>
```
