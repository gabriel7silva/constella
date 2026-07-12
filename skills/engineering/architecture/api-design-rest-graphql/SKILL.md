---
name: api-design-rest-graphql
description: REST design grounded in HTTP semantics (methods, status, idempotency) and GraphQL schema/query design; read when designing or reviewing an API.
domain: engineering
category: architecture
tags: [api-design, rest, graphql, http, schema]
official_sources:
  - https://www.rfc-editor.org/rfc/rfc9110.html
  - https://graphql.org/learn/
verified: 2026-06-16
---

# API Design: REST & GraphQL

## Overview
This skill covers two dominant API styles: REST, which builds on the standardized semantics of HTTP (methods, status codes, idempotency), and GraphQL, where clients request exactly the data they need against a typed schema. Read it when designing endpoints, choosing between the styles, or reviewing API contracts for correctness and consistency.

## Official sources
- RFC 9110 — HTTP Semantics (methods, status codes, safe/idempotent): https://www.rfc-editor.org/rfc/rfc9110.html
- GraphQL — official Learn guide: https://graphql.org/learn/

## Core concepts
- **HTTP methods (RFC 9110 §9)**: GET, HEAD, POST, PUT, DELETE, CONNECT, OPTIONS, TRACE — each with defined semantics; map resource operations onto them rather than inventing verbs.
- **Safe and idempotent methods**: safe methods (e.g. GET, HEAD) are not expected to change server state; idempotent methods (GET, HEAD, PUT, DELETE, etc.) produce the same effect whether sent once or many times — essential for safe retries.
- **Status codes (RFC 9110 §15)**: five classes — 1xx informational, 2xx success, 3xx redirection, 4xx client error, 5xx server error — communicate outcome semantically.
- **GraphQL schema and types**: the schema's type system describes exactly what data can be queried; the schema is the contract between client and server.
- **GraphQL operations**: queries read data, mutations modify data, and subscriptions stream updates; clients select precisely the fields they need.
- **GraphQL resolvers**: each field is backed by a resolver function that produces its value during execution.

## Best practices
- Honor HTTP semantics: use idempotent methods (PUT/DELETE) where clients may retry, and return status codes that match the actual outcome (per RFC 9110).
- Use GET only for safe, side-effect-free reads so caches and crawlers can call it without changing state.
- In GraphQL, design the schema around domain types and let clients select fields; avoid one-off endpoints — the schema is the single contract.
- Version and evolve deliberately: REST via URL/media-type versioning; GraphQL by adding fields and deprecating rather than breaking existing ones.

## Common pitfalls
- Using POST (or GET) for everything in REST → breaks idempotency and caching; pick the method that matches the operation's semantics.
- Returning 200 OK with an error body → clients and proxies cannot react correctly; use the appropriate 4xx/5xx status.
- Exposing unbounded GraphQL queries → deep/nested queries can overload the server; add depth/complexity limits and pagination.

## Examples
```http
# REST — idempotent update via PUT
PUT /users/42 HTTP/1.1
Content-Type: application/json

{ "name": "Ada", "email": "ada@example.com" }
# -> 200 OK (updated) or 201 Created; repeating yields the same result
```
```graphql
# GraphQL — client selects exactly the fields it needs
query {
  user(id: "42") {
    name
    email
  }
}
```

## Further reading
- GraphQL best practices (pagination, versioning, nullability): https://graphql.org/learn/best-practices/
- RFC 9110 method definitions (Section 9): https://www.rfc-editor.org/rfc/rfc9110.html#name-methods

## Related skills
- ../software-architecture-patterns — where APIs sit in service boundaries
- ../caching-strategies — HTTP caching and cache-aside for API responses
- ../data-modeling — shaping resources and types behind the API
