---
name: skill-frontmatter-spec
description: SKILL.md YAML frontmatter fields (name, description, license, compatibility, metadata, allowed-tools) and constraints. Consult when writing frontmatter.
domain: meta
category: meta
tags: [frontmatter, yaml, agent-skills, skill-md, spec]
official_sources:
  - https://agentskills.io/specification
  - https://github.com/agentskills/agentskills
verified: 2026-06-16
---

# SKILL.md Frontmatter Spec

## Overview
Every Agent Skill begins with YAML frontmatter at the top of its `SKILL.md`. Two fields are required (`name`, `description`); the open Agent Skills specification also defines optional fields (`license`, `compatibility`, `metadata`, `allowed-tools`) and clients may add their own (unknown fields are ignored for forward compatibility). Read this when authoring frontmatter, debugging why a skill fails validation, or aligning frontmatter conventions across repos like anthropics/skills, vercel-labs/agent-skills, and remotion-dev/skills.

## Official sources
- Spec (full frontmatter table + per-field rules): https://agentskills.io/specification
- Spec repo + `skills-ref` validator: https://github.com/agentskills/agentskills
- Anthropic field requirements (overview, "Skill structure"): https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview
- Example skills using this frontmatter: https://github.com/anthropics/skills · https://github.com/vercel-labs/agent-skills · https://github.com/remotion-dev/skills

## Core concepts
- **`name` (required).** 1–64 chars, lowercase letters/numbers/hyphens only (`^[a-z0-9]+(-[a-z0-9]+)*$`), no leading/trailing or consecutive hyphens, and must match the parent directory name. Anthropic's docs additionally forbid the reserved words `anthropic` and `claude` and any XML tags.
- **`description` (required).** 1–1024 chars, non-empty, no XML tags; should state what the skill does and when to use it, with discovery keywords. It is loaded into the system prompt at startup, so it drives skill selection.
- **`license` (optional).** A license name or a reference to a bundled license file; keep it short (spec, `license` field).
- **`compatibility` (optional).** Up to 500 chars describing environment needs (intended product, required system packages, network access). Most skills omit it (spec, `compatibility` field).
- **`metadata` (optional).** An arbitrary string-to-string map for client-specific data such as `author` and `version`; use reasonably unique keys to avoid conflicts (spec, `metadata` field).
- **`allowed-tools` (optional, experimental).** A space-separated string of pre-approved tools, e.g. `Bash(git:*) Bash(jq:*) Read`; support varies by agent implementation (spec, `allowed-tools` field).

## Best practices
- Make the `name` exactly match the skill's directory name — the spec requires it and validators enforce it.
- Validate frontmatter with the reference tool before shipping: `skills-ref validate ./my-skill` (spec, "Validation").
- Quote ambiguous YAML scalars (e.g. `version: "1.0"`) so they are not parsed as numbers (spec `metadata` example uses quotes).
- Treat the `description` as a discovery surface: front-load distinctive keywords and the triggering context, since it is the metadata loaded for every skill at startup (Anthropic best-practices, "Writing effective descriptions").
- Only add `compatibility` when the skill genuinely has environment requirements; leaving it off keeps metadata lean (spec note: "Most skills do not need the `compatibility` field").

## Common pitfalls
- Uppercase, leading/trailing, or consecutive hyphens in `name` (`PDF-Processing`, `-pdf`, `pdf--processing`) → use lowercase, single-hyphen-separated tokens matching the regex.
- `name` that differs from the folder name → rename one so they match, or validation fails.
- Putting custom keys at the top level of the frontmatter → nest non-spec data under `metadata` so it is treated as client metadata rather than an unknown/ignored field.
- Embedding XML tags or exceeding length limits in `name`/`description` → both fields reject XML tags, and they cap at 64 and 1024 characters respectively.

## Examples
```yaml
---
name: pdf-processing
description: Extract PDF text, fill forms, merge files. Use when handling PDFs, forms, or document extraction.
license: Apache-2.0
compatibility: Requires Python 3.14+ and uv
metadata:
  author: example-org
  version: "1.0"
allowed-tools: Bash(git:*) Read
---
```

## Further reading
- Full specification with valid/invalid examples per field: https://agentskills.io/specification
- Anthropic frontmatter requirements + description guidance: https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices

## Related skills
- ../authoring-agent-skills — the skill folder + SKILL.md format the frontmatter belongs to
- ../progressive-disclosure — how the frontmatter metadata enables on-demand loading
