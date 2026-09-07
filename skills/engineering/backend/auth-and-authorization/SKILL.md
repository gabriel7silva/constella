---
name: backend/auth-and-authorization
description: Authentication vs authorization, OAuth 2.0 roles and tokens, and access-control models (RBAC/ABAC) with OWASP enforcement guidance.
domain: engineering
category: engineering
tags: [auth, authentication, authorization, oauth2, rbac, abac, security]
official_sources:
  - https://oauth.net/2/
  - https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html
verified: 2026-06-16
---

# Authentication and Authorization

## Overview
Authentication (AuthN) verifies *who* a caller is; authorization (AuthZ) decides *what* they are allowed to do. This skill covers that distinction, the OAuth 2.0 authorization framework and its tokens, the RBAC/ABAC access-control models, and OWASP's rules for enforcing authorization safely. Read it when designing login, API access control, or permission checks.

## Official sources
- OAuth 2.0: https://oauth.net/2/
- OWASP Authorization Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html
- OAuth 2.0 spec (RFC 6749): https://www.rfc-editor.org/rfc/rfc6749

## Core concepts
- **AuthN vs AuthZ.** Authentication confirms identity; authorization, per OWASP, "verif[ies] that a requested action or service is approved for a specific entity." An authenticated user may still lack authorization for a given resource.
- **OAuth 2.0 is an authorization framework, not authentication.** It is "the industry-standard protocol for authorization," defining flows for web, mobile, desktop, and device clients (RFC 6749).
- **OAuth roles.** Resource owner, client, authorization server, and resource server cooperate; the client obtains an **access token** to call the resource server on the owner's behalf.
- **Tokens.** Access tokens (often Bearer tokens, RFC 6750) authorize API calls; refresh tokens obtain new access tokens. PKCE protects public clients, and OAuth 2.1 is an in-progress consolidation of OAuth 2.0 plus common extensions.
- **RBAC.** Role-based access control ties permissions to roles assigned to users — simple to start, but can grow unwieldy as roles multiply.
- **ABAC / ReBAC.** Attribute-based (subject/object/environment attributes + policies) and relationship-based access control support fine-grained, multi-tenant logic that RBAC handles poorly.

## Best practices
- Enforce authorization **server-side** on every request — never trust client-side checks alone (OWASP).
- **Deny by default:** grant access only when a rule explicitly permits it, so logic gaps fail closed (OWASP).
- Apply **least privilege:** give each entity the minimum permissions for its role, and audit periodically to prevent privilege creep (OWASP).
- Check authorization on the **specific resource**, not just the route, and avoid exposing predictable object identifiers to prevent IDOR-style access (OWASP).

## Common pitfalls
- Treating authentication as if it grants authorization → always run a separate AuthZ check after identifying the user.
- Relying on hidden fields or client-side role checks → enforce every decision on the server (OWASP).
- Using OAuth 2.0 access tokens as proof of identity → use OpenID Connect for authentication; OAuth alone is for authorization.
- Direct object references without a per-resource access check → verify the caller may act on *that* object (OWASP, IDOR).

## Examples
```http
# Calling a protected API with an OAuth 2.0 Bearer access token (RFC 6750)
GET /api/orders/1001 HTTP/1.1
Host: api.example.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
```text
Deny-by-default authorization check (pseudocode):
  if not policy.permits(subject, action, resource): return 403
  proceed
```

## Further reading
- OAuth 2.0 Bearer Token Usage (RFC 6750): https://www.rfc-editor.org/rfc/rfc6750
- OWASP Authentication Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html

## Related skills
- ./backend-fundamentals — the HTTP layer these checks protect
- ./observability-logging — logging authorization failures for audit
