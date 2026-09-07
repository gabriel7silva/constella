---
name: numbers-finance-grid-blueprint
description: |
  Use this skill when Codex needs swiss-grid fintech deck template in black / warm paper / neon-lime contrast. Reach for this when users ask for premium data-story slides with strict modular layout, bold numeric cards, restrained motion, and keyboard/click navigation in one HTML file. Recast from the original digits-fintech-swiss-template/SKILL.md material as the numbers-finance-grid-blueprint procedure.
---

# Numbers Finance Grid Blueprint

## Role

Use this skill when Codex needs swiss-grid fintech deck template in black / warm paper / neon-lime contrast. Reach for this when users ask for premium data-story slides with strict modular layout, bold numeric cards, restrained motion, and keyboard/click navigation in one HTML file. Recast from the original digits-fintech-swiss-template/SKILL.md material as the numbers-finance-grid-blueprint procedure.

## Source Trace

- Original Markdown: `digits-fintech-swiss-template/SKILL.md`
- Reformulated skill name: `numbers-finance-grid-blueprint`

## Operating Guidance

Follow the rewritten material below as the working procedure. Keep code blocks, commands, file paths, URLs, dimensions, and API names exact when applying the skill.

A premium three-slide live-artifact template for data-storytelling in a Swiss grid language.

## Resource map

```text
digits-fintech-swiss-template/
├── SKILL.md
├── assets/
│   └── template.html
├── references/
│   └── checklist.md
└── example.html
```

## Workflow

1. Start from `assets/template.html` and keep the three-slide structure intact.
2. Replace copy and metric values while preserving card hierarchy and reading order.
3. Keep interactions:
   - Prev / Next buttons
   - keyboard navigation (`ArrowLeft` / `ArrowRight`)
   - dot navigation
4. Keep motion subtle (slide fade + tiny hover lift only).
5. Keep the file self-contained (inline CSS/JS) with no sandbox-hostile APIs.

## Output contract

Emit one concise orientation sentence and then one HTML artifact:

```xml
<artifact identifier="digits-fintech-swiss" type="text/html" title="Digits Fintech Swiss Deck">
<!doctype html>
<html>...</html>
</artifact>
```
