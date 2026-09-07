# Skill — review-code-perf-security

**Trigger:** A change/PR is ready for review and needs a structured assessment covering correctness/design, performance, and security before it merges.

Produces a review that decides whether the change improves overall code health, with findings categorized and each tied to an actionable fix.

## When to use
- Reviewing a teammate's or agent's PR before merge.
- A change touches performance-sensitive paths or security-relevant code (auth, input handling, data access).
- You are the second pair of eyes required by the team's "someone other than the author" rule.

## When NOT to use
- *Designing* security up front — that's `process/security-by-design` (pre-implementation), this is review (post-implementation).
- Authoring tests — use `process/testing-before-done`; here you only check that adequate tests exist.
- Trivial auto-formatted changes with no logic (let tooling handle style).

## Required context & inputs
- The diff/CL and its description (what it does and why).
- The acceptance criteria the change claims to satisfy.
- The threat model and test plan for the area, if they exist (`process/security-by-design`, `process/testing-before-done`).
- The project's style guide and the org's stack conventions (from `.claude/CLAUDE.md`).

## Procedure
1. **Apply the standard of review (Google).** A reviewer is "someone other than the author" examining the code. The bar: **approve once the change definitely improves the overall code health of the system, even if it isn't perfect.** Do not block a healthy improvement in pursuit of perfection; do not approve something that degrades code health.
2. **Review across the eight dimensions (Google "What to look for").** Walk the diff against each:
   - **Design** — does the change belong here and integrate well with the system?
   - **Functionality** — does it do what the author intends, and is that good for users/callers? Consider edge cases and concurrency.
   - **Complexity** — is it as simple as possible? Reject over-engineering and code harder to read than necessary.
   - **Tests** — are there correct, well-designed automated tests at the right level (cross-check `process/testing-before-done`)?
   - **Naming** — are names clear and precise?
   - **Comments** — do comments explain *why*, and are they necessary and clear?
   - **Style** — does it follow the project's style guide? (Style nits are non-blocking; prefix them `Nit:`.)
   - **Documentation** — are relevant docs updated/added/removed to match?
3. **Review performance explicitly.** Inspect hot paths and data access: algorithmic complexity, N+1 queries, unnecessary allocations/copies, missing pagination or indexes, blocking I/O on critical paths, and unbounded growth. Flag concrete regressions, not speculative micro-optimizations — require evidence (a benchmark or a clear complexity argument) before demanding a change.
4. **Review security (OWASP Code Review Guide).** Manual security review still has a prominent place in the SDLC — scanners alone are insufficient. Check the high-risk areas: input validation (treat all external input as hostile), authentication and session handling, authorization/access control on every server-side entry point (least privilege, deny by default), output encoding, error/exception handling that fails securely and doesn't leak internals, secrets handling, and dependency safety. Map findings to the threat model where one exists.
5. **Categorize and phrase every finding.** Tag each as **Blocking** (must fix before merge — correctness, security, data loss, perf regression) or **Non-blocking** (`Nit:` / `Optional:` / `FYI:`). State the location, the problem, and a concrete fix. Be courteous and objective — comment on the code, not the author.
6. **Decide.** Approve if the change improves code health and has no blocking findings; request changes if blocking findings remain; if blocked on a judgment call, escalate per team norms rather than stalling. Respond promptly so you don't become the bottleneck.

## Output format
- A review (PR comments or a `review.md`) containing:
  - A verdict: approve / request changes, with the one-line code-health justification.
  - Findings grouped by category (Design/Functionality/Complexity/Tests/Naming/Comments/Style/Docs, plus Performance and Security), each as `Location — problem — fix — Blocking|Nit|Optional`.
- Inline comments anchored to the relevant diff lines where the platform supports it.

## Quality & validation rules
- The reviewer is not the author of the code under review.
- The verdict is justified by overall code-health improvement, not perfection.
- Every dimension in step 2 was considered (even if "no issues").
- Performance findings are concrete (complexity argument or benchmark), not speculative.
- Security review covered input validation, authn, authz/least-privilege, error handling, and dependencies; findings map to the threat model where present.
- Each finding has a location, a problem, a fix, and a Blocking/Non-blocking tag; pure style is marked `Nit:` and never blocks alone.
- Tests were checked for existence and correct level, not assumed.

## Failure handling
- **No tests in the change** → blocking finding; request tests at the appropriate pyramid level (per `process/testing-before-done`).
- **Security concern without a threat model** → flag it and recommend running `process/security-by-design` for that area before merge.
- **Author disagrees on a judgment call** → discuss with rationale; if unresolved, escalate per team norms rather than rubber-stamping or stonewalling.
- **Diff too large to review well** → request it be split into smaller, reviewable CLs; an unreviewable change can't be approved responsibly.
- **Perf concern is speculative** → ask for a benchmark rather than blocking on a guess.

## Related
- Sources:
  - Google code review (standard + what to look for) — https://google.github.io/eng-practices/review/
  - OWASP Code Review Guide — https://owasp.org/www-project-code-review-guide/
- Skills: `process/security-by-design`, `process/testing-before-done`, `process/adr-technical-decisions`
