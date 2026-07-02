---
name: pypy
description: PyPy — a fast, compliant alternative Python implementation with a tracing JIT. Consult when CPython performance is a bottleneck for long-running Python.
domain: stack
category: runtime
tags: [pypy, python, jit, runtime, rpython, performance]
official_sources:
  - https://doc.pypy.org/
  - https://github.com/pypy/pypy
verified: 2026-06-16
---

# PyPy

## Overview
PyPy is a fast and compliant alternative implementation of the Python language, built with the RPython framework. Its tracing just-in-time (JIT) compiler can make long-running, CPU-bound pure-Python code substantially faster than CPython. Read this when CPython performance is the bottleneck and the workload is dominated by Python-level code rather than C extensions.

## Official sources
- Docs: https://doc.pypy.org/
- Repo: https://github.com/pypy/pypy
- Install / download: https://pypy.org/download.html

## Install / setup
PyPy distributes pre-compiled binaries per platform/architecture from https://pypy.org/download.html (hosted at downloads.python.org). Download and extract the build for your OS, then verify:

```bash
pypy3 --version
pypy3 -m ensurepip
pypy3 -m pip install -r requirements.txt
```

On macOS, the download page notes signed packages are also available via Homebrew.

## Core concepts
- Tracing JIT: PyPy compiles hot loops to machine code at runtime, speeding up repeated Python-level execution.
- High CPython compatibility: PyPy3 targets a specific CPython language version (e.g. PyPy3.11) and runs most pure-Python code unchanged.
- Built with RPython, a restricted subset of Python from which the interpreter and JIT are generated.
- Best speedups come from long-running, CPU-bound, pure-Python workloads where the JIT can warm up.
- `cpyext` provides C-extension compatibility, but C-API-heavy code can run slower than on CPython.

## Best practices
- Benchmark your actual workload before committing — PyPy helps most on long-running pure-Python hot loops.
- Match the PyPy3 release to the CPython language version your code targets.
- Prefer pure-Python or PyPy-friendly libraries; minimize reliance on heavy C-extension paths.
- Allow JIT warm-up time; short scripts may not benefit and can even start slower.

## Common pitfalls
- Expecting speedups on C-extension-heavy code → `cpyext` overhead can negate gains; test first.
- Using PyPy for tiny short-lived scripts → JIT warm-up cost may outweigh benefits.
- Assuming binary wheels built for CPython work directly → some packages need PyPy-specific builds.

## Examples
```python
# Run with: pypy3 sum.py  — JIT accelerates the hot loop
def total(n):
    s = 0
    for i in range(n):
        s += i * i
    return s

print(total(10_000_000))
```

## Further reading
- Documentation: https://doc.pypy.org/
- Compatibility notes: https://doc.pypy.org/en/latest/cpython_differences.html

## Related skills
- ../python3 — the reference CPython runtime PyPy is compatible with
