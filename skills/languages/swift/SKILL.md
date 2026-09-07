---
name: swift
description: Apple-backed, memory-safe, high-performance language for apps and systems; consult for Swift syntax, concurrency, and setup.
domain: language
category: language
tags: [swift, apple, memory-safe, systems, ios]
official_sources:
  - https://www.swift.org/documentation/
  - https://github.com/swiftlang/swift
verified: 2026-06-16
---

# Swift

## Overview
Swift is a high-performance, memory-safe systems and application programming language with a clean modern syntax and seamless access to existing C and Objective-C code and frameworks. It powers Apple-platform apps and increasingly server-side and cross-platform software on Linux and Windows. Read this when writing Swift, designing with its concurrency model, or setting up the toolchain.

## Official sources
- Docs: https://www.swift.org/documentation/
- Repo: https://github.com/swiftlang/swift
- Install / download: https://www.swift.org/install/

## Install / setup
The official Linux install page recommends Swiftly, the Swift toolchain installer. Verbatim (Bash):

```bash
curl -O https://download.swift.org/swiftly/linux/swiftly-$(uname -m).tar.gz && \
tar zxf swiftly-$(uname -m).tar.gz && \
./swiftly init --quiet-shell-followup && \
. "${SWIFTLY_HOME_DIR:-$HOME/.local/share/swiftly}/env.sh" && \
hash -r
```

Source: https://www.swift.org/install/linux/ (macOS and Windows installers: https://www.swift.org/install/)

## Core concepts
- Value vs reference types — `struct`/`enum` are value types (copied), `class` is a reference type; choosing correctly shapes behavior and performance.
- Optionals — the type system encodes the possible absence of a value (`T?`), forcing explicit handling of nil.
- Protocols and protocol-oriented programming — define capabilities and provide default implementations via extensions.
- Automatic Reference Counting (ARC) — memory for class instances is managed by reference counts; watch for retain cycles.
- Error handling — typed `throws`/`try`/`catch` with `Result` for explicit, recoverable error flows.
- Structured concurrency — `async`/`await`, tasks, and actors provide safe, composable asynchronous and concurrent code.

## Best practices
- Prefer value types (`struct`/`enum`) and immutability (`let`) by default; reach for `class` only when reference semantics are needed.
- Handle optionals explicitly with `if let`/`guard let` rather than force-unwrapping (`!`).
- Use protocol extensions to share behavior instead of deep class hierarchies.
- Manage Swift toolchain versions with Swiftly (the official installer) for reproducible builds.

## Common pitfalls
- Force-unwrapping optionals (`value!`) that can be nil → crashes at runtime; use optional binding or `??` defaults.
- Strong reference cycles between classes/closures → use `weak`/`unowned` captures to let ARC reclaim memory.
- Sharing mutable state across concurrent tasks → isolate it inside an `actor` to avoid data races.

## Examples
```swift
struct Greeter {
    func greet(_ name: String?) -> String {
        guard let name, !name.isEmpty else { return "Hello, world" }
        return "Hello, \(name.capitalized)"
    }
}

print(Greeter().greet("ada"))
```

## Further reading
- Documentation hub: https://www.swift.org/documentation/
- Install guides per platform: https://www.swift.org/install/

## Related skills
- ../cpp — the C/C++ systems languages Swift interoperates with
- ../../stacks — Swift app/server frameworks build on this language
