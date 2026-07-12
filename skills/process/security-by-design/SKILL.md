# Skill — security-by-design

**Trigger:** A new system, service, feature, or significant design change is being planned and its security posture must be analyzed *before* implementation — including threat modeling and least-privilege design.

Produces a threat model (answers to the four threat-modeling questions) and a set of proactive controls and least-privilege decisions baked into the design.

## When to use
- Designing anything that handles user data, authentication, money, or external input.
- Adding a trust boundary (new API, integration, multi-tenant feature, file upload).
- Before writing code for an architecturally significant component.

## When NOT to use
- A cosmetic or internal-only change with no new trust boundary and no sensitive data.
- A pure security *review of already-written code* — use `process/review-code-perf-security`.
- Incident response on a live breach (this skill is preventive, not reactive).

## Required context & inputs
- The system/feature design: the C4 Context and Container views if available (from `process/app-planning`).
- The data it handles and the data's sensitivity (PII, secrets, payment, health).
- The trust boundaries: where data crosses from less-trusted to more-trusted zones.
- The org's stack and runtime isolation model (from `.claude/CLAUDE.md`).

## Procedure
1. **Answer Q1 — "What are we working on?"** Document the system in scope: its components, data flows, users, dependencies, assumptions, and — critically — its **trust boundaries** (every point where data or control crosses a privilege level). A data-flow diagram or the C4 Container view is the input here.
2. **Answer Q2 — "What can go wrong?"** Systematically enumerate threats against each element and data flow. Use a structured methodology (STRIDE is the common default: Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege; OWASP is methodology-neutral so PASTA/LINDDUN/attack trees are also valid). Capture misuse cases and design assumptions that, if false, become vulnerabilities.
3. **Answer Q3 — "What are we going to do about it?"** For each credible threat, decide a response: mitigate, eliminate, transfer, or accept. Map mitigations to the **OWASP Top 10 Proactive Controls (2024)**, designing each relevant control into the system from the start:
   - **C1 Implement Access Control** — enforce least privilege; deny by default; check authorization on every request server-side.
   - **C2 Use Cryptography to Protect Data** — protect data in transit and at rest.
   - **C3 Validate all Input & Handle Exceptions** — treat all external input as hostile; fail securely.
   - **C4 Address Security from the Start** — this skill itself.
   - **C5 Secure By Default Configurations.**
   - **C6 Keep your Components Secure** (dependencies/SCA).
   - **C7 Secure Digital Identities** (authentication, session, MFA).
   - **C8 Leverage Browser Security Features.**
   - **C9 Implement Security Logging and Monitoring.**
   - **C10 Stop Server Side Request Forgery.**
4. **Apply least privilege concretely (C1).** For every actor, service account, token, and component, grant the minimum permissions needed and nothing more. Default to deny. Scope credentials to the narrowest resource and lifetime. Honor the runtime's isolation model (e.g. the org's FS jail / per-org runtime root) — do not design around it.
5. **Answer Q4 — "Did we do a good job?"** Review the model for completeness against the data flows, record every decision and accepted risk with its rationale, and define follow-up tests that prove the mitigations work (hand these to `process/testing-before-done`).
6. **Make it continuous.** Threat modeling is applied throughout development at practical granularity — revisit the model when the design changes, a new trust boundary appears, or assumptions from Q1 are invalidated.

## Output format
- A `threat-model.md` in the workspace structured around the four questions:
  - Q1: scope, data-flow/Container diagram, trust boundaries, assumptions.
  - Q2: threat list (per element, with the methodology used, e.g. STRIDE category).
  - Q3: mitigations mapped to Proactive Controls C1-C10, with each threat → response.
  - Q4: residual/accepted risks (with rationale), and the security tests to be written.
- Least-privilege matrix: `Actor/Component | Resource | Permission granted | Justification`.

## Quality & validation rules
- All four questions are explicitly answered; a model missing Q3 or Q4 is incomplete.
- Every trust boundary from Q1 has at least one corresponding threat considered in Q2.
- Every credible threat in Q2 has an explicit response in Q3 (mitigate/eliminate/transfer/accept) — none left undecided.
- Access control (C1) is enforced server-side and defaults to deny; no permission is granted without a justification in the matrix.
- Sensitive data is covered by C2 (crypto in transit and at rest).
- Accepted risks are recorded with rationale, not silently dropped.
- Mitigations produce concrete test cases handed to the testing process.

## Failure handling
- **A threat has no feasible mitigation** → record it as an accepted risk with explicit rationale and sign-off, and add monitoring (C9) to detect exploitation.
- **Trust boundaries are unclear** → stop and clarify the data flows with the team; you cannot model threats over an undefined boundary.
- **Design conflicts with least privilege** → treat that as a finding; redesign to scope down permissions rather than widening them for convenience.
- **Model goes stale after a design change** → re-run Q1-Q4 for the changed area; an outdated threat model is a false sense of security.

## Related
- Sources:
  - Threat modeling (four questions, STRIDE) — https://owasp.org/www-project-threat-modeling/
  - Proactive Controls (C1-C10, 2024) — https://owasp.org/www-project-proactive-controls/
- Skills: `process/app-planning`, `process/testing-before-done`, `process/review-code-perf-security`
