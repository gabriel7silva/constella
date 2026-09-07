---
name: fastapi
description: Modern async, type-hint-driven Python API framework with automatic validation and OpenAPI docs; consult for high-performance typed APIs.
domain: stack
category: backend
tags: [fastapi, python, async, pydantic, openapi, backend]
official_sources:
  - https://fastapi.tiangolo.com/
  - https://github.com/fastapi/fastapi
verified: 2026-06-16
---

# FastAPI

## Overview
FastAPI is a modern, high-performance Python web framework for building APIs using standard Python type hints. Type annotations drive request parsing, validation (via Pydantic), and automatic interactive documentation (Swagger UI and ReDoc) generated from OpenAPI. Read this when building typed, async-capable APIs where automatic validation and docs save significant boilerplate.

## Official sources
- Docs: https://fastapi.tiangolo.com/
- Repo: https://github.com/fastapi/fastapi
- Install: https://fastapi.tiangolo.com/#installation

## Install / setup
```bash
pip install "fastapi[standard]"
```
The docs note the quotes around `"fastapi[standard]"` are needed so the command works in all terminals. (Source: https://fastapi.tiangolo.com/#installation)

## Core concepts
- **Path operations** — decorators like `@app.get("/")` declare routes on a `FastAPI()` app.
- **Type hints → validation** — function parameter and Pydantic model types define and validate request bodies, query/path params automatically.
- **Pydantic models** — declare request/response schemas as Python classes; FastAPI validates and serializes against them.
- **Dependency injection** — `Depends()` injects reusable dependencies (auth, DB sessions, params) into path operations.
- **Async support** — define handlers as `async def` to use `await` for non-blocking I/O.
- **Automatic docs** — OpenAPI schema plus Swagger UI (`/docs`) and ReDoc (`/redoc`) are generated from your types.

## Best practices
- Model request and response bodies with Pydantic so validation and serialization are declarative (https://fastapi.tiangolo.com/tutorial/body/).
- Use `Depends()` for shared concerns (DB sessions, auth) instead of repeating logic in each endpoint (https://fastapi.tiangolo.com/tutorial/dependencies/).
- Use `async def` for I/O-bound handlers, but keep blocking calls out of the event loop (run them in a threadpool) (https://fastapi.tiangolo.com/async/).
- Set explicit `response_model` types to control and document output shapes (https://fastapi.tiangolo.com/tutorial/response-model/).

## Common pitfalls
- Running blocking/synchronous I/O directly inside an `async def` endpoint → blocks the event loop and kills concurrency; use `def` handlers (run in a threadpool) or async-native libraries (https://fastapi.tiangolo.com/async/).
- Returning ORM/raw objects without a `response_model` → may leak fields or fail serialization; declare a Pydantic response model.

## Examples
```python
from fastapi import FastAPI

app = FastAPI()

@app.get("/")
async def read_root():
    return {"Hello": "World"}
```

## Further reading
- https://fastapi.tiangolo.com/tutorial/ — full tutorial
- https://fastapi.tiangolo.com/deployment/ — deployment guide

## Related skills
- ../flask — lighter Python microframework
- ../django — batteries-included Python framework
