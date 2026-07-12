---
name: clean-code
description: Writing readable, consistent code — naming, small focused functions, cohesion, and following a project style guide.
domain: engineering
category: practices
tags: [clean-code, readability, naming, style-guide, functions]
official_sources:
  - https://google.github.io/styleguide/
  - https://github.com/google/styleguide
verified: 2026-06-16
---

# Clean Code

## Overview
Clean code is code optimized for the human reader, not just the compiler: clear names, small focused units, and a consistent style so a large codebase stays understandable as it grows. Consult this when naming things, splitting up large functions, or deciding which conventions to adopt for a project. The Google Style Guides are a concrete, widely-used reference for the "consistency" half of the problem.

## Official sources
- Docs: https://google.github.io/styleguide/
- Repo: https://github.com/google/styleguide

## Core concepts
- **Consistency beats personal preference.** As the Google Style Guides note, a large codebase is much easier to understand when all its code follows a single consistent style; the guide itself is "sometimes arbitrary" by design, because agreeing on *a* convention matters more than the convention.
- **A style guide is a set of conventions.** Each major project defines its own rules for formatting, naming, and structure (Google publishes per-language guides for C++, Java, Python, JavaScript, Go, and more).
- **Readable names.** Names should reveal intent so the reader does not have to trace the implementation to understand what a variable, function, or class is for.
- **Small, focused functions.** A function that does one thing at one level of abstraction is easier to name, test, and reuse than a long multi-purpose block.
- **Cohesion.** Group code that changes together; a class or module should have a single, clear responsibility rather than a grab-bag of unrelated behavior.

## Best practices
- **Adopt and enforce a style guide.** Pick an existing published guide (e.g. Google's per-language guide) rather than inventing one, and enforce it with a formatter/linter so style stops being a review topic.
- **Name for intent, not implementation.** Prefer descriptive names that a reviewer can understand without context (one of Google's stated code-review checks is whether names clearly communicate intent — see code-review-practices).
- **Keep functions short and single-purpose.** Extract sub-steps into well-named helpers so each function reads top-to-bottom at one level of abstraction.
- **Comment the "why", not the "what".** Use comments to explain rationale and non-obvious decisions; let clear names and structure express the "what".

## Common pitfalls
- **Bikeshedding over formatting in reviews** → automate formatting with a tool so humans review behavior and design, not whitespace.
- **One giant function / "god" class** → split by responsibility into smaller cohesive units; low cohesion makes change risky and testing hard.
- **Cryptic or misleading names** (`tmp`, `data2`, names that lie about behavior) → rename to reflect actual intent; a rename is a cheap, safe refactoring (see refactoring).

## Examples
```python
# Unclear: what is processed, and what comes back?
def proc(d):
    r = []
    for x in d:
        if x[1] > 0:
            r.append(x[0])
    return r

# Clean: intent-revealing names, one job
def names_of_in_stock_products(products):
    return [name for name, quantity in products if quantity > 0]
```

## Further reading
- Google C++ Style Guide: https://google.github.io/styleguide/cppguide.html
- Google Python Style Guide: https://google.github.io/styleguide/pyguide.html

## Related skills
- ../refactoring — how to safely improve unclean code
- ../code-review-practices — what reviewers check for, including naming and clarity
