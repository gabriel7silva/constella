# Contributing to the `skills/` knowledge base

This directory is a **curated, research-backed reference library** for AI agents working on Constella. It is **not** the runtime `.claude/skills/` directory (those are per-org executable procedures indexed by `src/server/sync.ts`). Files here are knowledge agents *consult*.

## Non-negotiable trust rules

1. **Official sources only.** Every factual claim, URL, and install command must come from an official origin: the project's own docs site, its official GitHub repo/org, or the canonical standards body (OWASP, W3C, IETF, MDN, the framework's own site). **Reject** blogs, Medium, marketing reposts, content farms, and Stack Overflow as *sources* (they may be linked under "Further reading" only if clearly labeled community).
2. **Never invent.** If you cannot verify a fact against an official source, omit it. A short, correct skill beats a long, plausible-but-wrong one. No invented install flags, version numbers, API names, or URLs.
3. **Cite & summarize, never copy.** Paraphrase in your own words and link the source. Do not paste large passages from Codrops, component.gallery, docs, etc. Respect licensing.
4. **Install commands verbatim.** For stack/language skills, copy the install command **exactly** as it appears on the official install/getting-started page, and cite that page URL.
5. **Stamp `verified:`** with the date the URLs/claims were last checked (`YYYY-MM-DD`).

## Slug & path conventions
- Lowercase, hyphenated, ASCII, Windows-safe: `fly-io`, `aspnet-core`, `csharp`, `cpp`, `spring-boot`.
- One folder per skill. Knowledge skills live at `<group>/<slug>/SKILL.md`. Process skills live at `process/<slug>/SKILL.md` but use Format B below.
- A skill folder may add `reference.md`, `cheatsheet.md`, or `examples/` for depth — keep `SKILL.md` short and link to them (progressive disclosure).

## Minimum bar (knowledge skills) — below bar = flagged, not shipped
Frontmatter + Official sources + Install/setup (stacks & languages) + ≥3 Core concepts + ≥3 Best practices + ≥2 Common pitfalls.

---

## Format A — Knowledge `SKILL.md`
Used by: `meta/`, `engineering/`, `design/`, `languages/`, `stacks/`, `references/`.

```markdown
---
name: <slug>
description: <one sentence, ≤160 chars — what it covers + when to consult it>
domain: <engineering|design|language|stack|reference|meta>
category: <e.g. backend, database, security>   # optional sub-group
tags: [<keyword>, <keyword>]
official_sources:
  - <official-docs-url>
  - <official-repo-url>
verified: <YYYY-MM-DD>
---

# <Human Title>

## Overview
2–4 sentences: what it is, the problem it solves, when to read this.

## Official sources
- Docs: <url>
- Repo: <url>
- Install / download: <url>

## Install / setup            <!-- stack & language skills only -->
```bash
<exact command copied from the official install page>
```

## Core concepts
- <3–7 ideas needed to use this correctly>

## Best practices
- <official/widely-endorsed practice — link a source for any non-obvious claim>

## Common pitfalls
- <mistake> → <correct approach>

## Examples
```<lang>
<minimal correct snippet; deeper examples go in reference.md>
```

## Further reading
- reference.md — deep dive (loaded only when needed)
- <deeper official guide URL>

## Related skills
- ../<sibling-slug> — why it relates
```

---

## Format B — Runtime `# Skill —` procedure
Used by: `process/` (executable, matches the existing `.claude/skills/` convention so it could be promoted into a workspace later).

```markdown
# Skill — <slug>

**Trigger:** <when this procedure applies>

<one-line summary of what the agent produces>

## When to use
<conditions>

## When NOT to use
- <when a more specific skill applies, or the trigger is absent>

## Required context & inputs
- <what to read/gather first>

## Procedure
1. <step>
2. <step>
3. <step>

## Output format
- <the artifact produced; paths relative to the workspace>

## Quality & validation rules
- <how to know each step succeeded; the definition of done>

## Failure handling
- <what to do when a step fails; where to record it>

## Related
- Sources: <official method/standard URLs — e.g. scrumguides.org, adr.github.io, owasp.org>
- Skills: <sibling process skills>
```

---

## How an agent uses this library
1. Identify the task domain and the org's declared stack (from `.claude/CLAUDE.md`).
2. Open the matching `SKILL.md` (e.g. `orm: Drizzle` → `stacks/orm/drizzle/SKILL.md`).
3. Follow `Further reading` / `reference.md` only if you need depth.
4. Trust the `Official sources`; if `verified:` is stale, re-check before relying on version-specific details.
