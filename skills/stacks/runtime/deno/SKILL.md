---
name: deno
description: Deno — a secure-by-default JS/TS/WebAssembly runtime with built-in tooling (fmt, lint, test) and explicit permissions. Consult for secure JS/TS runtimes.
domain: stack
category: runtime
tags: [deno, javascript, typescript, webassembly, runtime, security]
official_sources:
  - https://docs.deno.com/
  - https://github.com/denoland/deno
verified: 2026-06-16
---

# Deno

## Overview
Deno is a JavaScript, TypeScript, and WebAssembly runtime with secure defaults and a focus on developer experience. It is built on V8, Rust, and Tokio, and ships with built-in tooling (formatter, linter, test runner, bundler). Unlike Node, code runs sandboxed: file, network, and environment access must be explicitly granted. Read this when you want first-class TypeScript and an opt-in permission model.

## Official sources
- Docs: https://docs.deno.com/
- Repo: https://github.com/denoland/deno
- Install / download: https://docs.deno.com/runtime/getting_started/installation/

## Install / setup
macOS & Linux (from the official installation page):

```bash
curl -fsSL https://deno.land/install.sh | sh
```

Windows (PowerShell):

```powershell
irm https://deno.land/install.ps1 | iex
```

Verify the install:

```bash
deno --version
```

## Core concepts
- Secure by default: file, network, and env access require explicit flags (e.g. `--allow-net`, `--allow-read`).
- First-class TypeScript — run `.ts` directly with no separate build step.
- Built-in tooling: `deno fmt`, `deno lint`, `deno test`, `deno bundle`, and `deno compile`.
- Web-standard APIs (`fetch`, `URL`, Web Streams) plus a Node.js compatibility layer (`node:` specifiers, npm specifiers).
- Modules are loaded by URL/specifier; dependencies and tasks are configured in `deno.json`.

## Best practices
- Grant the narrowest permissions needed (specific paths/hosts) rather than blanket `--allow-all`.
- Pin dependency versions and use a lockfile for reproducible builds.
- Use the built-in `deno fmt`/`deno lint`/`deno test` instead of adding external tooling where possible.
- Prefer web-standard APIs for portability across runtimes and edge platforms.

## Common pitfalls
- Running with `--allow-all` and losing the security benefit → scope permissions explicitly.
- Expecting full Node API parity → consult the Node compatibility docs for unsupported modules.
- Forgetting that remote imports execute with the granted permissions → review and pin third-party module sources.

## Examples
```ts
// run with: deno run --allow-net server.ts
Deno.serve({ port: 3000 }, (_req) => {
  return new Response('Hello from Deno');
});
```

## Further reading
- Getting started: https://docs.deno.com/runtime/getting_started/
- Permissions: https://docs.deno.com/runtime/fundamentals/security/

## Related skills
- ../node — the runtime Deno's Node-compat layer targets
- ../bun — alternative fast JS/TS runtime
