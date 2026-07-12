---
name: fiber
description: Express-inspired Go web framework built on Fasthttp for fast, low-allocation HTTP services; consult when building Go APIs with an Express-like API.
domain: stack
category: backend
tags: [go, fiber, fasthttp, express, web-framework]
official_sources:
  - https://docs.gofiber.io/
  - https://github.com/gofiber/fiber
verified: 2026-06-16
---

# Fiber

## Overview
Fiber is an Express-inspired web framework written in Go and built on top of Fasthttp, the fastest HTTP engine for Go. It aims for fast development with zero memory allocation and high performance in mind. Read this when building Go HTTP APIs and you want an Express-like routing and middleware API.

## Official sources
- Docs: https://docs.gofiber.io/
- Repo: https://github.com/gofiber/fiber
- Install / download: https://docs.gofiber.io/ (Installation section)

## Install / setup
```bash
# Requires Go 1.25 or higher
go get github.com/gofiber/fiber/v3
```

## Core concepts
- App: `fiber.New()` creates the application instance that registers routes and middleware and starts the server with `app.Listen`.
- Context (`fiber.Ctx`): the per-request object exposing params, query, body parsing, and response helpers — the Express-like `c` argument.
- Routing: HTTP-verb methods (`app.Get`, `app.Post`, ...) with path params (`:id`) and wildcards, plus route grouping.
- Middleware: handlers chained with `c.Next()`; Fiber ships official middleware (logger, CORS, recover, etc.).
- Built on Fasthttp: Fiber uses Fasthttp rather than net/http, which is what enables its low-allocation performance profile.

## Best practices
- Pin the major version in your import path (`/v3`) so upgrades are explicit and breaking changes are opt-in (https://docs.gofiber.io/).
- Use the official middleware packages (recover, logger, CORS) instead of reimplementing common concerns.
- Be aware that Fasthttp's `Ctx` and the values it returns are reused per request; copy values you need to retain beyond the handler.
- Return errors from handlers and centralize handling with a custom error handler on `fiber.New`.

## Common pitfalls
- Assuming net/http compatibility → Fiber is built on Fasthttp, so net/http middleware and `http.Request` APIs do not apply directly.
- Holding onto byte slices/strings from `Ctx` after the handler returns → they may be reused; copy them first.
- Mixing Fiber versions (v2 vs v3) imports → keep a single major version; APIs differ between them.

## Examples
```go
package main

import "github.com/gofiber/fiber/v3"

func main() {
    app := fiber.New()
    app.Get("/", func(c fiber.Ctx) error {
        return c.SendString("Hello, World!")
    })
    app.Listen(":3000")
}
```

## Further reading
- https://docs.gofiber.io/ — Welcome / Installation / Zero allocation notes
- https://github.com/gofiber/fiber — Source and examples

## Related skills
- ../gin — alternative high-performance Go web framework
- ../adonisjs — Express-lineage framework in TypeScript
