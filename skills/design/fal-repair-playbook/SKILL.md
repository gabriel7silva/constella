---
name: fal-repair-playbook
description: |
  Use this skill when Codex needs restore and fix image quality — deblur, denoise, fix faces, and restore old documents using fal.ai's hosted restoration models. Recast from the original fal-restore/SKILL.md material as the fal-repair-playbook procedure.
---

# Fal Repair Playbook

## Role

Use this skill when Codex needs restore and fix image quality — deblur, denoise, fix faces, and restore old documents using fal.ai's hosted restoration models. Recast from the original fal-restore/SKILL.md material as the fal-repair-playbook procedure.

## Source Trace

- Original Markdown: `fal-restore/SKILL.md`
- Reformulated skill name: `fal-repair-playbook`
- Upstream reference: https://github.com/fal-ai-community/skills
- Source category: `image-generation`

## Operating Guidance

Follow the rewritten material below as the working procedure. Keep code blocks, commands, file paths, URLs, dimensions, and API names exact when applying the skill.

> Adapted from the fal.ai community team.

## Purpose

Restore and fix image quality — deblur, denoise, fix faces, and restore old documents using fal.ai's hosted restoration models.

## Origin

- Upstream: https://github.com/fal-ai-community/skills
- Category: `image-generation`

## Procedure

This catalogue entry advertises the skill in Open Design so the agent
discovers it during planning. To execute the full upstream workflow with
its original assets, scripts, and references, install the upstream
bundle into your active agent's skills directory:

```bash
# Inspect the upstream README for exact paths
open https://github.com/fal-ai-community/skills
```

Then request this skill by name (`fal-restore`) or with
one of the trigger phrases listed in this skill's frontmatter.
