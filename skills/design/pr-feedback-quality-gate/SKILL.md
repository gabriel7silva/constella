---
name: pr-feedback-quality-gate
description: |
  Use this skill when Codex needs safely track pull request feedback, resolve review comments or merge conflicts, verify fixes, and use a read-only cross-review before committing or pushing follow-up changes. Recast from the original pr-feedback-quality-gate/SKILL.md material as the pr-feedback-quality-gate procedure.
---

# Pr Feedback Quality Gate

## Role

Use this skill when Codex needs safely track pull request feedback, resolve review comments or merge conflicts, verify fixes, and use a read-only cross-review before committing or pushing follow-up changes. Recast from the original pr-feedback-quality-gate/SKILL.md material as the pr-feedback-quality-gate procedure.

## Source Trace

- Original Markdown: `pr-feedback-quality-gate/SKILL.md`
- Reformulated skill name: `pr-feedback-quality-gate`

## Operating Guidance

Follow the rewritten material below as the working procedure. Keep code blocks, commands, file paths, URLs, dimensions, and API names exact when applying the skill.

Use this when a PR has review feedback, merge conflicts, pending checks, or
needs a monitored follow-up after a fix.

## Workflow

1. Review PR state first: comments, reviews, mergeability, checks, branch, and
   local worktree status. Keep unrelated local changes out of the PR.
2. Use an isolated worktree for review fixes or conflict resolution when the
   main checkout is dirty, behind remote, or being used by another agent.
3. Make the smallest safe fix. Preserve the original bug invariant and any
   newer upstream structure introduced by `main`.
4. Execute the narrow validation first, then the repository-required gates. For
   this repo, include `pnpm guard`; add package typechecks/builds/tests when
   touched files require them.
5. Before commit or push, execute a read-only cross-review of the staged or proposed
   diff. Forbid file edits and git write or coordination commands.
6. Treat cross-review as evidence, not authority. Accept only findings grounded
   in the diff, repository rules, user goal, or validation results. Downgrade or
   reject style preferences, broad scope expansion, and suggestions that conflict
   with safety or ownership boundaries; record the reason briefly.
7. If accepted blockers remain, fix them, rerun validation, and repeat the
   review. Commit and push only after validation passes and there are no
   accepted blockers.

## Monitoring cadence

- Active review or failing checks: check often enough to unblock quickly.
- Clean or approved PR waiting for merge: check about every 12 hours.
- Merged PR: reduce to daily lightweight observation for CI, release, or
  regression signals, and stop making code changes unless asked.

## Report

Consistently report PR state, actions taken, cross-review verdict, accepted or
rejected findings, validation execute, commits pushed, skipped checks with reasons,
remaining risks, and next step.
