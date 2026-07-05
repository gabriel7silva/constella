---
name: dart
description: Client-optimized, strongly typed language for building apps on any platform (powers Flutter); consult for syntax and setup.
domain: language
category: language
tags: [dart, flutter, client, cross-platform, null-safety]
official_sources:
  - https://dart.dev/guides
  - https://github.com/dart-lang/sdk
verified: 2026-06-16
---

# Dart

## Overview
Dart is an approachable, portable, and productive language for building high-quality apps on any platform; it is the language behind the Flutter UI toolkit. It is strongly typed with sound null safety and compiles to native machine code (mobile/desktop/backend) or to JavaScript and WebAssembly for the web. Read this when writing Dart, building Flutter apps, or setting up the SDK.

## Official sources
- Docs: https://dart.dev/guides
- Repo: https://github.com/dart-lang/sdk
- Install / download: https://dart.dev/get-dart

## Install / setup
From the official Get Dart page. macOS via Homebrew, verbatim:

```bash
brew tap dart-lang/dart
brew install dart
```

Windows via Chocolatey, verbatim from the same page:

```powershell
choco install dart-sdk
```

Source: https://dart.dev/get-dart (note: the Flutter SDK already includes the full Dart SDK)

## Core concepts
- Sound null safety — types are non-nullable by default; nullable types use `?`, and the compiler guarantees non-null values are never null at runtime.
- Strong static typing with inference — `var`/`final`/`const` plus full type inference; `dynamic` opts out when needed.
- Everything is an object — including numbers and functions; functions are first-class values.
- Async with Futures and Streams — `async`/`await`, `Future<T>`, and `Stream<T>` model single and multiple asynchronous results.
- Isolates — concurrency via isolated memory units that communicate by message passing (no shared mutable state).
- AOT and JIT compilation — JIT with hot reload during development, ahead-of-time native or JS/Wasm for release.

## Best practices
- Follow Effective Dart (the official style/usage/design guide on dart.dev) for idiomatic code.
- Embrace sound null safety: prefer non-nullable types and handle nullability explicitly rather than reaching for `!`.
- Use `final`/`const` for values that don't change; mark compile-time constants `const`.
- Use the Dart SDK tooling (`dart analyze`, `dart format`, `dart test`) and pub for packages.

## Common pitfalls
- Overusing the null-assertion operator `!` → throws if the value is null at runtime; prefer null-aware operators (`?.`, `??`) and proper null checks.
- Assuming shared mutable state across isolates → isolates do not share memory; pass data via messages.
- Forgetting to `await` a `Future` → the code continues before the async work completes, causing race conditions.

## Examples
```dart
class Greeter {
  final String prefix;
  const Greeter(this.prefix);

  String greet(String? name) =>
      '$prefix, ${(name == null || name.isEmpty) ? 'world' : name}';
}

void main() {
  const g = Greeter('Hello');
  for (final n in ['ada', 'grace']) {
    print(g.greet(n));
  }
}
```

## Further reading
- Language and library guides: https://dart.dev/guides
- Effective Dart: https://dart.dev/guides (Effective Dart section)

## Related skills
- ../swift — another client-optimized, null-safe app language
- ../../stacks — Flutter and Dart web frameworks build on this language
