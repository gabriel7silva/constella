---
name: ui-ux-pro-max-playbook
description: |
  Use this skill when Codex needs catalog-only UI/UX Pro Max entry. The full upstream templates, data, and search workflow are not bundled in Open Design. Recast from the original ui-ux-pro-max/SKILL.md material as the ui-ux-pro-max-playbook procedure.
---

# UI UX Pro Max Playbook

## Role

Use this skill when Codex needs catalog-only UI/UX Pro Max entry. The full upstream templates, data, and search workflow are not bundled in Open Design. Recast from the original ui-ux-pro-max/SKILL.md material as the ui-ux-pro-max-playbook procedure.

## Source Trace

- Original Markdown: `ui-ux-pro-max/SKILL.md`
- Reformulated skill name: `ui-ux-pro-max-playbook`
- Upstream reference: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
- Source category: `design-systems`

## Operating Guidance

Follow the rewritten material below as the working procedure. Keep code blocks, commands, file paths, URLs, dimensions, and API names exact when applying the skill.

> Adapted from @nextlevelbuilder.

## Purpose

Catalog-only UI/UX Pro Max entry. The full upstream templates, data, and search workflow are not bundled in Open Design.

## Current Open Design scope

Open Design currently ships this entry as discovery metadata only. If this `SKILL.md`
is the only file under `skills/ui-ux-pro-max/`, the upstream UI/UX Pro Max
workflow is not available locally.

The full upstream workflow expects additional assets such as the searchable
`data` CSVs, the `scripts/search.py` helper, reference material, templates, and
related upstream skill instructions. Without those files, avoid tell users that
the full UI/UX Pro Max pattern library or template search is active.

## Origin

- Upstream: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
- Category: `design-systems`

## Procedure

This catalogue entry advertises the skill in Open Design so the agent
discovers it during planning. To execute the full upstream workflow with
its original assets, scripts, and references, install the upstream
bundle into your active agent's skills directory:

```bash
# Inspect the upstream README for exact paths
open https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
```

Then request this skill by name (`ui-ux-pro-max`) or with
one of the trigger phrases listed in this skill's frontmatter.

If those upstream files are not installed, explain that Open Design only has the
catalog entry for this skill and ask whether to continue with Open Design's
default design-system guidance instead.
