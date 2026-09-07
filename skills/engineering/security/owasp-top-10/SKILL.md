---
name: owasp-top-10
description: The OWASP Top 10 web application security risks (2025 edition) and how to mitigate them; consult when threat-modeling or hardening web apps.
domain: engineering
category: security
tags: [owasp, web-security, vulnerabilities, threat-modeling, appsec]
official_sources:
  - https://owasp.org/Top10/
  - https://github.com/OWASP/Top10
verified: 2026-06-16
---

# OWASP Top 10

## Overview
The OWASP Top 10 is the most widely referenced awareness document for web application security, ranking the most critical risks based on contributed data and a community survey. Read this when you need a shared vocabulary for the highest-impact classes of web vulnerabilities, when threat-modeling a feature, or when prioritizing remediation. The list is a starting point for awareness, not an exhaustive security standard (use ASVS for verification).

## Official sources
- Docs: https://owasp.org/Top10/ (redirects to the current 2025 edition at https://owasp.org/Top10/2025/)
- Repo: https://github.com/OWASP/Top10
- License: Creative Commons Attribution-ShareAlike 4.0 (CC BY-SA 4.0)

## Core concepts
The 2025 edition defines ten categories (A01-A10). Each maps to a set of CWE weaknesses:

- **A01:2025 Broken Access Control** — users acting outside their intended permissions (IDOR, missing authorization checks, privilege escalation).
- **A02:2025 Security Misconfiguration** — insecure defaults, verbose errors, unpatched/exposed components, overly permissive settings.
- **A03:2025 Software Supply Chain Failures** — risks from vulnerable, compromised, or tampered third-party components and build pipelines.
- **A04:2025 Cryptographic Failures** — weak, missing, or misapplied cryptography exposing data in transit or at rest.
- **A05:2025 Injection** — untrusted input interpreted as code/commands (SQLi, OS command injection, XSS is included here).
- **A06:2025 Insecure Design** — flaws rooted in missing or ineffective security controls at the design stage.
- **A07:2025 Authentication Failures** — weaknesses in identity confirmation and session handling (credential stuffing, weak recovery).
- **A08:2025 Software or Data Integrity Failures** — unverified updates, insecure deserialization, untrusted CI/CD assumptions.
- **A09:2025 Security Logging and Alerting Failures** — insufficient detection, logging, and timely alerting on attacks.
- **A10:2025 Mishandling of Exceptional Conditions** — incorrect handling of errors and edge cases leading to failures or insecure states.

## Best practices
- Treat the Top 10 as an awareness baseline and pair it with a verification standard such as OWASP ASVS for testable requirements.
- Address Broken Access Control (A01, consistently the top risk) by enforcing authorization server-side on every request and denying by default.
- Prevent Injection (A05) with parameterized queries / prepared statements and context-aware output encoding rather than manual escaping.
- Manage supply-chain risk (A03) with a software bill of materials (SBOM), dependency scanning, and verified provenance for build artifacts.

## Common pitfalls
- Relying on client-side checks for access control → enforce all authorization decisions on the server; never trust hidden fields or disabled UI.
- Treating the Top 10 as a complete checklist → it is a prioritization aid, not a comprehensive security program; many real risks fall outside it.
- Citing the outdated 2021 list (superseded) → reference the 2025 edition; category names and ordering changed (e.g., Injection moved, supply chain added).

## Examples
```sql
-- A05 Injection: use a parameterized query, never string concatenation
-- Vulnerable:  "SELECT * FROM users WHERE email = '" + input + "'"
-- Safe (parameterized):
SELECT * FROM users WHERE email = ?;  -- bind `input` as a parameter
```

## Further reading
- Per-category detail pages: https://owasp.org/Top10/2025/
- OWASP ASVS (testable verification requirements): ../owasp-asvs

## Related skills
- ../owasp-asvs — turns Top 10 awareness into verifiable, level-based requirements
- ../appsec-fundamentals — proactive controls that prevent these risks by design
- ../dependency-supply-chain — mitigates A03 Software Supply Chain Failures
