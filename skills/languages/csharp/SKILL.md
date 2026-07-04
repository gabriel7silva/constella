---
name: csharp
description: Modern .NET object-oriented language compiled by Roslyn; consult for OOP, async/await, LINQ, and the dotnet CLI.
domain: language
category: language
tags: [csharp, dotnet, roslyn, async, linq]
official_sources:
  - https://learn.microsoft.com/en-us/dotnet/csharp/
  - https://github.com/dotnet/roslyn
  - https://dotnet.microsoft.com/download
verified: 2026-06-16
---

# C#

## Overview
C# is a modern, statically typed, object-oriented language for the .NET platform. It is compiled by Roslyn (the open-source .NET compiler platform, which also exposes rich code-analysis APIs) and runs on the cross-platform .NET runtime. It is used for web (ASP.NET Core), desktop, mobile (MAUI), cloud, and game development. Read this for OOP fundamentals, async/await, LINQ, and the dotnet CLI.

## Official sources
- Docs: https://learn.microsoft.com/en-us/dotnet/csharp/
- Repo (Roslyn compiler): https://github.com/dotnet/roslyn
- Install / download (.NET SDK): https://dotnet.microsoft.com/download

## Install / setup
Install the .NET SDK from https://dotnet.microsoft.com/download. Then create and run a console project (per https://learn.microsoft.com/en-us/dotnet/core/tutorials/with-visual-studio-code):
```bash
dotnet new console -o HelloWorld
cd HelloWorld
dotnet run
```

## Core concepts
- Classes, structs, and records: reference types (`class`), value types (`struct`), and `record` types for concise immutable data with value equality.
- Static typing with type inference: `var` infers the compile-time type; generics provide type-safe collections and APIs.
- Properties and access modifiers: encapsulate fields with auto-properties; `public`/`private`/`protected`/`internal` control visibility.
- async/await: the Task-based asynchronous pattern for non-blocking I/O; `async` methods return `Task`/`Task<T>`.
- LINQ: language-integrated query over collections and other sources, using query or method syntax.
- Nullable reference types: opt-in compiler analysis (`string?`) that flags potential null dereferences.
- Exceptions and `using`: structured error handling via `try`/`catch`/`finally`; `using` disposes `IDisposable` resources deterministically.

## Best practices
- Enable nullable reference types and address compiler nullability warnings to avoid `NullReferenceException`.
- Use `async`/`await` for I/O-bound work and avoid blocking on tasks (e.g. `.Result`/`.Wait()`), which can deadlock.
- Dispose `IDisposable` resources with `using` declarations/statements rather than manual cleanup.
- Prefer LINQ and immutable `record` types for clear, declarative data handling.

## Common pitfalls
- Blocking on async code with `.Result` or `.Wait()` → can deadlock and wastes threads; `await` instead, all the way up.
- Dereferencing null references → enable nullable reference types and handle `null` at boundaries.
- Forgetting to dispose resources (streams, connections) → use `using` to release them deterministically.
- Catching `Exception` broadly and swallowing it → catch specific exceptions and let unexpected ones propagate.

## Examples
```csharp
using System;
using System.Net.Http;
using System.Threading.Tasks;

class Program
{
    static async Task Main()
    {
        using var client = new HttpClient();
        string body = await client.GetStringAsync("https://example.com");
        Console.WriteLine(body.Length);
    }
}
```

## Further reading
- A tour of C#: https://learn.microsoft.com/en-us/dotnet/csharp/tour-of-csharp/overview
- C# language reference: https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/

## Related skills
- ../java — another statically typed, object-oriented, VM-hosted language
