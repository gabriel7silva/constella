---
name: lucia
description: Lucia is now a learning resource for implementing auth from scratch in JS/TS, NOT a maintained library — consult to learn session-based auth patterns.
domain: stack
category: auth
tags: [auth, sessions, learning-resource, typescript, deprecated-library, from-scratch]
official_sources:
  - https://lucia-auth.com/
  - https://github.com/lucia-auth/lucia
verified: 2026-06-16
---

# Lucia

## Overview
Important: Lucia is no longer a maintained authentication library. Per the official repo, "Lucia v3 will be deprecated by March 2025. Lucia is now a learning resource on implementing auth from scratch." Treat `lucia-auth.com` as an open-source guide that teaches you to implement session-based authentication in JavaScript/TypeScript yourself, copying the code into your project rather than installing a package. Read this when you want to understand and own your auth implementation.

## Official sources
- Docs: https://lucia-auth.com/
- Repo: https://github.com/lucia-auth/lucia

## Core concepts
- Learning resource, not a dependency: the project provides resources on implementing auth; you write/own the session code rather than depend on a maintained library.
- Sessions: the guide centers on server-side session tokens and validating them on each request, instead of relying on opaque library magic.
- Session token hashing & storage: sessions are stored in your database; the guide teaches hashing tokens and validating/expiring them yourself.
- Database ownership: you define your own user and session tables/schema — there is no enforced schema from a package.
- Deprecated v3 library: the old `lucia` package source remains in the `v3` branch for reference, but it is deprecated and should not be treated as actively maintained.

## Best practices
- Treat Lucia as documentation to copy and adapt, not an `npm install` dependency — that is the project's stated direction (https://github.com/lucia-auth/lucia).
- Store sessions server-side and validate the session token on every request, following the guide's patterns.
- Hash session tokens before storing them and enforce expiration, as the guide teaches.

## Common pitfalls
- Adding the deprecated `lucia` v3 package to a new production project → it is deprecated; follow the from-scratch guide or choose a maintained library instead.
- Expecting ongoing maintenance, releases, or security patches → the library is no longer maintained; only the learning content is current.

## Examples
```ts
// Conceptual: validate a session token (pattern from the Lucia guide).
// You implement and own this code — there is no library to import.
async function validateSession(token: string) {
  const sessionId = hash(token)             // hash before lookup
  const session = await db.getSession(sessionId)
  if (!session || session.expiresAt < new Date()) return null
  return session
}
```

## Further reading
- https://lucia-auth.com/ — the learning resource (implementation guides)
- https://github.com/lucia-auth/lucia — repo with the deprecation notice and `v3` reference branch

## Related skills
- ../authjs — maintained, framework-agnostic auth library for JS/TS
- ../supabase-auth — managed auth if you prefer not to implement sessions yourself
