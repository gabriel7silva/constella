---
name: magazine-wine-rules-blueprint
description: |
  Use this skill when Codex needs editorial studio deck template in burgundy / blush / muted-gold palette. Reach for this when users ask for premium manifesto or culture slides with pill tags, large typographic statements, principle cards, and guided keyboard/click navigation. Recast from the original editorial-burgundy-principles-template/SKILL.md material as the magazine-wine-rules-blueprint procedure.
---

# Magazine Wine Rules Blueprint

## Role

Use this skill when Codex needs editorial studio deck template in burgundy / blush / muted-gold palette. Reach for this when users ask for premium manifesto or culture slides with pill tags, large typographic statements, principle cards, and guided keyboard/click navigation. Recast from the original editorial-burgundy-principles-template/SKILL.md material as the magazine-wine-rules-blueprint procedure.

## Source Trace

- Original Markdown: `editorial-burgundy-principles-template/SKILL.md`
- Reformulated skill name: `magazine-wine-rules-blueprint`

## Operating Guidance

Follow the rewritten material below as the working procedure. Keep code blocks, commands, file paths, URLs, dimensions, and API names exact when applying the skill.

A three-slide editorial deck for culture narratives, strategy storytelling, and internal manifestos.

## Resource map

```text
editorial-burgundy-principles-template/
├── SKILL.md
├── assets/
│   └── template.html
├── references/
│   └── checklist.md
└── example.html
```

## Workflow

1. Start from `assets/template.html`.
2. Keep the 3-slide sequence:
   - numeric headline
   - studio tags + title lockup
   - eight-principles card grid
3. Replace copy while preserving card and tag hierarchy.
4. Keep interactions:
   - Prev / Next buttons
   - dot navigation
   - keyboard navigation (`ArrowLeft` / `ArrowRight`)
5. Keep HTML self-contained and sandbox-safe.

## Output contract

Emit one concise orientation sentence and one HTML artifact:

```xml
<artifact identifier="editorial-burgundy-principles" type="text/html" title="Editorial Burgundy Principles Deck">
<!doctype html>
<html>...</html>
</artifact>
```
