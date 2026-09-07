---
name: node
description: Node.js — the standard cross-platform JavaScript/TypeScript server runtime built on V8; consult for server/CLI/tooling work in JS.
domain: stack
category: runtime
tags: [nodejs, javascript, typescript, v8, runtime, npm]
official_sources:
  - https://nodejs.org/docs/latest/api/
  - https://github.com/nodejs/node
verified: 2026-06-16
---

# Node.js

## Overview
Node.js is an open-source, cross-platform JavaScript runtime environment built on the V8 engine. It runs JavaScript (and, via loaders/transpilers, TypeScript) outside the browser to build servers, CLIs, and tooling. Read this when choosing or configuring the runtime for a JS/TS backend, scripts, or build tooling. The project is governed under the OpenJS Foundation.

## Official sources
- Docs: https://nodejs.org/docs/latest/api/
- Repo: https://github.com/nodejs/node
- Install / download: https://nodejs.org/en/download

## Install / setup
The official download page provides prebuilt installers and binaries plus a version-manager flow. To verify a manual install, download the platform installer/binary from the download page, then confirm:

```bash
node --version
npm --version
```

For multiple versions, the download page recommends a Node version manager (e.g. `nvm`); follow the exact script shown on https://nodejs.org/en/download/package-manager.

## Core concepts
- Single-threaded event loop with non-blocking async I/O — long synchronous work blocks all requests.
- CommonJS (`require`) and ECMAScript Modules (`import`); `.mjs`/`"type": "module"` select ESM behavior.
- Built-in core modules (`fs`, `http`, `path`, `crypto`, `worker_threads`, etc.) documented in the API reference.
- `npm` is the bundled package manager; `package.json` declares dependencies, scripts, and module type.
- Release lines: even-numbered majors become Long Term Support (LTS); odd majors are "Current" only.
- `worker_threads` and the cluster model offload CPU-bound work off the main event loop.

## Best practices
- Pin to an active LTS release for production stability (see https://nodejs.org/en/about/previous-releases).
- Keep CPU-heavy tasks off the event loop using worker threads or external services.
- Commit a lockfile (`package-lock.json`) and prefer `npm ci` for reproducible installs.
- Handle async errors explicitly; attach handlers for `unhandledRejection`/`uncaughtException` only for logging and graceful shutdown.

## Common pitfalls
- Blocking the event loop with synchronous/CPU-bound code → offload to worker threads or break work into async chunks.
- Mixing CommonJS and ESM incorrectly (e.g. `require` of an ESM-only package) → align `"type"` and import style per the modules docs.
- Relying on an end-of-life Node version → track the release schedule and upgrade to a supported LTS.

## Examples
```js
import http from 'node:http';

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Hello from Node.js');
});

server.listen(3000, () => console.log('listening on :3000'));
```

## Further reading
- API reference: https://nodejs.org/docs/latest/api/
- Release schedule: https://nodejs.org/en/about/previous-releases

## Related skills
- ../bun — alternative JS/TS runtime and toolkit
- ../deno — secure JS/TS runtime with built-in tooling
