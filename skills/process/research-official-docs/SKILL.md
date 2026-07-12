---
name: research-official-docs
description: Research trusted documentation on the web (WebSearch/WebFetch) and capture what you learn into the knowledge base — use when you need authoritative, current API/library/framework/security details before deciding or building.
domain: process
category: research
tags: [research, web, documentation, official-sources, rag, knowledge]
official_sources:
  - https://developer.mozilla.org/
  - https://web.dev/
verified: 2026-06-21
---

# Research official documentation

When you are unsure about an API, a framework's idiom, a config, a version difference, or a security/best
practice for this project's stack — **look it up against trusted sources instead of guessing**, then record
what you learned so the whole team reuses it. You have the `WebSearch` and `WebFetch` tools (when web
research is enabled for this workspace).

## When to use
- You need exact, current details (an API signature, a config option, a breaking change, a CVE/mitigation).
- A decision or implementation hinges on how a library/framework actually works in THIS stack's version.
- The Knowledge section didn't already answer it (don't re-research what the KB already holds).

Don't over-research: only when it changes a real decision or prevents a wrong implementation.

## Source priority (most to least trusted)
1. **Official documentation** for the exact library/framework + version (e.g. the framework's own docs site).
2. **Official repositories** — the project's own README, examples, CHANGELOG, release notes.
3. **Recognized technical references** — MDN, web.dev, OWASP, language/standard specs.
4. **Community best practices** from reputable maintainers/foundations.
5. **Trusted examples** — official samples, well-known reference implementations.
6. **Official downloads / registries** (npm, PyPI, the vendor's releases) for versions + integrity.
7. **Up-to-date references** — prefer the newest that matches the project's pinned versions.

Avoid: random blogs, outdated Q&A, content farms, AI-generated SEO pages, anything unversioned or that
contradicts the official source.

## How
1. `WebSearch` to find the **official** page for the exact topic + the project's version.
2. `WebFetch` the official page and read the relevant part. Prefer the version the project pins.
3. **Validate**: for anything correctness- or security-critical, confirm against the official source — never
   trust a single secondary source. If sources disagree, the official one wins; note the discrepancy.

## Capture what you learned (so it lands in the RAG and is reused)
After you confirm something useful, record it durably so the next agent doesn't re-research it. Emit:

`[[REMEMBER type=doc: <concise fact or snippet> — applies to <where in this project> (source: <official url>)]]`

Always include the **source URL** and **how it applies to this project**. Keep it factual and concise. The
system stores it in the knowledge base with its source + context, and retrieval surfaces it to the team on
later tasks — so the system's intelligence grows as it researches, validates and builds.

## If you don't have the WebFetch tool (local model)
Ask the system to fetch + cache an official page for you: emit `[[RESEARCH: <official-doc url>]]`. The server
fetches it (only **allowlisted official-doc domains** — your stack's `official_sources` + trusted references
like MDN/web.dev/OWASP) and stores it in the knowledge base, so it's available to the team (and to you on the
next step) via retrieval. Prefer the exact official URL for your stack and version.
