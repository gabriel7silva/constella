---
name: html-slides-retro-quarterly-audit-playbook
description: |
  Use this skill when Codex needs retro Quarterly Review presentation template in a bold blue + orange editorial language. Reach for this when users ask for a high-impact quarterly review / roadmap deck with heavyweight slab headlines, clean cream paper sections, structured grids, and fast premium motion pacing (3 slides, each hold under 3s in video mode). Recast from the original html-ppt-retro-quarterly-review/SKILL.md material as the html-slides-retro-quarterly-audit-playbook procedure.
---

# Html Slides Retro Quarterly Audit Playbook

## Role

Use this skill when Codex needs retro Quarterly Review presentation template in a bold blue + orange editorial language. Reach for this when users ask for a high-impact quarterly review / roadmap deck with heavyweight slab headlines, clean cream paper sections, structured grids, and fast premium motion pacing (3 slides, each hold under 3s in video mode). Recast from the original html-ppt-retro-quarterly-review/SKILL.md material as the html-slides-retro-quarterly-audit-playbook procedure.

## Source Trace

- Original Markdown: `html-ppt-retro-quarterly-review/SKILL.md`
- Reformulated skill name: `html-slides-retro-quarterly-audit-playbook`

## Operating Guidance

Follow the rewritten material below as the working procedure. Keep code blocks, commands, file paths, URLs, dimensions, and API names exact when applying the skill.

A high-contrast, print-inspired quarterly review template with three cinematic
slides:

1. Cover (hero title lockup)
2. Three priorities (triptych grid)
3. Roadmap timeline + KPI strip

## Resource map

```text
html-ppt-retro-quarterly-review/
├── SKILL.md
├── assets/
│   └── template.html
├── references/
│   └── checklist.md
└── example.html
```

## Workflow

1. Read active `DESIGN.md` first and map any requested token changes into CSS
   variables while preserving the retro blue/orange/cream visual grammar.
2. Start from `assets/template.html`; avoid rebuild from scratch.
3. Preserve the three-slide information architecture and typographic hierarchy.
4. Keep interactions and motion quality:
   - keyboard `1/2/3` quick jump
   - `R` restart
   - page indicator updates per scene
   - premium wipe transitions and staggered reveals
5. Keep output self-contained (single HTML, inline CSS + JS, no framework runtime).
6. If adapting copy/data, keep content realistic and internally consistent.
7. Verify against `references/checklist.md` before emitting artifact.

## Output contract

Emit one short orientation sentence and then the artifact:

```xml
<artifact identifier="retro-quarterly-review" type="text/html" title="Retro Quarterly Review">
<!doctype html>
<html>...</html>
</artifact>
```
