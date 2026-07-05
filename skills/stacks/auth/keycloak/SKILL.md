---
name: keycloak
description: Keycloak — open-source identity and access management server (OIDC, OAuth 2.0, SAML) for adding SSO, federation, and user management to apps.
domain: stack
category: auth
tags: [auth, iam, sso, oidc, oauth2, saml, self-hosted, identity-provider]
official_sources:
  - https://www.keycloak.org/documentation
  - https://github.com/keycloak/keycloak
verified: 2026-06-16
---

# Keycloak

## Overview
Keycloak is open-source Identity and Access Management for modern applications and services. It lets you add authentication and secure services with minimal effort, so you don't store users or write login flows yourself. It is an identity provider speaking OpenID Connect, OAuth 2.0, and SAML, with built-in SSO, identity brokering, and user federation. Read this when you need a self-hosted IAM/IdP.

## Official sources
- Docs: https://www.keycloak.org/documentation
- Repo: https://github.com/keycloak/keycloak
- Install / download: https://www.keycloak.org/getting-started/getting-started-docker

## Install / setup
```bash
docker run -p 127.0.0.1:8080:8080 -e KC_BOOTSTRAP_ADMIN_USERNAME=admin -e KC_BOOTSTRAP_ADMIN_PASSWORD=admin quay.io/keycloak/keycloak:26.6.3 start-dev
```
(Verbatim from the official Docker getting-started page. `start-dev` runs Keycloak in development mode and creates an initial admin user `admin`/`admin`. Do not use `start-dev` in production.)

## Core concepts
- Realm: an isolated tenant that owns its own users, clients, roles, and configuration; the `master` realm is admin-only.
- Client: an application or service registered with Keycloak that requests authentication (confidential or public).
- Protocols: Keycloak speaks OpenID Connect, OAuth 2.0, and SAML so standard apps can integrate without custom code.
- Roles & groups: authorization is modeled with realm/client roles assigned directly or via groups.
- Identity brokering & federation: Keycloak can delegate login to external IdPs (social, SAML, OIDC) and federate users from LDAP/Active Directory.
- Tokens: after login Keycloak issues ID, access, and refresh tokens (JWTs) that apps validate.

## Best practices
- Never run `start-dev` in production — it uses dev defaults; use `start` with a production database and proper hostname/TLS config (https://www.keycloak.org/server/configuration-production).
- Create a dedicated realm per environment/tenant; don't put applications in the `master` realm.
- Use confidential clients with a secret for server-side apps and public clients with PKCE for SPAs/native apps.
- Front Keycloak with TLS and set the correct hostname so issued token issuer URLs are valid.

## Common pitfalls
- Using `start-dev` or the bootstrap admin credentials in production → insecure defaults and no proper persistence; switch to `start` and a real DB.
- Putting client apps in the `master` realm → mixes admin and app users; create a separate realm.
- Public client without PKCE for browser/native apps → vulnerable to code interception; enable PKCE.

## Examples
```bash
# Start a development server (creates admin/admin), then visit http://localhost:8080
docker run -p 127.0.0.1:8080:8080 \
  -e KC_BOOTSTRAP_ADMIN_USERNAME=admin \
  -e KC_BOOTSTRAP_ADMIN_PASSWORD=admin \
  quay.io/keycloak/keycloak:26.6.3 start-dev
```

## Further reading
- https://www.keycloak.org/guides — task-oriented guides (server, securing apps, operator)
- https://www.keycloak.org/server/configuration-production — production configuration

## Related skills
- ../auth0 — hosted alternative to a self-managed IdP
- ../authjs — JS/TS app library that can use Keycloak as an OIDC provider
