---
name: cpp
description: High-performance, statically typed systems language with zero-overhead abstractions; consult for C++ syntax, RAII, and setup.
domain: language
category: language
tags: [cpp, systems, performance, native, compiled]
official_sources:
  - https://en.cppreference.com/
  - https://github.com/cplusplus/draft
verified: 2026-06-16
---

# C++

## Overview
C++ is a statically typed, compiled systems programming language offering low-level control and high performance alongside high-level abstractions (classes, templates, the standard library) with a zero-overhead philosophy. It is standardized by ISO/IEC JTC1/SC22/WG21, with C++23 the most recent published standard and C++26 in progress. Read this when writing performance-critical native code, managing manual resources, or setting up a C++ toolchain.

## Official sources
- Docs (community reference): https://en.cppreference.com/
- Repo (standard draft sources): https://github.com/cplusplus/draft
- Get started: https://isocpp.org/get-started

## Install / setup
C++ has no single installer; you install a compiler. The official ISO C++ "Get Started" page lists free compilers including GCC (`g++`), Clang, and Visual C++ Community. Typical install of GCC on Debian/Ubuntu:

```bash
sudo apt install g++
```

Source / recommended compilers: https://isocpp.org/get-started

## Core concepts
- RAII (Resource Acquisition Is Initialization) — tie resource lifetime to object scope so destructors release resources deterministically.
- Value semantics and the rule of move — objects are copied by default; move semantics (`std::move`, move constructors) transfer ownership efficiently.
- Templates and generic programming — compile-time polymorphism over types; the STL (containers, algorithms, iterators) is built on them.
- Smart pointers — `std::unique_ptr` and `std::shared_ptr` express ownership and automate deallocation, replacing raw `new`/`delete`.
- The standard library — containers (`vector`, `map`), algorithms, strings, and ranges (cppreference is the canonical reference).
- Undefined behavior — the standard leaves some operations (out-of-bounds access, signed overflow, use-after-free) with no defined meaning.

## Best practices
- Prefer RAII and smart pointers over manual `new`/`delete` to avoid leaks and double-frees (per the C++ Core Guidelines, linked from isocpp.org).
- Use standard-library containers and algorithms instead of hand-rolled loops and C arrays.
- Pass large objects by `const&`; use move semantics to avoid needless copies.
- Compile with warnings on (`-Wall -Wextra`) and target a recent standard (e.g. `-std=c++23`).

## Common pitfalls
- Dangling pointers/references from use-after-free or returning references to locals → use smart pointers and value semantics; this is undefined behavior.
- Out-of-bounds container/array access → undefined behavior; use bounds-checked access (`.at()`) or `std::span`/ranges where appropriate.
- Manual memory management with raw `new`/`delete` leaking on early return/exception → use `unique_ptr`/`shared_ptr` and RAII.

## Examples
```cpp
#include <memory>
#include <string>
#include <iostream>

struct Greeter {
    std::string greet(const std::string& name) const {
        return "Hello, " + name;
    }
};

int main() {
    auto g = std::make_unique<Greeter>();   // RAII: freed automatically
    std::cout << g->greet("ada") << '\n';
}
```

## Further reading
- Language and library reference: https://en.cppreference.com/
- ISO C++ home and Core Guidelines: https://isocpp.org/get-started

## Related skills
- ../swift — a memory-safe systems language that interoperates with C/C++
- ../scala — managed-VM language for contrast with native compilation
