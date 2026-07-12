---
name: supabase
description: Open-source Firebase alternative built on Postgres with auth, storage, realtime, and edge functions; consult for full-stack Postgres backends.
domain: stack
category: database
tags: [supabase, postgres, baas, auth, realtime]
official_sources:
  - https://supabase.com/docs
  - https://github.com/supabase/supabase
verified: 2026-06-16
---

# Supabase

## Overview
Supabase is an open-source backend-as-a-service that pairs a hosted PostgreSQL database with authentication, file storage, realtime subscriptions, edge functions, and auto-generated APIs. Read this when building a full-stack app that wants Postgres plus auth/storage/realtime without operating each piece yourself.

## Official sources
- Docs: https://supabase.com/docs
- Repo (official): https://github.com/supabase/supabase
- Local development: https://supabase.com/docs/guides/local-development

## Install / setup
Install the Supabase CLI and start the local stack (requires a Docker-compatible container runtime), from the official local-development guide:

```sh
npm install supabase --save-dev
npx supabase init
npx supabase start
```

Alternatively, via Homebrew:

```sh
brew install supabase/tap/supabase
supabase init
supabase start
```

The local Supabase Studio is available at http://localhost:54323.

## Core concepts
- Postgres-first: every project is a real PostgreSQL database; you can use full SQL and extensions.
- Row Level Security (RLS): authorization is enforced in the database via Postgres RLS policies.
- Auth: built-in user management with email/password, OAuth providers, and JWT-based sessions.
- Auto-generated APIs: REST (PostgREST) and realtime subscriptions are derived from your schema.
- Storage: S3-compatible object storage with access controlled by policies.
- Edge Functions: serverless functions (Deno) for custom server-side logic.
- Migrations and the CLI: manage schema changes and local-to-prod parity.

## Best practices
- Enable Row Level Security on all tables exposed to clients and write explicit policies; never rely on client-side checks.
- Develop locally with the CLI and use migrations so schema changes are versioned and reproducible.
- Keep the `service_role` key server-side only; use the `anon` key (subject to RLS) in clients.
- Use the database directly for constraints and triggers rather than enforcing integrity in app code.
- Generate types from your schema for end-to-end type safety in the client.

## Common pitfalls
- Forgetting to enable RLS, leaving tables world-readable/writable via the anon key → enable RLS and add policies.
- Exposing the `service_role` key in frontend code → it bypasses RLS; keep it secret.
- Making schema changes only in the dashboard → drift between environments; use migrations.
- Treating it as a black box rather than Postgres → you can and should use SQL, indexes, and extensions.

## Examples
```sql
-- Enable RLS and restrict rows to their owner
alter table profiles enable row level security;

create policy "owner can read" on profiles
  for select using (auth.uid() = user_id);
```

## Further reading
- Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Auth: https://supabase.com/docs/guides/auth

## Related skills
- ../postgresql — the database engine underneath Supabase
- ../neon — serverless Postgres alternative
