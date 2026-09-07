---
name: aspnet-core
description: Cross-platform, open-source .NET web framework for cloud apps, web APIs, and Blazor; consult when building or maintaining ASP.NET Core backends.
domain: stack
category: backend
tags: [dotnet, csharp, aspnet-core, web-api, web-framework]
official_sources:
  - https://learn.microsoft.com/aspnet/core/
  - https://github.com/dotnet/aspnetcore
verified: 2026-06-16
---

# ASP.NET Core

## Overview
ASP.NET Core is a cross-platform, open-source .NET framework for building modern cloud-based web applications on Windows, macOS, or Linux. It supports web apps, REST/Minimal APIs, gRPC, real-time apps with SignalR, and the Blazor frontend model. Read this when building .NET HTTP services or web apps. Requires the .NET SDK.

## Official sources
- Docs: https://learn.microsoft.com/aspnet/core/
- Repo: https://github.com/dotnet/aspnetcore
- Install / download: https://learn.microsoft.com/aspnet/core/getting-started (SDK: https://dotnet.microsoft.com/download/dotnet)

## Install / setup
```bash
# Install the latest .NET SDK first (https://dotnet.microsoft.com/download/dotnet)

# Create a Blazor Web App
dotnet new blazor -o BlazorSample
cd BlazorSample

# Run with hot reload
dotnet watch
```
```bash
# Or create a Razor Pages web app
dotnet new webapp -o RazorPagesSample
```

## Core concepts
- Host & startup: `WebApplication.CreateBuilder` configures services and the request pipeline; `app.Run()` starts the server.
- Middleware pipeline: ordered components process each request/response (routing, auth, static files); order matters.
- Dependency injection: a built-in DI container registers services with lifetimes (singleton, scoped, transient) consumed via constructor injection.
- Routing & endpoints: Minimal APIs, controllers, and Razor Pages map URLs to handlers via endpoint routing.
- Configuration & options: layered configuration (appsettings.json, env vars, user secrets) bound to strongly typed options.
- Blazor & Razor: component-based UI (Blazor) and the Razor syntax mixing HTML with C# for server-rendered pages.

## Best practices
- Use `dotnet watch` during development for hot reload of markup and code (https://learn.microsoft.com/aspnet/core/getting-started).
- Register dependencies in the DI container and inject them rather than constructing them manually.
- Order middleware deliberately; place routing, authentication, and authorization in the documented sequence.
- Use the configuration/options system and user secrets for settings instead of hardcoding values.

## Common pitfalls
- Misordering middleware (e.g. authorization before routing) → requests bypass or mishandle auth; follow the documented pipeline order.
- Choosing the wrong project template → `dotnet new blazor` scaffolds Blazor, `dotnet new webapp` scaffolds Razor Pages; pick what matches your app.
- Storing secrets in appsettings.json committed to source control → use user secrets in development and a secret store in production.

## Examples
```csharp
var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

app.MapGet("/ping", () => "pong");

app.Run();
```

## Further reading
- https://learn.microsoft.com/aspnet/core/getting-started — Get started
- https://learn.microsoft.com/aspnet/core/tutorials/min-web-api — Minimal API tutorial
- https://learn.microsoft.com/aspnet/core/fundamentals/ — Fundamentals (DI, middleware, configuration)

## Related skills
- ../actix — high-performance compiled-language web framework (Rust)
- ../laravel — full-stack web framework alternative (PHP)
