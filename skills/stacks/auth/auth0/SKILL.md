---
name: auth0
description: Auth0 — hosted identity platform built on OAuth 2.0 and OpenID Connect for adding login, SSO, and M2M auth via Universal Login and SDKs.
domain: stack
category: auth
tags: [auth, identity, oauth2, oidc, sso, universal-login, jwt, saml]
official_sources:
  - https://auth0.com/docs
  - https://github.com/auth0
verified: 2026-06-16
---

# Auth0

## Overview
Auth0 is a hosted identity and access management platform that adds authentication and authorization to applications using OAuth 2.0 and OpenID Connect (plus SAML). It provides Universal Login, quickstarts and SDKs for many frameworks, and supports flows for web, single-page, native, machine-to-machine, and device apps. Read this when you want a managed IdP rather than self-hosting auth.

## Official sources
- Docs: https://auth0.com/docs
- Repo (org): https://github.com/auth0
- Install / quickstarts: https://auth0.com/docs/quickstarts

## Install / setup
```bash
npm install @auth0/nextjs-auth0
```
(Auth0 publishes per-framework SDKs from its official, domain-verified GitHub org — e.g. `nextjs-auth0`, `auth0-react`, `auth0-spa-js`, `node-auth0`. Pick the SDK matching your stack from https://auth0.com/docs/quickstarts.)

## Core concepts
- Tenant: your isolated Auth0 environment with its own users, applications, and configuration.
- Application (client): a registered app type — Single Page, Regular Web, Native, or Machine-to-Machine — each mapped to an appropriate OAuth flow.
- Universal Login: Auth0-hosted login page that centralizes authentication and enables SSO across apps.
- OAuth 2.0 / OIDC flows: Auth0 documents Authorization Code, Authorization Code with PKCE, Client Credentials (M2M), Device Authorization, and more, each suited to an app type.
- Tokens: Auth0 issues ID tokens (OIDC) and access tokens (often JWTs) that apps and APIs validate.
- APIs & scopes: protect your backend by registering it as an API with an audience and scopes/permissions.

## Best practices
- Use Authorization Code Flow with PKCE for SPAs and native/mobile apps; Auth0 documents PKCE as the recommended public-client flow (https://auth0.com/docs/get-started/authentication-and-authorization-flow).
- Use the Client Credentials flow for machine-to-machine access, not user-facing flows.
- Prefer Universal Login over embedding login forms, to get SSO, attack protection, and consistent UX.
- Validate access tokens at your API by audience and issuer; don't trust ID tokens for API authorization.

## Common pitfalls
- Choosing the wrong application type → mismatched flow (e.g. SPA configured as a Regular Web App) breaks token handling; pick the type that matches your app.
- Using the Resource Owner Password flow for normal logins → Auth0 marks it as not recommended and only for highly-trusted clients.
- Treating the ID token as an API access token → use the access token (with the right audience/scopes) to authorize API calls.

## Examples
```ts
// Next.js (App Router) with @auth0/nextjs-auth0
import { Auth0Client } from "@auth0/nextjs-auth0/server"

export const auth0 = new Auth0Client()
// Configure AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET, AUTH0_SECRET, APP_BASE_URL in env.
```

## Further reading
- https://auth0.com/docs/get-started/authentication-and-authorization-flow — choosing the right flow
- https://auth0.com/docs/quickstarts — framework quickstarts

## Related skills
- ../keycloak — self-hosted open-source IdP alternative
- ../clerk — hosted auth with prebuilt UI components
