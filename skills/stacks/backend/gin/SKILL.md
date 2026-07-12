---
name: gin
description: Fast Go HTTP web framework with httprouter-based routing, middleware, and JSON binding; consult when building Go REST APIs or microservices.
domain: stack
category: backend
tags: [go, gin, http, rest-api, web-framework]
official_sources:
  - https://gin-gonic.com/en/docs/
  - https://github.com/gin-gonic/gin
verified: 2026-06-16
---

# Gin

## Overview
Gin is a high-performance HTTP web framework written in Go that offers a Martini-like API with much better performance thanks to httprouter. It targets REST APIs, microservices, and web apps where speed and developer productivity matter. Read this when building Go HTTP services with routing, middleware, and request binding.

## Official sources
- Docs: https://gin-gonic.com/en/docs/
- Repo: https://github.com/gin-gonic/gin
- Install / download: https://gin-gonic.com/en/docs/quickstart/

## Install / setup
```bash
go get -u github.com/gin-gonic/gin
```

## Core concepts
- Engine & router: `gin.Default()` returns an Engine with Logger and Recovery middleware attached; it dispatches requests via a zero-allocation router.
- Context (`*gin.Context`): carries the request/response, params, and helpers for binding and rendering; passed to every handler.
- Middleware: functions that run before/after handlers, attached globally or per route group, calling `c.Next()` to continue the chain.
- Route grouping: `router.Group("/api")` clusters routes that share a prefix and middleware.
- Binding & validation: `c.ShouldBindJSON` and friends parse and validate request bodies into structs using tags.
- Rendering: built-in helpers for JSON, XML, and HTML responses.

## Best practices
- Use `gin.Default()` for built-in crash recovery and logging, or `gin.New()` when you want to compose middleware explicitly (https://gin-gonic.com/en/docs/quickstart/).
- Group related routes and apply shared middleware at the group level rather than repeating it per route.
- Validate input with binding tags and `ShouldBind*` methods so malformed requests are rejected early.
- Set `gin.SetMode(gin.ReleaseMode)` in production to reduce debug overhead and log noise.

## Common pitfalls
- Forgetting to call `c.Next()` (or `c.Abort()`) in custom middleware → the chain stalls or continues unexpectedly; call the correct one explicitly.
- Using `c.Bind*` (which auto-aborts with 400) when you want to handle errors yourself → use `c.ShouldBind*` to control the error response.
- Running in debug mode in production → switch to release mode to avoid verbose logging and warnings.

## Examples
```go
package main

import "github.com/gin-gonic/gin"

func main() {
    r := gin.Default()
    r.GET("/ping", func(c *gin.Context) {
        c.JSON(200, gin.H{"message": "pong"})
    })
    r.Run() // listens on :8080
}
```

## Further reading
- https://gin-gonic.com/en/docs/quickstart/ — Quickstart
- https://gin-gonic.com/en/docs/examples/ — Examples (binding, middleware, grouping)

## Related skills
- ../fiber — Express-inspired Go web framework alternative
- ../actix — high-performance web framework in Rust
