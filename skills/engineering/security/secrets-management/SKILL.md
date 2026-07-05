---
name: secrets-management
description: Store, rotate, and never commit secrets — vaults over source/env vars, encryption, least privilege, rotation, and secret detection per OWASP guidance.
domain: engineering
category: security
tags: [secrets, vault, rotation, credentials, owasp]
official_sources:
  - https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html
  - https://github.com/OWASP/CheatSheetSeries
verified: 2026-06-16
---

# Secrets Management

## Overview
Secrets (API keys, database credentials, tokens, certificates, encryption keys) are the keys to the kingdom, and leaked secrets are a leading cause of breaches. This skill summarizes the OWASP Secrets Management Cheat Sheet: where secrets should live, how to rotate and revoke them, and how to keep them out of source code. Read it before wiring any credential into an application, CI/CD pipeline, or infrastructure-as-code.

## Official sources
- Secrets Management Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html
- Repo: https://github.com/OWASP/CheatSheetSeries
- License: Creative Commons Attribution-ShareAlike 4.0 (CC BY-SA 4.0)

## Core concepts
- **Use a secrets manager, not source code.** Store secrets in a dedicated solution (cloud services like AWS Secrets Manager, Azure Key Vault, Google Secret Manager, or platform-agnostic tools like HashiCorp Vault), and inject them at deploy time via the orchestrator rather than hardcoding them.
- **Lifecycle: creation, rotation, revocation, expiration.** Generate cryptographically strong secrets with least privilege, rotate them regularly so stolen credentials are short-lived, revoke compromised secrets immediately, and set expirations that force rotation.
- **Encryption at rest and in transit.** Encrypt stored secrets with strong algorithms and never transmit them in plaintext (use TLS). Consider envelope encryption, keeping the encryption keys separate from the secrets they protect.
- **Least privilege access.** Apply fine-grained, secret-level permissions; engineers should not have access to all secrets, and CI/CD systems should reach only the secrets they require. Prefer identity-based access (role assumption) over shared static credentials.
- **Dynamic vs static secrets.** Prefer short-lived dynamic secrets (generated per session/deployment, auto-expiring) where supported; reserve static long-lived secrets for cases that require them, with rigorous rotation.
- **Detect secrets in code.** Use automated detection (e.g., detect-secrets) with pre-commit hooks and IDE/shift-left scanning to catch secrets before they are committed.

## Best practices
- Keep secrets out of source code, container images, and environment variables baked into images; resolve them at runtime from a manager.
- Automate rotation and minimize direct human interaction with raw secret values to reduce error and exposure.
- Scope access per secret and per identity; audit and monitor access rather than granting broad blanket permissions.
- Use distinct test secrets in detection tooling to reduce false positives while still catching real leaks.

## Common pitfalls
- Committing a secret to git → it persists in history; rotate/revoke the secret immediately and scrub history; add pre-commit secret scanning.
- Treating environment variables as a secure store → they can leak via logs, process listings, and child processes; prefer a managed secrets solution.
- Long-lived, never-rotated credentials → set expirations and rotate; prefer dynamic, short-lived secrets where possible.
- Giving every engineer or every CI job access to all secrets → enforce least privilege at the individual-secret level.

## Examples
```text
# Resolve a secret at runtime instead of hardcoding (concept):
1. App authenticates to the secrets manager using its workload identity (no static key).
2. Manager returns a short-lived, scoped secret (e.g., a dynamic DB credential).
3. App uses it; the credential auto-expires and is rotated by the manager.
```

## Further reading
- Secrets Management Cheat Sheet (full lifecycle and tooling detail) — link above
- ASVS chapter V11 Cryptography and V13 Configuration — ../owasp-asvs

## Related skills
- ../appsec-fundamentals — C2 Use Cryptography to Protect Data
- ../secure-auth-sessions — secrets back credential/session security
- ../dependency-supply-chain — pipeline secrets and build integrity
