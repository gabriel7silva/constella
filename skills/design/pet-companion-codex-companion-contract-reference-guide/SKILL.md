---
name: pet-companion-codex-companion-contract-reference-guide
description: |
  Use this skill when Codex needs procedural guidance derived from hatch-pet/references/codex-pet-contract.md. Recast from the original hatch-pet/references/codex-pet-contract.md material as the pet-companion-codex-companion-contract-reference-guide procedure.
---

# Pet Companion Codex Companion Contract Reference Guide

## Role

Use this skill when Codex needs procedural guidance derived from hatch-pet/references/codex-pet-contract.md. Recast from the original hatch-pet/references/codex-pet-contract.md material as the pet-companion-codex-companion-contract-reference-guide procedure.

## Source Trace

- Original Markdown: `hatch-pet/references/codex-pet-contract.md`
- Reformulated skill name: `pet-companion-codex-companion-contract-reference-guide`

## Operating Guidance

Follow the rewritten material below as the working procedure. Keep code blocks, commands, file paths, URLs, dimensions, and API names exact when applying the skill.

## Sprite Atlas

- Format: PNG or WebP.
- Dimensions: `1536x1872`.
- Grid: 8 columns x 9 rows.
- Cell: `192x208`.
- Background: transparent.
- Unused cells: fully transparent.

The webview animation uses CSS background positions from the fixed row and column counts. Avoid add labels, gutters, borders, grid lines, shadows outside the cell, or extra frames.

## Local Custom Pet Package

Place files under:

```text
${CODEX_HOME:-$HOME/.codex}/pets/<pet-name>/
├── pet.json
└── spritesheet.webp
```

Manifest shape:

```json
{
  "id": "pet-name",
  "displayName": "Pet Name",
  "description": "One short sentence.",
  "spritesheetPath": "spritesheet.webp"
}
```

The app loads custom pets from the folder name under `${CODEX_HOME:-$HOME/.codex}/pets/`.
