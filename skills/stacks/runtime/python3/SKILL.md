---
name: python3
description: CPython — the reference Python 3 runtime for scripts, services, and data/ML work. Consult for installing, running, and packaging Python applications.
domain: stack
category: runtime
tags: [python, python3, cpython, runtime, pip, venv]
official_sources:
  - https://docs.python.org/3/
  - https://github.com/python/cpython
verified: 2026-06-16
---

# Python 3 (CPython)

## Overview
CPython is the reference implementation of the Python 3 language, maintained by the Python core team. It is a dynamically typed, general-purpose runtime widely used for backend services, automation, scripting, and data/ML workloads. Read this when installing or configuring a Python runtime, managing dependencies, or isolating environments.

## Official sources
- Docs: https://docs.python.org/3/
- Repo: https://github.com/python/cpython
- Install / download: https://www.python.org/downloads/

## Install / setup
Download the official installer/source for your platform from https://www.python.org/downloads/ (current release shown there is the 3.14.x line). Verify and create an isolated environment:

```bash
python3 --version
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
python3 -m pip install -r requirements.txt
```

## Core concepts
- The interpreter executes bytecode on the CPython VM; modules and packages organize importable code.
- Virtual environments (`venv`) isolate per-project dependencies from the system interpreter.
- `pip` installs packages from PyPI; `requirements.txt`/`pyproject.toml` declare dependencies.
- The Global Interpreter Lock (GIL) serializes bytecode execution per process, limiting CPU-bound threading.
- The standard library is extensive (`os`, `pathlib`, `asyncio`, `json`, `subprocess`, etc.).
- `asyncio` provides cooperative concurrency for I/O-bound code.

## Best practices
- Always work inside a virtual environment; never `pip install` into the system Python.
- Pin dependencies (lockfile or pinned `requirements.txt`) for reproducible installs.
- Use a maintained Python version; check the status of releases at https://devguide.python.org/versions/.
- For CPU-bound parallelism, use `multiprocessing` or native extensions rather than threads (due to the GIL).

## Common pitfalls
- Installing packages globally and creating version conflicts → use a per-project `venv`.
- Expecting threads to speed up CPU-bound work → the GIL serializes them; use processes instead.
- Calling `python`/`pip` ambiguously across Python 2/3 → use explicit `python3`/`python3 -m pip`.

## Examples
```python
from http.server import HTTPServer, BaseHTTPRequestHandler

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"Hello from Python")

HTTPServer(("", 8000), Handler).serve_forever()
```

## Further reading
- Standard library reference: https://docs.python.org/3/library/
- Version status: https://devguide.python.org/versions/

## Related skills
- ../pypy — JIT alternative Python implementation
