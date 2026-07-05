---
name: bun
description: Bun — fast all-in-one JS/TS runtime, bundler, test runner, and package manager; a Node.js drop-in. Consult for fast JS/TS dev and tooling.
domain: stack
category: runtime
tags: [bun, javascript, typescript, runtime, bundler, package-manager]
official_sources:
  - https://bun.com/docs
  - https://github.com/oven-sh/bun
verified: 2026-06-16
---

# Bun

## Overview
Bun is an all-in-one toolkit for JavaScript and TypeScript apps, designed as a drop-in replacement for Node.js. It ships as a single dependency-free executable that bundles a runtime, package manager, bundler, and test runner. Written in Zig and powered by JavaScriptCore, it targets fast startup and install times. Read this when you want a single fast tool covering run, install, build, and test.

## Official sources
- Docs: https://bun.com/docs
- Repo: https://github.com/oven-sh/bun
- Install / download: https://bun.com/docs/installation

## Install / setup
macOS & Linux (from the official installation page):

```bash
curl -fsSL https://bun.com/install | bash
```

Windows (PowerShell):

```powershell
powershell -c "irm bun.sh/install.ps1|iex"
```

Verify the install:

```bash
bun --version
bun --revision
```

## Core concepts
- Single executable provides runtime, package manager (`bun install`), bundler (`bun build`), and test runner (`bun test`).
- Native TypeScript and JSX support — run `.ts`/`.tsx` directly without a separate transpile step.
- Node.js compatibility layer aims for drop-in replacement of `node`, including many built-in modules and npm packages.
- Bun-specific APIs (e.g. `Bun.serve`, `Bun.file`) offer optimized I/O and HTTP serving.
- `bun.lockb`/lockfile and a fast, npm-compatible install resolve dependencies from the npm registry.
- The binary upgrades itself via `bun upgrade`.

## Best practices
- Verify after install and add `~/.bun/bin` to `PATH` if `bun` is not found (per the installation docs).
- Use `bun install` to leverage the integrated, fast package manager and its lockfile.
- Pin to stable releases; canary builds are untested and upload crash reports (installation docs).
- Run TypeScript directly with `bun run` instead of adding a separate transpiler step.

## Common pitfalls
- Assuming 100% Node.js parity → check the Node compatibility docs for unsupported APIs before migrating.
- On Linux, missing `unzip` breaks the install script → install `unzip` first (installation docs).
- Using a baseline build on a modern CPU unnecessarily → only use baseline builds when you hit "Illegal Instruction" errors.

## Examples
```ts
const server = Bun.serve({
  port: 3000,
  fetch(req) {
    return new Response('Hello from Bun');
  },
});

console.log(`listening on ${server.url}`);
```

## Further reading
- Documentation index: https://bun.com/docs
- Runtime / Node compatibility: https://bun.com/docs/runtime/nodejs-apis

## Related skills
- ../node — the runtime Bun aims to replace
- ../deno — alternative secure JS/TS runtime
