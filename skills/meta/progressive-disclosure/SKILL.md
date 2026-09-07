---
name: progressive-disclosure
description: Keep SKILL.md short and push depth into on-demand reference files so agents load only what each task needs. Consult when a skill grows large.
domain: meta
category: meta
tags: [progressive-disclosure, agent-skills, context-window, reference-files, token-budget]
official_sources:
  - https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices
  - https://github.com/anthropics/skills
verified: 2026-06-16
---

# Progressive Disclosure

## Overview
Progressive disclosure is the design principle behind Agent Skills: an agent loads information in stages as a task calls for it, rather than consuming the whole skill up front. A short `SKILL.md` acts like a table of contents that points to deeper reference files, scripts, and assets, which are read or executed only on demand. Read this when a skill is getting long, its body exceeds the recommended budget, or you want bundled reference material to stay out of context until needed.

## Official sources
- Docs (best practices, "Progressive disclosure patterns"): https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices
- Docs (overview, "How Skills work"): https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview
- Open spec ("Progressive disclosure"): https://agentskills.io/specification
- Repo (official examples): https://github.com/anthropics/skills

## Core concepts
- **Three loading levels.** Level 1: metadata (`name` + `description`, ~100 tokens) loaded at startup for every skill. Level 2: the `SKILL.md` body, loaded when the skill triggers. Level 3: bundled files in `scripts/`, `references/`, `assets/`, loaded only when actually accessed.
- **The context window is a shared public good.** Once `SKILL.md` is loaded, every token competes with conversation history and other skills' metadata — conciseness still matters even though bundled files are free until read (best-practices, "Concise is key").
- **Bundled content has no context penalty until used.** A skill can ship comprehensive API docs, large datasets, or many examples; files consume zero tokens until the agent reads them (overview, "Level 3").
- **Scripts execute without entering context.** Running `validate.py` via bash brings only its output into context, not the source — cheaper and more reliable than regenerating equivalent code.
- **`SKILL.md` is a navigation hub.** Treat it like an onboarding guide's table of contents that links to the right detailed file for each branch of the task.

## Best practices
- Keep the `SKILL.md` body under 500 lines; split content into separate files as you approach the limit (best-practices, "Token budgets").
- Keep file references one level deep from `SKILL.md` so the agent reads complete files instead of partial `head -100` previews (best-practices, "Avoid deeply nested references").
- Organize reference files by domain (`reference/finance.md`, `reference/sales.md`) so a query about one domain never pulls in unrelated context (best-practices, "Pattern 2: Domain-specific organization").
- Add a table of contents to any reference file longer than ~100 lines so the agent can see its full scope even when previewing (best-practices, "Structure longer reference files").
- Use forward slashes in all paths so references resolve across platforms (best-practices, "Anti-patterns to avoid").

## Common pitfalls
- Cramming every detail into `SKILL.md` → move advanced/edge-case material into linked reference files that load only when relevant.
- Deeply nested reference chains (`SKILL.md` → `advanced.md` → `details.md`) → the agent may read referenced-from-referenced files only partially; keep all links one level deep from `SKILL.md`.
- Over-explaining things the agent already knows → trim it; padding `SKILL.md` raises token cost without adding signal (best-practices, "Default assumption: Claude is already very smart").

## Examples
```markdown
# BigQuery Data Analysis

## Available datasets
- Finance: revenue, ARR, billing — see reference/finance.md
- Sales: opportunities, pipeline — see reference/sales.md
- Product: API usage, adoption — see reference/product.md

## Quick search
Find metrics with grep:

    grep -i "revenue" reference/finance.md
```
The body stays tiny; `reference/finance.md` is read only when a query is about finance, leaving the other reference files at zero token cost.

## Further reading
- Overview, "Three types of Skill content, three levels of loading": https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview
- Best-practices authoring checklist: https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices

## Related skills
- ../authoring-agent-skills — the overall skill folder + SKILL.md format
- ../skill-frontmatter-spec — the metadata fields loaded at Level 1
