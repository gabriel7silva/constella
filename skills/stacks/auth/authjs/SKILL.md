---
name: authjs
description: Framework-agnostic authentication for JS/TS apps (Auth.js, formerly NextAuth.js) — consult when adding OAuth/OIDC, email, or credentials sign-in.
domain: stack
category: auth
tags: [auth, oauth, oidc, nextauth, nextjs, sveltekit, sessions]
official_sources:
  - https://authjs.dev/
  - https://github.com/nextauthjs/next-auth
verified: 2026-06-16
---

# Auth.js (NextAuth.js)

## Overview
Auth.js is an open-source set of packages for authentication built on standard Web APIs, usable with any framework on any JS runtime. It was formerly known as NextAuth.js; the `next-auth` package serves Next.js, while sibling packages (`@auth/sveltekit`, `@auth/express`, Qwik, etc.) target other frameworks. Read this when wiring sign-in flows, OAuth providers, or sessions into a JS/TS app.

## Official sources
- Docs: https://authjs.dev/
- Repo: https://github.com/nextauthjs/next-auth
- Install / download: https://authjs.dev/getting-started/installation

## Install / setup
```bash
npm install next-auth@beta
```
After installing, generate the required secret:
```bash
npx auth secret
```
(For other frameworks the official install page lists `@auth/sveltekit`, `@auth/express`, and the Qwik `qwik add auth` flow.)

## Core concepts
- Providers: pluggable sign-in methods — OAuth/OIDC providers, email (magic link), and credentials. Configure them in the Auth.js config object.
- Sessions: Auth.js issues a session that can be a JWT (default, stateless) or database-backed via an adapter; you read it on server and client.
- Adapters: connect Auth.js to your database (Prisma, Drizzle, etc.) to persist users, accounts, and sessions.
- Callbacks: hooks (`signIn`, `jwt`, `session`, `redirect`) let you customize token contents, authorization, and redirects.
- `AUTH_SECRET`: required environment variable used to encrypt tokens and sign cookies; generated with `npx auth secret`.
- Framework packages: the core is framework-agnostic; you install the package matching your framework (`next-auth`, `@auth/sveltekit`, `@auth/express`).

## Best practices
- Always set a strong `AUTH_SECRET` (use `npx auth secret`) and keep it out of source control. See https://authjs.dev/getting-started/installation.
- Prefer OAuth/OIDC or email providers over the Credentials provider; the docs note credentials are inherently less secure and bypass much of Auth.js's built-in protection.
- Use an adapter when you need to persist users/accounts or link multiple providers to one user.
- Restrict access using the `signIn`/`authorized` callbacks rather than ad-hoc checks scattered through your app.

## Common pitfalls
- Installing the stable major when following current docs → the v5 (Auth.js) getting-started uses `next-auth@beta`; mixing v4 docs with v5 config breaks setup.
- Forgetting `AUTH_SECRET` in production → sign-in fails or sessions cannot be decrypted; set it in the deployment environment.
- Assuming Auth.js is Next.js-only → it is framework-agnostic; use the correct package for your framework.

## Examples
```ts
// auth.ts (Next.js, Auth.js v5)
import NextAuth from "next-auth"
import GitHub from "next-auth/providers/github"

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [GitHub],
})
```

## Further reading
- https://authjs.dev/getting-started — official getting-started guides per framework
- https://authjs.dev/getting-started/providers — provider catalog

## Related skills
- ../auth0 — hosted OAuth/OIDC platform you can plug in as a provider
- ../clerk — alternative hosted auth with prebuilt UI
