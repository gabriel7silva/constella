---
name: git-workflow
description: Day-to-day Git collaboration — branching, focused commits, pull requests, and Conventional Commits message format.
domain: engineering
category: practices
tags: [git, version-control, branching, commits, conventional-commits, pull-request]
official_sources:
  - https://git-scm.com/docs
  - https://www.conventionalcommits.org/en/v1.0.0/
verified: 2026-06-16
---

# Git Workflow

## Overview
A Git workflow is the set of conventions a team uses for branching, committing, and integrating changes so history stays readable and changes stay reviewable. Consult this when deciding how to branch, how to structure commits, or how to format commit messages. Git's own reference manual defines the commands; the Conventional Commits spec defines a popular structured message format.

## Official sources
- Docs (Git reference manual): https://git-scm.com/docs
- Pro Git book: https://git-scm.com/book
- Conventional Commits spec: https://www.conventionalcommits.org/en/v1.0.0/

## Core concepts
- **Branches isolate work.** `git branch` / `git switch` create lightweight lines of development; do feature work on a branch and integrate via `git merge` or `git rebase` (both documented in the Git reference).
- **Commits are the unit of history.** `git add` stages changes and `git commit` records them; a good commit captures one logical change with a message explaining what and why.
- **Sharing.** `git push` publishes commits to a remote and `git pull` fetches and integrates remote changes; pull requests wrap a branch for review before integration.
- **Conventional Commits structure.** The spec defines `<type>[optional scope]: <description>`, then an optional body and optional footer(s).
- **Types & semver mapping.** `feat` (a new feature → MINOR) and `fix` (a bug fix → PATCH) are the core types; `docs`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `style` are also recommended.
- **Breaking changes.** Indicated either by a `!` after the type/scope (`feat!:`) or a `BREAKING CHANGE:` footer; both signal a MAJOR version bump.

## Best practices
- **Keep commits small and focused.** One logical change per commit makes review, revert, and `git bisect` tractable (separate refactoring from behavior change — see refactoring).
- **Write meaningful messages.** Use an imperative description; for non-trivial changes, explain *why* in the body. Conventional Commits adds machine-readable type/scope so tools can generate changelogs and version bumps.
- **Branch per change, integrate via review.** Open a pull request so a reviewer examines the change before it lands (see code-review-practices).
- **Mark breaking changes explicitly.** Use `!` or a `BREAKING CHANGE:` footer so consumers and release tooling correctly bump the major version.

## Common pitfalls
- **Vague messages ("fix stuff", "wip")** → write a clear type/description and a body explaining why; future readers and changelog tooling depend on it.
- **One huge commit mixing many concerns** → split into focused commits so each can be reviewed and reverted independently.
- **Hiding a breaking change in a `feat` or `fix`** → use `feat!:`/`fix!:` or a `BREAKING CHANGE:` footer so it triggers a MAJOR bump rather than surprising consumers.

## Examples
```text
feat(auth): add password reset endpoint

Sends a single-use token by email and expires it after 15 minutes.

Refs: #482

# Breaking change variants:
feat(api)!: drop deprecated v1 user fields
# or, via footer:
BREAKING CHANGE: the `username` field is removed from the user payload
```

## Further reading
- Pro Git — Branching: https://git-scm.com/book/en/v2/Git-Branching-Branches-in-a-Nutshell
- Conventional Commits spec (full): https://www.conventionalcommits.org/en/v1.0.0/

## Related skills
- ../code-review-practices — pull requests and reviewable change hygiene
- ../refactoring — keeping structure-only commits separate from behavior commits
