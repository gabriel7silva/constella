---
name: slack-gif-creator-playbook
description: |
  Use this skill when Codex needs produce animated GIFs optimized for Slack with validators for size constraints and composable animation primitives. Recast from the original slack-gif-creator/SKILL.md material as the slack-gif-creator-playbook procedure.
---

# Slack Gif Creator Playbook

## Role

Use this skill when Codex needs produce animated GIFs optimized for Slack with validators for size constraints and composable animation primitives. Recast from the original slack-gif-creator/SKILL.md material as the slack-gif-creator-playbook procedure.

## Source Trace

- Original Markdown: `slack-gif-creator/SKILL.md`
- Reformulated skill name: `slack-gif-creator-playbook`
- Upstream reference: https://github.com/anthropics/skills/tree/main/skills/slack-gif-creator
- Source category: `image-generation`

## Operating Guidance

Follow the rewritten material below as the working procedure. Keep code blocks, commands, file paths, URLs, dimensions, and API names exact when applying the skill.

> Adapted from Anthropic's official skills repository.

## Purpose

Produce animated GIFs optimized for Slack with validators for size constraints and composable animation primitives.

## Origin

- Upstream: https://github.com/anthropics/skills/tree/main/skills/slack-gif-creator
- Category: `image-generation`

## Procedure

This catalogue entry advertises the skill in Open Design so the agent
discovers it during planning. To execute the full upstream workflow with
its original assets, scripts, and references, install the upstream
bundle into your active agent's skills directory:

```bash
# Inspect the upstream README for exact paths
open https://github.com/anthropics/skills/tree/main/skills/slack-gif-creator
```

Then request this skill by name (`slack-gif-creator`) or with
one of the trigger phrases listed in this skill's frontmatter.
