---
name: rust
description: Memory-safe systems language with ownership and no GC; consult for ownership/borrowing, Cargo, and error handling.
domain: language
category: language
tags: [rust, systems, ownership, borrow-checker, cargo]
official_sources:
  - https://doc.rust-lang.org/book/
  - https://github.com/rust-lang/rust
  - https://www.rust-lang.org/tools/install
verified: 2026-06-16
---

# Rust

## Overview
Rust is a systems programming language focused on performance, reliability, and productivity. Its type system and ownership model guarantee memory safety and thread safety without a garbage collector, catching whole classes of bugs at compile time. It ships with Cargo (build tool and package manager), rustfmt, Clippy, and rust-analyzer. Read this for ownership/borrowing, error handling, and the Cargo workflow.

## Official sources
- Docs (The Book): https://doc.rust-lang.org/book/
- Repo: https://github.com/rust-lang/rust
- Install: https://www.rust-lang.org/tools/install

## Install / setup
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

## Core concepts
- Ownership: every value has a single owner; when the owner goes out of scope the value is dropped (deterministic deallocation, no GC).
- Borrowing and references: values can be borrowed immutably (`&T`, many) or mutably (`&mut T`, exactly one at a time); the borrow checker enforces this at compile time.
- Lifetimes: the compiler tracks how long references are valid to prevent dangling references; most are inferred, some are annotated.
- Traits: shared behavior defined as traits and implemented for types; the basis for generics and polymorphism.
- Enums and pattern matching: algebraic data types with `match`; `Option<T>` and `Result<T, E>` replace null and exceptions.
- Error handling: recoverable errors use `Result` with the `?` operator; unrecoverable errors `panic!`.
- Cargo: builds, tests, runs, and manages dependencies via `Cargo.toml` from crates.io.

## Best practices
- Let the borrow checker guide design: prefer borrowing over cloning, and restructure data flow rather than reaching for `unsafe`.
- Use `Result` and the `?` operator for recoverable errors; reserve `panic!`/`unwrap` for truly unrecoverable states or tests.
- Run `cargo clippy` (the official linter) and `cargo fmt` to keep code idiomatic and consistent.
- Model invalid states out of existence with enums and the type system instead of runtime checks.

## Common pitfalls
- Reaching for `.unwrap()`/`.expect()` in production paths → propagate with `?` and handle `None`/`Err` explicitly.
- Fighting the borrow checker by cloning everywhere → often a sign the data ownership/structure needs rethinking.
- Overusing `unsafe` to bypass the checker → it disables guarantees; isolate and justify any `unsafe` block.
- Confusing `String` (owned) with `&str` (borrowed slice) → pass `&str` for read-only access, own a `String` when you need to store/grow it.

## Examples
```rust
use std::fs;

fn read_config(path: &str) -> Result<String, std::io::Error> {
    let contents = fs::read_to_string(path)?; // ? propagates the error
    Ok(contents)
}

fn main() {
    match read_config("config.toml") {
        Ok(text) => println!("{text}"),
        Err(e) => eprintln!("failed to read config: {e}"),
    }
}
```

## Further reading
- The Rust Programming Language (The Book): https://doc.rust-lang.org/book/
- Rust by Example: https://doc.rust-lang.org/rust-by-example/

## Related skills
- ../go — another modern compiled systems-adjacent language
