---
name: python
description: Batteries-included, general-purpose dynamic language; consult for core syntax, the standard library, and environments.
domain: language
category: language
tags: [python, cpython, scripting, stdlib, venv]
official_sources:
  - https://docs.python.org/3/
  - https://github.com/python/cpython
  - https://www.python.org/downloads/
verified: 2026-06-16
---

# Python

## Overview
Python is a high-level, general-purpose programming language emphasizing readability and a large standard library ("batteries included"). It is dynamically typed, garbage-collected, and supports procedural, object-oriented, and functional styles. CPython is the reference implementation. Read this for core syntax, packaging/virtual environments, and standard-library usage.

## Official sources
- Docs: https://docs.python.org/3/
- Repo (CPython reference implementation): https://github.com/python/cpython
- Install / download: https://www.python.org/downloads/

## Install / setup
Download and run the installer for your platform from https://www.python.org/downloads/. Verify the install:
```bash
python3 --version
```

## Core concepts
- Indentation-defined blocks: whitespace (not braces) delimits code blocks; consistent indentation is syntactically required.
- Dynamic typing with strong typing: names are bound to objects of any type at runtime, but Python does not silently coerce unrelated types.
- Everything is an object: functions, classes, and modules are first-class objects; duck typing drives polymorphism.
- The standard library: a broad set of built-in modules (os, json, pathlib, datetime, itertools, etc.) cover common tasks without third-party packages.
- Virtual environments: `venv` isolates per-project dependencies from the system interpreter.
- Iterators, generators, and comprehensions: lazy iteration via `__iter__`/`yield`; concise list/dict/set comprehensions.
- Exceptions: errors are raised and caught with `try`/`except`/`finally`; use specific exception types.

## Best practices
- Follow PEP 8, the official style guide, for layout, naming, and formatting.
- Use a virtual environment (`python3 -m venv .venv`) per project so dependencies don't collide with the system Python.
- Prefer context managers (`with open(...) as f:`) so resources are released deterministically.
- Catch specific exceptions rather than bare `except:`; let unexpected errors surface.

## Common pitfalls
- Mutable default arguments (`def f(x=[]):`) → the default is created once and shared across calls; use `None` and create inside the function.
- Mixing tabs and spaces for indentation → causes `TabError`/inconsistent blocks; use spaces consistently (PEP 8 recommends 4 spaces).
- Relying on dict/iteration order assumptions across versions → insertion order is guaranteed for dicts in modern CPython, but don't depend on set ordering.
- Installing packages into the system interpreter globally → use a virtual environment to avoid conflicts.

## Examples
```python
from pathlib import Path

def read_lines(path: str) -> list[str]:
    with open(path, encoding="utf-8") as f:
        return [line.rstrip("\n") for line in f]

for line in read_lines("data.txt"):
    print(line)
```

## Further reading
- The Python Tutorial: https://docs.python.org/3/tutorial/
- PEP 8 style guide: https://peps.python.org/pep-0008/

## Related skills
- (sibling language skills under ../)
