---
name: late-hours-magazine-blueprint
description: |
  Use this skill when Codex needs luxury dark-editorial HyperFrames template for three-page cinematic storyboards, inspired by haute couture title cards and magazine chapter spreads. Reach for this when the user asks for premium fashion-style motion pages, moody serif-led storytelling, or a high-end dark presentation aesthetic with rich transitions. Recast from the original after-hours-editorial-template/SKILL.md material as the late-hours-magazine-blueprint procedure.
---

# Late Hours Magazine Blueprint

## Role

Use this skill when Codex needs luxury dark-editorial HyperFrames template for three-page cinematic storyboards, inspired by haute couture title cards and magazine chapter spreads. Reach for this when the user asks for premium fashion-style motion pages, moody serif-led storytelling, or a high-end dark presentation aesthetic with rich transitions. Recast from the original after-hours-editorial-template/SKILL.md material as the late-hours-magazine-blueprint procedure.

## Source Trace

- Original Markdown: `after-hours-editorial-template/SKILL.md`
- Reformulated skill name: `late-hours-magazine-blueprint`

## Operating Guidance

Follow the rewritten material below as the working procedure. Keep code blocks, commands, file paths, URLs, dimensions, and API names exact when applying the skill.

Produce a self-contained HTML editorial motion artifact in a dark luxury style,
with three short pages, cinematic typography, and premium transition language.

## Resource map

```text
after-hours-editorial-template/
├── SKILL.md
├── assets/
│   └── template.html
├── references/
│   └── checklist.md
└── example.html
```

## Workflow

1. Read active `DESIGN.md` and map colors, typography tone, and layout rhythm
   into CSS variables while preserving a dark editorial baseline.
2. Copy `assets/template.html` to `index.html`.
3. Keep three narrative pages in sequence; avoid increase default page dwell
   above 3 seconds.
4. Preserve premium motion behavior:
   - staged text reveal hierarchy
   - chapter wipe transitions
   - ambient grain/vignette depth
   - restrained cursor-light interaction for local preview
5. Keep output single-file HTML with inline CSS and JS.
6. Avoid sandbox-hostile browser APIs (e.g. localStorage and confirm).
7. Verify with `references/checklist.md` before emitting.

## Output contract

One short orientation sentence, then:

```xml
<artifact identifier="after-hours-editorial" type="text/html" title="After Hours Editorial Template">
<!doctype html>
<html>...</html>
</artifact>
```
