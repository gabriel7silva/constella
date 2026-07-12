---
name: secure-auth-sessions
description: Safe authentication and session management per OWASP cheat sheets — passwords, MFA, session IDs, secure cookies, regeneration, and timeouts.
domain: engineering
category: security
tags: [authentication, sessions, mfa, cookies, owasp]
official_sources:
  - https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
  - https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
verified: 2026-06-16
---

# Secure Authentication & Session Management

## Overview
Authentication confirms who a user is; session management keeps them authenticated across requests without re-proving identity each time. Both are high-value targets and appear in the OWASP Top 10 (A07 Authentication Failures). This skill distills the OWASP Authentication and Session Management cheat sheets into the decisions you most often get wrong. Read it when designing login, registration, password reset, or any stateful session.

## Official sources
- Authentication Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
- Session Management Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- Repo: https://github.com/OWASP/CheatSheetSeries
- License: Creative Commons Attribution-ShareAlike 4.0 (CC BY-SA 4.0)

## Core concepts
- **Passwords.** Enforce a minimum length (OWASP guidance: at least 8 characters with MFA, 15 without) and a generous maximum (at least 64 characters to allow passphrases). Allow all characters including Unicode and whitespace, and avoid arbitrary composition rules and mandatory periodic rotation.
- **Breached-password and MFA.** Block common and previously breached passwords (e.g., via a Pwned Passwords-style check). Multi-factor authentication is the single strongest defense against password-related attacks.
- **Generic error messages.** Use identical responses for failed login regardless of cause (e.g., "Login failed; Invalid user ID or password") so attackers cannot enumerate valid accounts.
- **Secure password storage.** Never store plaintext or reversible passwords; use a dedicated password-hashing function (see the Password Storage Cheat Sheet) rather than a general-purpose hash.
- **Session IDs.** Generate session IDs with at least 64 bits of entropy, keep their value meaningless (no embedded data), and rename framework defaults (PHPSESSID, JSESSIONID) to a generic name like `id`.
- **Session lifecycle.** Regenerate the session ID on any privilege change, especially at login (prevents session fixation). Enforce both an idle timeout and an absolute timeout, and provide a server-side logout that invalidates the session.

## Best practices
- Set cookie attributes `Secure`, `HttpOnly`, and `SameSite=Strict` (or `Lax`); for the strongest binding use the `__Host-` cookie name prefix (requires Secure, Path=/, and no Domain).
- Regenerate the session identifier immediately after successful authentication and after any privilege escalation.
- Keep authentication responses and timing uniform to avoid username/account enumeration.
- Prefer MFA for any account with meaningful access, and verify against breached-password lists at registration and password change.

## Common pitfalls
- Reusing the pre-login session ID after authentication → regenerate it on login to prevent session fixation.
- Distinct "user not found" vs "wrong password" messages → return one generic failure message and avoid timing oracles.
- Storing passwords with a fast/general hash (or imposing complexity rules and forced rotation) → use a proper password-hashing algorithm and follow modern length-over-complexity guidance.
- Omitting `HttpOnly`/`Secure`/`SameSite` on the session cookie → enables XSS theft, plaintext interception, and CSRF.

## Examples
```http
Set-Cookie: __Host-id=<64-bit-entropy-value>; Secure; HttpOnly; SameSite=Strict; Path=/
```

## Further reading
- Password Storage Cheat Sheet, Forgot Password Cheat Sheet, Multifactor Authentication Cheat Sheet — https://cheatsheetseries.owasp.org/
- ASVS chapters V6 (Authentication) and V7 (Session Management) — ../owasp-asvs

## Related skills
- ../owasp-asvs — testable auth/session requirements (V6, V7)
- ../appsec-fundamentals — C7 Secure Digital Identities
- ../secrets-management — protecting the credentials and keys behind auth
