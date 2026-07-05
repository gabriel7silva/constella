---
name: imagecraft-playbook
description: |
  Use this skill when Codex needs compose and edit images using OpenAI's Image API for project assets — UI mockups, icons, illustrations, social cards, and visual references. Recast from the original imagegen/SKILL.md material as the imagecraft-playbook procedure.
---

# Imagecraft Playbook

## Role

Use this skill when Codex needs compose and edit images using OpenAI's Image API for project assets — UI mockups, icons, illustrations, social cards, and visual references. Recast from the original imagegen/SKILL.md material as the imagecraft-playbook procedure.

## Source Trace

- Original Markdown: `imagegen/SKILL.md`
- Reformulated skill name: `imagecraft-playbook`
- Upstream reference: https://github.com/openai/skills
- Source category: `image-generation`

## Operating Guidance

Follow the rewritten material below as the working procedure. Keep code blocks, commands, file paths, URLs, dimensions, and API names exact when applying the skill.

> Adapted from OpenAI's skills repository.

## Purpose

Compose and edit images using OpenAI's Image API for project assets — UI mockups, icons, illustrations, social cards, and visual references.

## Origin

- Upstream: https://github.com/openai/skills
- Category: `image-generation`

## Procedure

This catalogue entry advertises the skill in Open Design so the agent
discovers it during planning. To execute the full upstream workflow with
its original assets, scripts, and references, install the upstream
bundle into your active agent's skills directory:

```bash
# Inspect the upstream README for exact paths
open https://github.com/openai/skills
```

Then request this skill by name (`imagegen`) or with
one of the trigger phrases listed in this skill's frontmatter.
