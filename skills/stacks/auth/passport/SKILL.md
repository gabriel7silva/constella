---
name: passport
description: Passport — Express-compatible authentication middleware for Node.js using pluggable strategies; consult when adding login to an Express/Node app.
domain: stack
category: auth
tags: [auth, nodejs, express, middleware, strategies, sessions, oauth]
official_sources:
  - https://www.passportjs.org/docs/
  - https://github.com/jaredhanson/passport
verified: 2026-06-16
---

# Passport

## Overview
Passport is Express-compatible authentication middleware for Node.js, designed for the singular purpose of authenticating requests. It works through an extensible plugin system of "strategies" (local username/password, OAuth, OpenID, etc.) and does not mount routes or impose a database schema, leaving you in control. Read this when adding authentication to an Express or Node.js app.

## Official sources
- Docs: https://www.passportjs.org/docs/
- Repo: https://github.com/jaredhanson/passport

## Install / setup
```bash
npm install passport
```
(Verbatim from the official repo README. Each authentication method needs its own strategy package, e.g. `npm install passport-local`.)

## Core concepts
- Middleware: Passport is authentication middleware you plug into the Express request pipeline; it authenticates the incoming request.
- Strategies: pluggable mechanisms (e.g. `passport-local`, OAuth strategies) implement a specific way to authenticate; install one per method.
- `passport.authenticate()`: the middleware that runs a named strategy on a route to verify credentials.
- Sessions: Passport can establish a persistent login session, storing a minimal user reference in the session.
- `serializeUser` / `deserializeUser`: control what user data is stored in the session and how it is restored on later requests.
- `req.user`: once authenticated, Passport populates the authenticated user on the request object.

## Best practices
- Install and configure one strategy per authentication method (e.g. `passport-local` for username/password); the core package alone authenticates nothing.
- Keep `serializeUser` payloads minimal (typically just an ID) and reload the full user in `deserializeUser`.
- Place `passport.initialize()` (and `passport.session()` when using sessions) in the correct middleware order before protected routes.
- Pair session-based logins with a secure session store and configured cookies; Passport does not manage session storage for you.

## Common pitfalls
- Expecting login to work with only `passport` installed → you must also install and register a strategy package.
- Wrong middleware ordering → `passport.session()` before the session middleware, or routes before `passport.initialize()`, leaves `req.user` undefined.
- Assuming Passport provides routes or a schema → it intentionally does not; you define routes, user storage, and verification logic yourself.

## Examples
```js
const passport = require("passport")
const LocalStrategy = require("passport-local")

passport.use(new LocalStrategy(async (username, password, done) => {
  const user = await findUser(username)
  if (!user || !(await verify(user, password))) return done(null, false)
  return done(null, user)
}))

passport.serializeUser((user, done) => done(null, user.id))
passport.deserializeUser(async (id, done) => done(null, await getUser(id)))

app.post("/login", passport.authenticate("local", { successRedirect: "/", failureRedirect: "/login" }))
```

## Further reading
- https://www.passportjs.org/concepts/authentication/strategies/ — strategies
- https://www.passportjs.org/packages/ — strategy package catalog

## Related skills
- ../authjs — higher-level, framework-agnostic JS/TS auth library
- ../auth0 — hosted IdP you can integrate via a Passport strategy
