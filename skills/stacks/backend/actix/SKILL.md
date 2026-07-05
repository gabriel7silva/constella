---
name: actix
description: Powerful, fast Rust web framework (actix-web) on Tokio with HTTP/1 and HTTP/2, routing, and middleware; consult when building Rust HTTP services.
domain: stack
category: backend
tags: [rust, actix-web, tokio, http, web-framework]
official_sources:
  - https://actix.rs/docs/
  - https://github.com/actix/actix-web
verified: 2026-06-16
---

# Actix Web

## Overview
actix-web is a powerful, pragmatic, and extremely fast web framework for Rust. It supports HTTP/1.x and HTTP/2, streaming and pipelining, powerful request routing with optional macros, and comprehensive middleware. Built on Tokio and running on stable Rust, it ranks among the fastest web frameworks in TechEmpower benchmarks. Read this when building Rust HTTP APIs and services.

## Official sources
- Docs: https://actix.rs/docs/
- Repo: https://github.com/actix/actix-web
- Install / download: https://actix.rs/docs/getting-started/

## Install / setup
```bash
cargo new hello-world
cd hello-world
```
```toml
# Cargo.toml — add the dependency (requires a recent stable Rust)
[dependencies]
actix-web = "4"
```

## Core concepts
- App & HttpServer: an `App` registers routes and shared state; `HttpServer` binds an address and runs the app, often across multiple worker threads.
- Handlers (extractors): async functions whose typed arguments (path, query, JSON, state) are extracted from the request automatically.
- Routing: route macros (`#[get("/path")]`) or builder methods (`.route(...)`, `.service(...)`) map paths and methods to handlers.
- Application state: shared data wrapped in `web::Data<T>` injected into handlers; it must be thread-safe.
- Middleware: wraps handlers for cross-cutting concerns (logging, auth, compression) via the `wrap` API.
- Responders: handler return types implementing `Responder` are converted into HTTP responses.

## Best practices
- Pin `actix-web = "4"` and use a recent stable Rust toolchain as the docs require (https://actix.rs/docs/getting-started/).
- Share state with `web::Data` instead of globals so it is cleanly injected and thread-safe.
- Use typed extractors (Json, Path, Query) so deserialization and validation happen at the boundary.
- Add the Logger middleware and structured error handling rather than panicking in handlers.

## Common pitfalls
- Doing blocking work directly in an async handler → blocks the worker; offload with `web::block` or an async client.
- Expecting non-Send state to be shared across workers → `App` state must be thread-safe; wrap shared data in `web::Data`.
- Confusing the actor framework `actix` with the web framework `actix-web` → for web servers depend on `actix-web`.

## Examples
```rust
use actix_web::{get, App, HttpServer, Responder};

#[get("/")]
async fn hello() -> impl Responder {
    "Hello, World!"
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    HttpServer::new(|| App::new().service(hello))
        .bind(("127.0.0.1", 8080))?
        .run()
        .await
}
```

## Further reading
- https://actix.rs/docs/getting-started/ — Getting started
- https://actix.rs/docs/extractors/ — Type-safe extractors

## Related skills
- ../gin — comparable high-performance framework in Go
- ../aspnet-core — cross-platform compiled-language web framework (.NET)
