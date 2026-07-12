---
name: release-journal-single-page-playbook
description: |
  Use this skill when Codex needs release notes one-page HTML with highlights, Added, Fixed, Breaking changes, Known issues, and Upgrade note. Writes explicit "None" style sections whenever the user does not provide details. Recast from the original release-notes-one-pager/SKILL.md material as the release-journal-single-page-playbook procedure.
---

# Release Journal Single Page Playbook

## Role

Use this skill when Codex needs release notes one-page HTML with highlights, Added, Fixed, Breaking changes, Known issues, and Upgrade note. Writes explicit "None" style sections whenever the user does not provide details. Recast from the original release-notes-one-pager/SKILL.md material as the release-journal-single-page-playbook procedure.

## Source Trace

- Original Markdown: `release-notes-one-pager/SKILL.md`
- Reformulated skill name: `release-journal-single-page-playbook`

## Operating Guidance

Follow the rewritten material below as the working procedure. Keep code blocks, commands, file paths, URLs, dimensions, and API names exact when applying the skill.

Produce a single-page release notes document in HTML.

## Resource map

```
release-notes-one-pager/
├── SKILL.md                    ← this file
├── example.html                ← quality bar and style reference
├── assets/
│   └── template.html           ← local seed file to copy to project index.html
└── references/
    ├── checklist.md            ← P0 / P1 / P2 gates
    └── layouts.md              ← local section skeletons
```

Avoid write CSS from scratch unless the user explicitly asks for a bespoke structure.

## Workflow

### Step 0 — Pre-flight

1. Read `assets/template.html`.
2. Read `references/layouts.md`.
3. Read active `DESIGN.md` and map it to the six `:root` variables.

### Step 1 — Start from the shared seed

Copy `assets/template.html` to project `index.html`.

Update:
- `<title>`
- topnav logo text
- topnav link labels (destinations are pre-wired to `#added`, `#fixed`, `#upgrade-note`)
- topnav CTA label and `href` destination, or omit the topnav CTA entirely if no real destination exists
- ensure the topnav link targets exist by adding matching section `id` attributes

### Step 2 — Assemble release-note structure

Inside `<main id="content">`, compose this section order:

1. Hero (Layout 1 or 2): version, date, one-sentence summary.
2. Added (use Layout 7 log-list; section root needs to include `id="added"`).
3. Fixed (use Layout 7 log-list; section root needs to include `id="fixed"`).
4. Breaking changes (use Layout 7 log-list, or one row explicitly saying "None"; section root needs to include `id="breaking-changes"`).
5. Known issues (Layout 7 or card list; section root needs to include `id="known-issues"`).
6. Upgrade note (short steps list or explicit no-action statement; section root needs to include `id="upgrade-note"`).
7. Closing CTA strip (Layout 6).

For every CTA in the emitted HTML (topnav, hero, closing strip), replace both the visible label and the `href` destination with real, safe values. If no real destination is available, omit the CTA entirely—avoid use a placeholder such as `href="#"`, a misleading page-anchor, or `REPLACE_WITH_REAL_URL`. Hero CTAs are optional; only add them when real destinations exist.

### Step 3 — Honesty rules for missing details

If the user does not provide details, do not invent them. Write explicit placeholders:

- Summary: `No summary provided.`
- Added: `No additions provided`
- Fixed: `No fixes provided`
- Breaking changes: `None`
- Known issues: `None reported`
- Upgrade note: `No upgrade actions required based on provided information`

If release version or date is missing, use `—` and label the field rather than guessing.

### Step 4 — Self-check

Execute `references/checklist.md`. Every P0 needs to pass.

### Step 5 — Emit artifact

Wrap output as:

```
<artifact identifier="release-notes-one-pager" type="text/html" title="Release Notes">
<!doctype html>
<html>...</html>
</artifact>
```

One sentence before the artifact. Nothing after `</artifact>`.
