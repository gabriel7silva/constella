---
name: supabase-auth
description: Supabase Auth — managed user authentication (password, magic link, OTP, social, SSO) that integrates with Postgres Row Level Security.
domain: stack
category: auth
tags: [auth, supabase, postgres, rls, oauth, jwt, sso, magic-link]
official_sources:
  - https://supabase.com/docs/guides/auth
  - https://github.com/supabase/auth
verified: 2026-06-16
---

# Supabase Auth

## Overview
Supabase Auth makes it easy to add authentication and authorization to an app via client SDKs and API endpoints for creating and managing users. It supports password, magic link, one-time password (OTP), social login, and single sign-on (SSO), and integrates tightly with the Supabase Postgres database so the auth token can drive Row Level Security. Read this when your app already uses Supabase or you want auth coupled to Postgres RLS.

## Official sources
- Docs: https://supabase.com/docs/guides/auth
- Repo: https://github.com/supabase/auth

## Install / setup
```bash
npm install @supabase/supabase-js
```
(The `@supabase/supabase-js` client provides the `auth` namespace; see https://supabase.com/docs/guides/auth. The server in github.com/supabase/auth is a Go service, originally based on Netlify's GoTrue, that Supabase runs for you.)

## Core concepts
- Auth methods: password, magic link, OTP, social login (OAuth2/OIDC providers), phone auth, and SSO are all supported.
- JWT access token: on sign-in, Auth issues a JWT representing the user; SDK calls send it to scope access.
- Row Level Security (RLS): the auth token scopes database access row-by-row when RLS policies are enabled — this is how authorization is enforced.
- Users vs. sessions: Auth manages user records and sessions; `auth.users` lives in the database and is referenced by your tables.
- GoTrue server: the underlying server (github.com/supabase/auth) issues JWTs, handles sign-in, and manages users; it diverged from Netlify's GoTrue.
- External providers: sign in with Google, Apple, Facebook, Discord, and other OAuth providers configured per project.

## Best practices
- Enable Row Level Security on every table holding user data and write policies against the auth token — RLS is the documented authorization mechanism (https://supabase.com/docs/guides/auth).
- Use the client SDK's `auth` methods rather than calling endpoints manually, so tokens and refresh are handled for you.
- Never expose the service-role key to the client; use the anon key client-side and the service-role key only on trusted servers.
- Configure redirect URLs / allowed origins for OAuth and magic-link flows to prevent broken or hijacked redirects.

## Common pitfalls
- Leaving RLS disabled → any client with the anon key can read/write all rows; enable RLS and add policies.
- Using the service-role key in browser code → it bypasses RLS entirely; keep it server-side only.
- Assuming a user is authorized just because they're authenticated → authentication (who they are) is separate from RLS-based authorization (what they can touch).

## Examples
```ts
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Magic link sign-in
await supabase.auth.signInWithOtp({ email: "user@example.com" })

// OAuth sign-in
await supabase.auth.signInWithOAuth({ provider: "github" })
```

## Further reading
- https://supabase.com/docs/guides/auth/row-level-security — RLS with Auth
- https://supabase.com/docs/guides/auth/social-login — social providers

## Related skills
- ../authjs — framework-agnostic JS/TS auth (can also use external providers)
- ../keycloak — self-hostable OIDC server you could federate as an SSO provider
