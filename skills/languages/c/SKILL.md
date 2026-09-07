---
name: c
description: C is a low-level, statically typed, compiled systems programming language (ISO/IEC 9899, latest C23) used for OS kernels, embedded firmware, and performance-critical code; consult when writing or debugging C, choosing a compiler (gcc/clang), managing pointers, memory, undefined behavior, build flags, or standard-library usage.
domain: language
category: language
tags: [c, c23, gcc, clang, systems, compiled, iso-9899]
official_sources:
  - https://en.cppreference.com/w/c
  - https://www.iso-9899.info/wiki/The_Standard
  - https://gcc.gnu.org/
verified: 2026-06-17
---

# C

## Overview
C is a small, statically typed, compiled language standardized by ISO/IEC 9899 (current revision C23, published 2024) that maps closely to the machine: manual memory, pointers, and no runtime. It powers operating systems, embedded firmware, language runtimes, and libraries. Read this when writing or debugging C, picking compiler flags, reasoning about undefined behavior, or managing memory and pointers.

## Official sources
- Docs: https://en.cppreference.com/w/c
- Repo: https://gcc.gnu.org/git.html (GCC) / https://github.com/llvm/llvm-project (Clang)
- Install: https://gcc.gnu.org/install/

## Install / setup
```bash
# Debian/Ubuntu: install the GNU toolchain, then compile to C23
sudo apt install build-essential
gcc -std=c23 -Wall -Wextra -O2 hello.c -o hello
```
Toolchain per https://gcc.gnu.org/install/ ; `-std=c23` flag per https://gcc.gnu.org/onlinedocs/gcc/C-Dialect-Options.html

## Core concepts
- **Pointers** — variables holding memory addresses; foundation for arrays, strings, and indirection.
- **Manual memory** — `malloc`/`calloc`/`realloc`/`free`; no GC, so leaks and double-frees are caller's responsibility.
- **Undefined behavior (UB)** — out-of-bounds access, signed overflow, use-after-free; the compiler may assume UB never happens.
- **Translation units & headers** — `.c` files compiled separately; `.h` headers declare shared interfaces; the preprocessor handles `#include`/`#define`.
- **Standard library** — `<stdio.h>`, `<stdlib.h>`, `<string.h>`, `<stdint.h>` for fixed-width ints.
- **`const` / `volatile` / `restrict`** — qualifiers controlling mutability, optimization barriers, and aliasing.
- **C23 additions** — `bool`/`true`/`false`/`nullptr` keywords, `constexpr`, `typeof`, `[[attributes]]`.

## Best practices
- Compile with `-Wall -Wextra` and treat warnings as errors (`-Werror`) (https://gcc.gnu.org/onlinedocs/gcc/Warning-Options.html).
- Use sanitizers during development: `-fsanitize=address,undefined` to catch memory and UB bugs (https://clang.llvm.org/docs/AddressSanitizer.html).
- Prefer fixed-width types from `<stdint.h>` (`int32_t`, `size_t`) over assuming `int` width (https://en.cppreference.com/w/c/types/integer).
- Always check return values of `malloc`, `fopen`, and I/O calls; free every allocation exactly once.

## Common pitfalls
- Reading/writing past array bounds → use ASan and validate indices; never rely on UB.
- Forgetting to null-terminate strings or off-by-one in buffer sizes → use `snprintf` and size the buffer for the terminator.
- Returning a pointer to a stack local → allocate on the heap or pass a caller-owned buffer.

## Examples
```c
#include <stdio.h>
#include <stdlib.h>

int main(void) {
    int *xs = malloc(3 * sizeof *xs);
    if (!xs) return EXIT_FAILURE;
    for (int i = 0; i < 3; i++) xs[i] = i * i;
    for (int i = 0; i < 3; i++) printf("%d\n", xs[i]);
    free(xs);
    return EXIT_SUCCESS;
}
```

## Further reading
- https://en.cppreference.com/w/c — community C standard-library and language reference
- https://gcc.gnu.org/onlinedocs/gcc/ — GCC command and option documentation
- https://www.iso-9899.info/wiki/The_Standard — index of C standard editions and public working drafts

## Related skills
- ../objectivec — Objective-C is a strict superset of C with Smalltalk-style messaging
- ../lua — Lua is implemented in pure ISO C and embeds via the C API
