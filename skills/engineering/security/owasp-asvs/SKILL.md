---
name: owasp-asvs
description: OWASP Application Security Verification Standard 5.0 — testable security requirements organized by chapter and verification level; consult to define or verify appsec requirements.
domain: engineering
category: security
tags: [owasp, asvs, security-requirements, verification, appsec]
official_sources:
  - https://owasp.org/www-project-application-security-verification-standard/
  - https://github.com/OWASP/ASVS
verified: 2026-06-16
---

# OWASP ASVS

## Overview
The Application Security Verification Standard (ASVS) is an OWASP flagship project that provides a comprehensive, testable list of application security requirements. Unlike the awareness-oriented Top 10, ASVS is meant to be used as a measurable standard: a basis for security requirements during design, a checklist for testing/verification, and a procurement contract baseline. Read this when you need concrete, citable requirements for what "secure enough" means at a chosen rigor level.

## Official sources
- Docs / project: https://owasp.org/www-project-application-security-verification-standard/
- Repo: https://github.com/OWASP/ASVS
- License: Creative Commons Attribution-ShareAlike 4.0 (CC BY-SA 4.0)
- Current stable: ASVS 5.0.0 (released May 2025 at Global AppSec EU Barcelona)

## Core concepts
- **Verification levels (L1, L2, L3).** Requirements are tiered by increasing rigor. In 5.0, L1 is scoped to first-layer / foundational defenses (a deliberately smaller set than 4.x to lower the adoption barrier); L2 raises the bar (e.g., requiring multi-factor authentication); L3 is the most advanced (e.g., hardware-backed, attested authentication). Choose the level by the application's risk and data sensitivity.
- **Requirement identifiers.** Requirements use a `<chapter>.<section>.<requirement>` numbering scheme and should be cited with a version prefix, e.g. `v5.0.0-1.2.5`, so references stay unambiguous across editions.
- **Chapter structure (V1-V17).** ASVS 5.0 organizes requirements into chapters such as Encoding and Sanitization, Validation and Business Logic, Web Frontend Security, API and Web Service, File Handling, Authentication, Session Management, Authorization, Self-contained Tokens, OAuth and OIDC, Cryptography, Secure Communication, Configuration, Data Protection, Secure Coding and Architecture, Security Logging and Error Handling, and WebRTC.
- **Standard, not a tool.** ASVS defines *what* to verify; it does not prescribe a specific scanner or test method. Teams map each requirement to manual review, automated tests, or both.

## Best practices
- Pick a target level up front based on risk (data sensitivity, exposure, regulatory needs) and treat it as the verification floor for the whole application.
- Use ASVS requirement IDs (with version prefix) directly in tickets, test cases, and acceptance criteria so coverage is auditable.
- Integrate the relevant chapter requirements into design reviews early rather than testing for them only at the end.

## Common pitfalls
- Treating all of L1+L2+L3 as mandatory → each level is cumulative and chosen by risk; applying L3 everywhere wastes effort and slows delivery.
- Citing version 4.0.3 requirement numbers in a 5.0 program → the structure and level scoping changed substantially in 5.0; always confirm the IDs against the version you target.
- Using ASVS as awareness reading → it is a verification standard; pair it with the Top 10 for prioritization and with cheat sheets for implementation guidance.

## Examples
```text
# Referencing an ASVS requirement in a security acceptance criterion:
Given a login endpoint, it MUST satisfy ASVS v5.0.0 (Authentication, chapter V6)
at the target verification level (e.g., L2 requires multi-factor authentication).
```

## Further reading
- Downloads (PDF / Word / CSV) and bleeding-edge master branch: linked from the project page above
- OWASP Top 10 for risk prioritization: ../owasp-top-10

## Related skills
- ../owasp-top-10 — awareness/prioritization input that ASVS makes testable
- ../appsec-fundamentals — proactive controls aligned to ASVS chapters
- ../secure-auth-sessions — implementation detail for ASVS V6 and V7
