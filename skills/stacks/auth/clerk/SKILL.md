---
name: clerk
description: Hosted authentication and user management with prebuilt React/JS UI components — consult when adding sign-up, sign-in, and profile flows fast.
domain: stack
category: auth
tags: [auth, user-management, react, nextjs, components, sessions, mfa]
official_sources:
  - https://clerk.com/docs
  - https://github.com/clerk/javascript
verified: 2026-06-16
---

# Clerk

## Overview
Clerk is a hosted authentication and user-management platform that ships prebuilt, customizable UI components (sign-up, sign-in, user profile, organization switcher) plus SDKs for frameworks like Next.js and React. It handles sessions, MFA, and organizations so you don't build user storage yourself. Read this when you want production auth with minimal UI work.

## Official sources
- Docs: https://clerk.com/docs
- Repo: https://github.com/clerk/javascript
- Install / download: https://clerk.com/docs/quickstarts/setup-clerk

## Install / setup
```bash
npm install @clerk/nextjs
```
(Command from the official Next.js quickstart, https://clerk.com/docs/quickstarts/nextjs. Other frameworks use the matching `@clerk/*` package, e.g. `@clerk/clerk-react`.)

## Core concepts
- Prebuilt components: `<SignIn />`, `<SignUp />`, `<UserButton />`, `<UserProfile />`, and `<OrganizationSwitcher />` provide drop-in, themeable auth UI.
- Application / instance: Clerk apps have a development and production instance, each with publishable and secret keys.
- Sessions & JWTs: Clerk manages user sessions and can issue JWTs/templates to authenticate requests to your backend.
- Organizations: built-in multi-tenancy — users belong to organizations with roles and memberships.
- Control components: `<SignedIn>`, `<SignedOut>`, and helpers gate UI based on auth state; middleware protects routes (e.g. `clerkMiddleware` in Next.js).
- SDK packages: the `@clerk/javascript` monorepo provides environment-specific SDKs under the `@clerk` namespace.

## Best practices
- Keep the secret key server-side only; expose only the publishable key to the client. See https://clerk.com/docs.
- Use Clerk middleware to protect routes centrally rather than checking auth in each handler.
- Use Organizations for B2B/multi-tenant apps instead of rolling your own tenancy model.
- Customize the prebuilt components via appearance props rather than rebuilding flows from scratch.

## Common pitfalls
- Installing the wrong SDK package → use `@clerk/nextjs` for Next.js, `@clerk/clerk-react` for plain React; mixing them breaks the integration.
- Leaking the secret key into client bundles → only the publishable key is safe client-side.
- Forgetting to wrap the app in the Clerk provider / middleware → components throw because there's no Clerk context.

## Examples
```tsx
// app/layout.tsx (Next.js App Router)
import { ClerkProvider, SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs"

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html><body>
        <SignedOut><SignInButton /></SignedOut>
        <SignedIn><UserButton /></SignedIn>
        {children}
      </body></html>
    </ClerkProvider>
  )
}
```

## Further reading
- https://clerk.com/docs/quickstarts/nextjs — Next.js quickstart
- https://clerk.com/docs/references/nextjs/clerk-middleware — route protection

## Related skills
- ../auth0 — alternative hosted identity platform (OAuth/OIDC focused)
- ../authjs — open-source, self-hosted alternative for JS/TS
