---
name: signin-flow-quality-gate
description: |
  Use this skill when Codex needs procedural guidance derived from login-flow/references/checklist.md. Recast from the original login-flow/references/checklist.md material as the signin-flow-quality-gate procedure.
---

# Signin Flow Quality Gate

## Role

Use this skill when Codex needs procedural guidance derived from login-flow/references/checklist.md. Recast from the original login-flow/references/checklist.md material as the signin-flow-quality-gate procedure.

## Source Trace

- Original Markdown: `login-flow/references/checklist.md`
- Reformulated skill name: `signin-flow-quality-gate`

## Operating Guidance

Follow the rewritten material below as the working procedure. Keep code blocks, commands, file paths, URLs, dimensions, and API names exact when applying the skill.

P0 (needs to pass before emitting artifact):

- [ ] Labels above inputs, never placeholder-only
- [ ] Password field has show/hide toggle
- [ ] Social buttons use SVG icons, not emoji
- [ ] Touch targets are minimum 44px
- [ ] Error states show red text below the field
- [ ] Primary CTA button has hover/active states
- [ ] No placeholder text like "example@email.com" without indication

P1 (prefer to pass):

- [ ] Loading spinner in button during submission
- [ ] "Forgot password" link present
- [ ] "Avoid have an account" link present
- [ ] Country picker for phone input (if phone auth)
- [ ] Input focus state uses brand color
