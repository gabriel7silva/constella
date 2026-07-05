---
name: appsec-fundamentals
description: Application security fundamentals — OWASP Proactive Controls, input validation, output encoding, and secure-by-default design; consult when building any feature.
domain: engineering
category: security
tags: [appsec, proactive-controls, input-validation, output-encoding, owasp]
official_sources:
  - https://top10proactive.owasp.org/
  - https://cheatsheetseries.owasp.org/
verified: 2026-06-16
---

# Application Security Fundamentals

## Overview
While the OWASP Top 10 describes what goes wrong, the OWASP Top 10 Proactive Controls describe what to build to prevent it. This skill summarizes the proactive controls and the foundational defenses (input validation, output/context-aware encoding, secure defaults) that every feature should apply by default. Read this at the start of building a feature, not after a vulnerability is found. For deep, topic-specific guidance, follow the linked OWASP Cheat Sheets.

## Official sources
- Proactive Controls (2024): https://top10proactive.owasp.org/
- Proactive Controls repo: https://github.com/OWASP/www-project-proactive-controls/
- Cheat Sheet Series (130+ topic guides): https://cheatsheetseries.owasp.org/
- Cheat Sheet repo: https://github.com/OWASP/CheatSheetSeries
- License: Creative Commons Attribution-ShareAlike 4.0 (CC BY-SA 4.0)

## Core concepts
The OWASP Top 10 Proactive Controls (2024) are the security techniques to include in every project:

- **C1 Implement Access Control** — enforce authorization server-side, deny by default.
- **C2 Use Cryptography to Protect Data** — protect data at rest and in transit with vetted algorithms and managed keys.
- **C3 Validate all Input & Handle Exceptions** — treat all input as untrusted; fail safely on errors.
- **C4 Address Security from the Start** — threat-model and design controls early (secure design).
- **C5 Secure By Default Configurations** — ship hardened defaults rather than relying on later hardening.
- **C6 Keep your Components Secure** — track and patch third-party dependencies.
- **C7 Secure Digital Identities** — robust authentication, session, and credential handling.
- **C8 Leverage Browser Security Features** — use headers/policies (CSP, cookie attributes) the browser enforces.
- **C9 Implement Security Logging and Monitoring** — log security events and enable detection.
- **C10 Stop Server Side Request Forgery** — validate and restrict outbound requests built from user input.

Two cross-cutting defenses underpin several controls:
- **Input validation** — prefer allow-list (positive) validation of type, length, format, and range; validation is defense-in-depth, not a substitute for safe APIs.
- **Output / context-aware encoding** — encode untrusted data for the exact sink it lands in (HTML body, HTML attribute, JavaScript, URL, SQL) to neutralize injection.

## Best practices
- Use parameterized queries and safe APIs to stop injection at the boundary; treat input validation as an additional layer, not the primary defense.
- Apply output encoding based on the output context, since the correct escaping differs between HTML, attributes, JavaScript, and URLs.
- Adopt secure-by-default configuration (C5): least privilege, disabled debug endpoints, and minimal exposed surface from day one.
- Consult the relevant OWASP Cheat Sheet for any non-trivial control rather than improvising (the series is the canonical implementation reference).

## Common pitfalls
- Relying on input validation alone to prevent injection → combine validation with parameterized queries and context-aware encoding.
- Using a single "escape" function everywhere → encoding is context-specific; HTML-encoding a value placed into a JavaScript string is still unsafe.
- Bolting on security after the build (skipping C4) → design controls in from the start; retrofitting access control and crypto is error-prone.

## Examples
```text
# Context-aware output encoding (concept):
HTML body      -> HTML entity encode  ( < becomes &lt; )
HTML attribute -> attribute encode + quote the attribute
JavaScript     -> JS string encode / avoid building JS from input
URL parameter  -> URL/percent encode
```

## Further reading
- Input Validation Cheat Sheet, Cross Site Scripting Prevention Cheat Sheet, Injection Prevention Cheat Sheet — https://cheatsheetseries.owasp.org/
- Proactive Controls detailed pages — https://top10proactive.owasp.org/

## Related skills
- ../owasp-top-10 — the risks these controls prevent
- ../owasp-asvs — testable requirements aligned to these controls
- ../secure-auth-sessions — implementation detail for C7
