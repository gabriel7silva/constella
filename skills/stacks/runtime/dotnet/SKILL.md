---
name: dotnet
description: .NET — Microsoft's free, cross-platform, open-source runtime (CoreCLR) for C#/F#/VB apps and services. Consult for installing, running, and deploying .NET.
domain: stack
category: runtime
tags: [dotnet, csharp, coreclr, runtime, cli, cross-platform]
official_sources:
  - https://learn.microsoft.com/dotnet/
  - https://github.com/dotnet/runtime
verified: 2026-06-16
---

# .NET

## Overview
.NET is a free, cross-platform, open-source development platform from Microsoft for building web, cloud, desktop, mobile, AI, and IoT applications. The runtime (CoreCLR) executes Intermediate Language compiled from C#, F#, or Visual Basic, with a large class library. Read this when installing the SDK/runtime, using the `dotnet` CLI, or deploying a .NET service.

## Official sources
- Docs: https://learn.microsoft.com/dotnet/
- Repo: https://github.com/dotnet/runtime
- Install / download: https://dotnet.microsoft.com/download

## Install / setup
Download the SDK (which includes the runtime) for your platform from https://dotnet.microsoft.com/download (current LTS shown there is the .NET 10.0 line). On Linux, follow the package-manager instructions linked from the page. Verify and scaffold:

```bash
dotnet --version
dotnet new console -o hello
dotnet run --project hello
```

## Core concepts
- The `dotnet` CLI drives the workflow: `new`, `restore`, `build`, `run`, `test`, `publish`.
- The SDK contains build tooling plus the runtime; the runtime-only package just executes apps.
- CoreCLR is the execution engine; the Base Class Library provides core APIs.
- Source compiles to Intermediate Language (IL), JIT-compiled to native code at runtime (AOT also available).
- NuGet is the package manager; project/dependency metadata lives in `.csproj`/`.fsproj` files.
- Release lifecycle alternates LTS (even majors, longer support) and STS releases.

## Best practices
- Target an LTS release (e.g. .NET 10 LTS) for production longevity.
- Install the SDK for development; ship the runtime-only package (or self-contained/AOT) to servers.
- Commit `packages.lock.json` or pin versions for reproducible NuGet restores.
- Use `dotnet publish` with the right runtime identifier for framework-dependent or self-contained deploys.

## Common pitfalls
- Installing only the runtime when you need to build → install the SDK for `dotnet build`.
- Mismatched target framework vs installed runtime version → align `TargetFramework` with an installed runtime.
- Assuming Windows-only → .NET runs cross-platform; verify platform-specific APIs before relying on them.

## Examples
```csharp
var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();
app.MapGet("/", () => "Hello from .NET");
app.Run();
```

## Further reading
- .NET documentation: https://learn.microsoft.com/dotnet/
- Linux install guide: https://learn.microsoft.com/dotnet/core/install/linux

## Related skills
- ../jvm — comparable managed bytecode runtime
