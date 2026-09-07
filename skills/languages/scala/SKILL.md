---
name: scala
description: JVM language blending object-oriented and functional programming with strong static typing; consult for syntax and setup.
domain: language
category: language
tags: [scala, jvm, functional, object-oriented, static-typing]
official_sources:
  - https://docs.scala-lang.org/
  - https://github.com/scala/scala
verified: 2026-06-16
---

# Scala

## Overview
Scala is a statically typed language for the JVM that fuses object-oriented and functional programming, with a powerful type system and concise, expressive syntax. It interoperates with Java libraries and runs on the JVM (with Scala.js and Scala Native as additional targets). Read this when writing Scala, choosing between Scala 2 and 3, or setting up the toolchain.

## Official sources
- Docs: https://docs.scala-lang.org/
- Repo: https://github.com/scala/scala
- Install / download: https://www.scala-lang.org/download/

## Install / setup
The official download page recommends `cs setup`, the Scala installer powered by Coursier. Verbatim for Linux (x86-64):

```bash
curl -fL https://github.com/coursier/coursier/releases/latest/download/cs-x86_64-pc-linux.gz | gzip -d > cs && chmod +x cs && ./cs setup
```

macOS (Homebrew), verbatim from the same page:

```bash
brew install coursier/formulas/coursier && cs setup
```

Source: https://www.scala-lang.org/download/

## Core concepts
- Everything is an expression — `if`, `match`, and blocks return values; statements are rare.
- Immutability by default — `val` (immutable) is preferred over `var`; immutable collections are the default.
- Pattern matching and case classes — destructure and branch on algebraic data with exhaustive `match` expressions.
- Traits — composable units of behavior mixed into classes, supporting a flexible alternative to single inheritance.
- Strong static typing with inference — the compiler infers most types while enforcing safety; supports generics and higher-kinded types.
- Higher-order functions and the collections library — `map`, `flatMap`, `filter`, `fold` enable functional data transformations.
- Scala 2 vs Scala 3 — Scala 3 is a separate evolution; docs cover both and a migration guide.

## Best practices
- Prefer `val` and immutable collections; reach for `var`/mutable state only when measured and necessary.
- Use case classes and pattern matching for modeling data and control flow idiomatically.
- Follow the official Scala style guide (linked from docs.scala-lang.org) for idiomatic code.
- Install and manage tooling with Coursier (`cs setup`), the recommended installer.

## Common pitfalls
- Overusing mutable `var` and imperative loops → favor immutable values and collection combinators.
- Non-exhaustive `match` expressions on sealed hierarchies → enable warnings so the compiler flags missing cases.
- Mixing Scala 2 and Scala 3 assumptions → check which version a feature/library targets (see the migration guide).

## Examples
```scala
case class Greeter(prefix: String):
  def greet(name: String): String = s"$prefix, ${name.capitalize}"

val g = Greeter("Hello")
List("ada", "grace").map(g.greet).foreach(println)
```

## Further reading
- Documentation and tour: https://docs.scala-lang.org/
- Scala 2 to 3 migration: https://docs.scala-lang.org/ (migration guide)

## Related skills
- ../elixir — functional programming on another managed VM
- ../../stacks — JVM/Scala frameworks (e.g. Akka, Play) build on this language
