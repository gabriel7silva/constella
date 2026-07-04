---
name: kotlin
description: Concise, modern JVM language fully interoperable with Java; consult for null safety, coroutines, and tooling.
domain: language
category: language
tags: [kotlin, jvm, null-safety, coroutines, multiplatform]
official_sources:
  - https://kotlinlang.org/docs/home.html
  - https://github.com/JetBrains/kotlin
  - https://kotlinlang.org/docs/getting-started.html
verified: 2026-06-16
---

# Kotlin

## Overview
Kotlin is a concise, statically typed, multiplatform language developed by JetBrains. It runs primarily on the JVM with full two-way interoperability with Java, and also targets Android, native, and other platforms. It emphasizes null safety, expressive syntax, and structured concurrency via coroutines. Read this for null safety, coroutines, and the recommended getting-started path.

## Official sources
- Docs: https://kotlinlang.org/docs/home.html
- Repo: https://github.com/JetBrains/kotlin
- Getting started: https://kotlinlang.org/docs/getting-started.html

## Install / setup
Kotlin ships with every IntelliJ IDEA and Android Studio release, so installing one of those IDEs is the recommended way to start (per the getting-started page). To install the standalone command-line compiler via SDKMAN! (per https://kotlinlang.org/docs/command-line.html):
```bash
sdk install kotlin
```

## Core concepts
- Null safety: types are non-nullable by default; nullable types are marked with `?`, and the compiler forces you to handle `null`.
- Concise syntax: type inference, data classes, properties, and expression bodies reduce boilerplate versus Java.
- Java interoperability: Kotlin calls Java and Java calls Kotlin seamlessly, easing incremental adoption in existing JVM codebases.
- Coroutines: lightweight, structured concurrency with `suspend` functions for non-blocking asynchronous code.
- Extension functions: add functions to existing types without inheritance or modifying the original class.
- Immutability by default intent: `val` (read-only) vs. `var` (mutable); prefer `val`.
- Smart casts and `when`: after a type/null check the compiler auto-casts; `when` is a powerful expression-based branch.

## Best practices
- Prefer `val` over `var` and immutable collections to make state explicit and reduce bugs.
- Use the null-safety operators (`?.`, `?:`, `!!` sparingly) instead of defensive null checks; avoid `!!` except where null is truly impossible.
- Use coroutines with structured concurrency (scopes) for async work rather than raw threads or callbacks.
- Model data with `data class` and represent restricted hierarchies with `sealed` classes for exhaustive `when`.

## Common pitfalls
- Overusing the `!!` not-null assertion → it throws NPE at runtime, defeating null safety; prefer `?.`/`?:` or restructure.
- Platform types from Java (`String!`) → Java values have unknown nullability; annotate or guard them at the boundary.
- Launching coroutines without a proper scope → can leak work; use lifecycle/structured scopes so they are cancelled correctly.
- Assuming `==` is identity → in Kotlin `==` calls `equals` (structural); use `===` for referential equality.

## Examples
```kotlin
fun greet(name: String?): String {
    return "Hello, ${name ?: "guest"}"
}

fun main() {
    println(greet("Ada"))
    println(greet(null))
}
```

## Further reading
- Kotlin Tour: https://kotlinlang.org/docs/kotlin-tour-welcome.html
- Coroutines guide: https://kotlinlang.org/docs/coroutines-guide.html

## Related skills
- ../java — the JVM language Kotlin interoperates with
