---
name: readme-generation
description: Generate a beautiful, non-generic project README — capsule-render banner, shields badges derived from the real stack, emoji section headers, a tech-stack table, ASCII architecture, getting-started, configuration, commands, roadmap, contributing and license. Consult whenever creating or rewriting a project README.
domain: process
category: process
tags:
  - readme
  - documentation
  - shields
  - capsule-render
  - markdown
  - open-source
official_sources:
  - https://shields.io/
  - https://github.com/Ileriayo/markdown-badges
  - https://github.com/othneildrew/Best-README-Template
verified: 2026-06-16
---

## Overview

A README is the front door of a project. It must be **specific to THIS project** — never a generic
"Scaffolded by X" stub. This skill is the standard for authoring (or rewriting) a README that is
beautiful, complete, and immediately useful to a newcomer.

## When to use

- A project was just scaffolded and its `README.md` is generic or thin.
- The stack, mission, or scope changed and the README is now stale.
- The operator asks to "improve the README" or "make the docs look professional".

## Quality bar (a great README has ALL of these)

1. **Banner** — a `capsule-render` waving header with the project name + one-line mission, colored
   to the project's own palette (not a default).
2. **Badge row** — `shields.io` badges for each defining stack item (language, runtime, framework,
   database, …) using the real brand logo + color, plus license + a "built with" badge.
3. **Table of Contents** — anchor links to every section.
4. **Emoji section headers** (`## 🎯 About`, `## 🧩 Tech Stack`, …) — scannable and consistent.
5. **About** — the mission as a blockquote + the concrete objective; what the project does and why.
6. **Tech Stack table** — Layer → Technology, ideally with each tech's devicon.
7. **Architecture** — a compact ASCII diagram filled with the REAL stack (client → server → data).
8. **Getting Started** — real, copy-pasteable install + run commands for the actual runtime
   (npm/bun/deno/pip/cargo/go), prerequisites, and the `.env` setup step.
9. **Configuration** — a table of environment variables (name · description · required) + a note
   that secrets never get hard-coded.
10. **Commands** — dev / build / test / lint for the real toolchain.
11. **Project Structure** — a tree of the top-level directories with one-line purposes.
12. **Roadmap** — a checklist (done/now/next) — optionally a progress badge.
13. **Contributing** — branch/PR/test expectations, link to code standards.
14. **License** — name + link, matched by a badge.
15. **Footer** — a closing `capsule-render` wave or a small credit line.

## Procedure

1. **Read the project facts.** Get the company/mission/objective and the chosen stack from
   `.claude/CLAUDE.md` (and `workspace.stack`). Never invent a stack — use what's configured.
2. **Pick a palette** from the project identity (deterministic from the name) for the banner +
   accents, so the README has its own look.
3. **Derive badges** from each stack value (see the Badge cookbook). One badge per defining pick.
4. **Write each section** in the order of the Quality bar. Fill the architecture diagram and the
   commands from the actual runtime — no placeholders, no lorem ipsum.
5. **Verify**: every TOC link resolves to a real `## ` anchor; every badge/logo slug is valid;
   relative links (`./DOCS`, `./LICENSE`) point at files that exist; no empty sections remain.
6. **Write** to `README.md`. Keep it deterministic and re-renderable.

## Badge cookbook

- **Shields static badge:**
  `https://img.shields.io/badge/<LABEL>-<HEXCOLOR>?style=for-the-badge&logo=<simple-icons-slug>&logoColor=white`
  - Escape the label: `-` → `--`, `_` → `__`, space → `_`.
  - `<simple-icons-slug>` comes from https://simpleicons.org (e.g. `typescript`, `nodedotjs`,
    `postgresql`, `react`, `tailwindcss`, `docker`). If unknown, omit `&logo=`.
- **Capsule-render banner:**
  `https://capsule-render.vercel.app/api?type=waving&height=200&color=0:<HEX1>,100:<HEX2>&text=<URL-ENCODED-NAME>&fontColor=ffffff&fontSize=64&desc=<URL-ENCODED-TAGLINE>&descSize=16&descColor=ffffff`
- **Devicon (for the stack table):**
  `https://cdn.jsdelivr.net/gh/devicons/devicon/icons/<slug>/<slug>-original.svg` — embed via
  `<img src="…" width="18" />`. Fall back to plain text if the slug doesn't exist.

## Anti-patterns (never do)

- A generic 3-line README (`# Name\n\nMission\n\nScaffolded by …`).
- Lorem ipsum, TODO placeholders, or empty sections.
- Badges for technologies not actually in the stack, or broken logo slugs (renders an ugly grey box).
- Hard-coded secrets, internal URLs, or real tokens anywhere in the README.
- Inventing install commands that don't match the runtime.

## Related

- [[clean-code]] · [[git-workflow]] · [[authoring-agent-skills]]
