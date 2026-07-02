---
name: document-playbook
description: |
  Use this skill when Codex needs read, produce, and edit .docx documents with formatting and layout fidelity via OpenAI's document skill. Recast from the original doc/SKILL.md material as the document-playbook procedure.
---

# Document Playbook

## Role

Use this skill when Codex needs read, produce, and edit .docx documents with formatting and layout fidelity via OpenAI's document skill. Recast from the original doc/SKILL.md material as the document-playbook procedure.

## Source Trace

- Original Markdown: `doc/SKILL.md`
- Reformulated skill name: `document-playbook`
- Upstream reference: https://github.com/openai/skills
- Source category: `documents`

## Operating Guidance

Follow the rewritten material below as the working procedure. Keep code blocks, commands, file paths, URLs, dimensions, and API names exact when applying the skill.

> Adapted from OpenAI's skills repository.

## Purpose

Read, produce, and edit .docx documents with formatting and layout fidelity via OpenAI's document skill.

## Origin

- Upstream: https://github.com/openai/skills
- Category: `documents`

## Procedure

This catalogue entry advertises the skill in Open Design so the agent
discovers it during planning. To execute the full upstream workflow with
its original assets, scripts, and references, install the upstream
bundle into your active agent's skills directory:

```bash
# Inspect the upstream README for exact paths
open https://github.com/openai/skills
```

Then request this skill by name (`doc`) or with
one of the trigger phrases listed in this skill's frontmatter.
