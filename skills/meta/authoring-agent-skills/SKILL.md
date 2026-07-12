---
name: authoring-agent-skills
description: How to author an Agent Skill — a folder + SKILL.md with YAML frontmatter, loaded on demand. Consult when creating or reviewing a skill.
domain: meta
category: meta
tags: [agent-skills, skill-md, frontmatter, claude, authoring]
official_sources:
  - https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview
  - https://github.com/anthropics/skills
verified: 2026-06-16
---

# Authoring Agent Skills

## Overview
An Agent Skill is a folder containing a `SKILL.md` file that packages instructions, metadata, and optional resources (scripts, reference docs, templates) that an agent loads automatically when a task is relevant. Skills turn a general-purpose agent into a specialist without bloating the system prompt, because only lightweight metadata is loaded up front. Read this when you need to create a new skill, fix one that is not being discovered, or review a skill's structure against the spec.

## Official sources
- Docs (overview): https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview
- Docs (authoring best practices): https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices
- Repo (official examples + template + spec): https://github.com/anthropics/skills
- Open spec: https://agentskills.io/specification

## Core concepts
- **A skill is a directory.** At minimum it holds a top-level `SKILL.md`; optional `scripts/`, `references/`, and `assets/` subfolders carry code and reference material (per the open spec at agentskills.io).
- **`SKILL.md` = YAML frontmatter + Markdown body.** The frontmatter is metadata for discovery; the body is the procedural instructions the agent follows once the skill activates.
- **Two required frontmatter fields:** `name` (max 64 chars, lowercase letters/numbers/hyphens, no reserved words `anthropic`/`claude`) and `description` (non-empty, max 1024 chars). Both must avoid XML tags.
- **Three loading levels (progressive disclosure).** Level 1 metadata (name + description, ~100 tokens) is always loaded at startup; Level 2 is the `SKILL.md` body, loaded only when the skill is triggered; Level 3 is bundled files/scripts, read or executed on demand without consuming context until accessed.
- **Discovery is description-driven.** At startup only each skill's `name` and `description` enter the system prompt, so the agent decides whether to read the full `SKILL.md` based almost entirely on the description.
- **Scripts run, not read.** Utility scripts in `scripts/` are executed via bash; only their output enters context, making them more reliable and cheaper than asking the agent to regenerate code.

## Best practices
- Write the `description` in third person and state both *what the skill does* and *when to use it*, including concrete trigger keywords — it is the single most important field for discovery (best-practices guide).
- Keep the `SKILL.md` body under 500 lines; split deeper material into separate reference files that the body links to (best-practices guide, "Progressive disclosure patterns").
- Use gerund-form names where it reads naturally (`processing-pdfs`, `analyzing-spreadsheets`); avoid vague names like `helper`, `utils`, or `tools` (best-practices guide, "Naming conventions").
- Assume the agent is already capable: only add context it does not already have, and challenge each sentence for its token cost (best-practices guide, "Concise is key").
- Match degrees of freedom to task fragility: high-freedom prose for open-ended work, exact low-freedom commands for fragile/destructive steps (best-practices guide, "Set appropriate degrees of freedom").

## Common pitfalls
- Vague descriptions like "Helps with documents" → write specific descriptions with what + when + keywords so the agent can pick the right skill among many.
- Windows-style backslash paths in references → always use forward slashes (`scripts/helper.py`); backslashes break on Unix (best-practices guide, "Anti-patterns to avoid").
- Deeply nested reference chains (`SKILL.md` → `a.md` → `b.md`) → keep all references one level deep from `SKILL.md` so the agent reads complete files instead of partial previews.
- Using a skill from an untrusted source without auditing it → review every bundled file; a malicious skill can direct the agent to misuse tools or exfiltrate data (overview, "Security considerations").

## Examples
```markdown
---
name: processing-pdfs
description: Extract text and tables from PDF files, fill forms, and merge documents. Use when working with PDF files or when the user mentions PDFs, forms, or document extraction.
---

# PDF Processing

## Quick start
Use pdfplumber to extract text:

    import pdfplumber
    with pdfplumber.open("file.pdf") as pdf:
        text = pdf.pages[0].extract_text()

## Advanced features
- Form filling: see references/FORMS.md
- API reference: see references/REFERENCE.md
```

## Further reading
- Best-practices guide (full authoring checklist): https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices
- Agent Skills open specification: https://agentskills.io/specification
- Official template + example skills: https://github.com/anthropics/skills

## Related skills
- ../progressive-disclosure — how to keep SKILL.md short and push depth into on-demand files
- ../skill-frontmatter-spec — the exact YAML frontmatter fields and their constraints
