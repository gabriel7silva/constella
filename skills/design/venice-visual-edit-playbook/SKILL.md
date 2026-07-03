---
name: venice-visual-edit-playbook
description: |
  Use this skill when Codex needs image edits, upscaling, and background removal via the Venice.ai API. Recast from the original venice-image-edit/SKILL.md material as the venice-visual-edit-playbook procedure.
---

# Venice Visual Edit Playbook

## Role

Use this skill when Codex needs image edits, upscaling, and background removal via the Venice.ai API. Recast from the original venice-image-edit/SKILL.md material as the venice-visual-edit-playbook procedure.

## Source Trace

- Original Markdown: `venice-image-edit/SKILL.md`
- Reformulated skill name: `venice-visual-edit-playbook`
- Upstream reference: https://github.com/veniceai/skills
- Source category: `image-generation`

## Operating Guidance

Follow the rewritten material below as the working procedure. Keep code blocks, commands, file paths, URLs, dimensions, and API names exact when applying the skill.

> Adapted from the Venice.ai team.

## Purpose

Image edits, upscaling, and background removal via the Venice.ai API.

## Origin

- Upstream: https://github.com/veniceai/skills
- Category: `image-generation`

## Procedure

This catalogue entry advertises the skill in Open Design so the agent
discovers it during planning. To execute the full upstream workflow with
its original assets, scripts, and references, install the upstream
bundle into your active agent's skills directory:

```bash
# Inspect the upstream README for exact paths
open https://github.com/veniceai/skills
```

Then request this skill by name (`venice-image-edit`) or with
one of the trigger phrases listed in this skill's frontmatter.
