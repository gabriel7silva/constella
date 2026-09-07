---
name: replicate-playbook
description: |
  Use this skill when Codex needs discover, compare, and execute AI models using Replicate's API. Strong fit for image, audio, and video generation pipelines that swap models frequently. Recast from the original replicate/SKILL.md material as the replicate-playbook procedure.
---

# Replicate Playbook

## Role

Use this skill when Codex needs discover, compare, and execute AI models using Replicate's API. Strong fit for image, audio, and video generation pipelines that swap models frequently. Recast from the original replicate/SKILL.md material as the replicate-playbook procedure.

## Source Trace

- Original Markdown: `replicate/SKILL.md`
- Reformulated skill name: `replicate-playbook`
- Upstream reference: https://github.com/replicate/skills
- Source category: `image-generation`

## Operating Guidance

Follow the rewritten material below as the working procedure. Keep code blocks, commands, file paths, URLs, dimensions, and API names exact when applying the skill.

> Adapted from Replicate.

## Purpose

Discover, compare, and execute AI models using Replicate's API. Strong fit for image, audio, and video generation pipelines that swap models frequently.

## Origin

- Upstream: https://github.com/replicate/skills
- Category: `image-generation`

## Procedure

This catalogue entry advertises the skill in Open Design so the agent
discovers it during planning. To execute the full upstream workflow with
its original assets, scripts, and references, install the upstream
bundle into your active agent's skills directory:

```bash
# Inspect the upstream README for exact paths
open https://github.com/replicate/skills
```

Then request this skill by name (`replicate`) or with
one of the trigger phrases listed in this skill's frontmatter.
