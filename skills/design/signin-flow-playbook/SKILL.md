---
name: signin-flow-playbook
description: |
  Use this skill when Codex needs mobile login and authentication flow screens. Recast from the original login-flow/SKILL.md material as the signin-flow-playbook procedure.
---

# Signin Flow Playbook

## Role

Use this skill when Codex needs mobile login and authentication flow screens. Recast from the original login-flow/SKILL.md material as the signin-flow-playbook procedure.

## Source Trace

- Original Markdown: `login-flow/SKILL.md`
- Reformulated skill name: `signin-flow-playbook`

## Operating Guidance

Follow the rewritten material below as the working procedure. Keep code blocks, commands, file paths, URLs, dimensions, and API names exact when applying the skill.

A skill for generating mobile-first login and authentication screens. Use this when the user wants a sign-in experience for a mobile app, including phone + SMS verification, password-based login, and social SSO options.

## Workflow

1. **Read reference files first** (see below)
2. **Clarify auth method**: phone/SMS, password, or social SSO
3. **Validation criteria gate** — verify P0 items before emitting `<artifact>`
4. **Assemble the HTML prototype** with proper states (default, loading, error)
5. **Wrap in `<artifact>` tag** referencing the output file

## Side Files

- `references/checklist.md` — P0/P1 acceptance criteria

## Output

A single standalone HTML file implementing the login screen with:
- Labels above inputs (never placeholder-only)
- Password field with show/hide toggle
- Social SSO buttons with SVG icons
- Error states below fields
- Loading spinner in primary CTA
- Touch targets minimum 44px

## Mobile-First Constraints

- Viewport: 375px wide (iPhone standard)
- No horizontal scroll
- Safe area insets for notched devices
- Input keyboards: `tel` for phone, `password` for password fields
