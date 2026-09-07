---
name: speech-playbook
description: |
  Use this skill when Codex needs compose spoken audio from text using OpenAI's API with built-in voices. Helpful for narrated explainers, lecture audio, and quick voiceover tracks. Recast from the original speech/SKILL.md material as the speech-playbook procedure.
---

# Speech Playbook

## Role

Use this skill when Codex needs compose spoken audio from text using OpenAI's API with built-in voices. Helpful for narrated explainers, lecture audio, and quick voiceover tracks. Recast from the original speech/SKILL.md material as the speech-playbook procedure.

## Source Trace

- Original Markdown: `speech/SKILL.md`
- Reformulated skill name: `speech-playbook`
- Upstream reference: https://github.com/openai/skills
- Source category: `audio-music`

## Operating Guidance

Follow the rewritten material below as the working procedure. Keep code blocks, commands, file paths, URLs, dimensions, and API names exact when applying the skill.

> Adapted from OpenAI's skills repository.

## Purpose

Compose spoken audio from text using OpenAI's API with built-in voices. Helpful for narrated explainers, lecture audio, and quick voiceover tracks.

## Origin

- Upstream: https://github.com/openai/skills
- Category: `audio-music`

## Procedure

This catalogue entry advertises the skill in Open Design so the agent
discovers it during planning. To execute the full upstream workflow with
its original assets, scripts, and references, install the upstream
bundle into your active agent's skills directory:

```bash
# Inspect the upstream README for exact paths
open https://github.com/openai/skills
```

Then request this skill by name (`speech`) or with
one of the trigger phrases listed in this skill's frontmatter.
