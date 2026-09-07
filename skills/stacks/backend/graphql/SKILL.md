---
name: graphql
description: GraphQL — a query language and server-side runtime for APIs where clients request exactly the fields they need from a strongly-typed schema. Consult when designing a schema (SDL), writing queries/mutations/subscriptions, building a resolver-based server (graphql-js, Apollo), avoiding over/under-fetching, or referencing the GraphQL specification.
domain: stack
category: backend
tags: [graphql, api, schema, resolvers, query-language, graphql-js, backend]
official_sources:
  - https://graphql.org/learn/
  - https://github.com/graphql/graphql-spec
  - https://www.graphql-js.org/docs/getting-started/
verified: 2026-06-17
---

# GraphQL

## Overview
GraphQL is an open-source query language for APIs plus a runtime that fulfills those queries against a typed schema. Clients ask for exactly the fields they need in one request, eliminating over- and under-fetching common to REST. It is transport- and database-agnostic — resolvers fetch data from any backend. Read this when designing a schema, writing resolvers, or choosing a GraphQL server.

## Official sources
- Docs: https://graphql.org/learn/
- Repo: https://github.com/graphql/graphql-spec
- Install: https://www.graphql-js.org/docs/getting-started/

## Install / setup
```bash
# Reference JavaScript implementation:
npm install graphql --save
```
Source: https://www.graphql-js.org/docs/getting-started/ (graphql-js is the official JS implementation: parser, type system, validator, executor).

## Core concepts
- **Schema (SDL)** — the typed contract; `type`, `Query`, `Mutation`, `Subscription` define the API surface.
- **Types** — scalars, objects, enums, interfaces, unions, input types, and non-null/list modifiers.
- **Operations** — queries (read), mutations (write), subscriptions (real-time streams).
- **Resolvers** — functions that return the data for each field; the heart of execution.
- **Fields & arguments** — clients select fields and pass typed arguments per field.
- **Introspection** — the schema is self-describing; tools like GraphiQL query it.
- **Single endpoint** — typically one POST endpoint (e.g. `/graphql`) for all operations.
- **Fragments & variables** — reusable field sets and parameterized, cacheable queries.

## Best practices
- Design the schema around client/product needs, not your database tables (https://graphql.org/learn/schema/).
- Solve N+1 resolver fan-out with batching/caching (DataLoader) (https://graphql.org/learn/best-practices/).
- Use cursor-based (connections) pagination for lists (https://graphql.org/learn/pagination/).
- Return structured `errors` and prefer nullable fields for partial failures (https://graphql.org/learn/best-practices/).

## Common pitfalls
- N+1 queries when a list resolver hits the DB per item → batch with DataLoader.
- Unbounded query depth/complexity enables DoS → add depth/complexity limits and timeouts.
- Exposing a single `/graphql` makes per-resource HTTP caching hard → use persisted queries / response caching.

## Examples
```javascript
import { graphql, buildSchema } from 'graphql';

const schema = buildSchema(`type Query { hello: String }`);
const rootValue = { hello: () => 'Hello world!' };

graphql({ schema, source: '{ hello }', rootValue })
  .then((res) => console.log(res));
// { data: { hello: 'Hello world!' } }
```

## Further reading
- https://spec.graphql.org/ — the formal GraphQL specification versions
- https://graphql.org/community/tools-and-libraries/ — servers and clients per language

## Related skills
- ../spring — expose a GraphQL API from a Spring backend (Spring for GraphQL)
- ../nginx — reverse-proxy a GraphQL server behind Nginx
