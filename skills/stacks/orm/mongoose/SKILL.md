---
name: mongoose
description: MongoDB object modeling (ODM) for Node.js with schemas, validation, and middleware; consult for structured MongoDB access in JS/TS.
domain: stack
category: orm
tags: [odm, mongodb, nodejs, javascript, typescript, schema]
official_sources:
  - https://mongoosejs.com/docs/
  - https://github.com/Automattic/mongoose
verified: 2026-06-16
---

# Mongoose

## Overview
Mongoose is an Object Data Modeling (ODM) library for MongoDB designed to work in an asynchronous environment. It adds schemas, type casting, validation, query building, and middleware on top of the MongoDB driver. Read this when you want structure and validation around an otherwise schemaless MongoDB database in Node.js (or Deno).

## Official sources
- Docs: https://mongoosejs.com/docs/
- Repo: https://github.com/Automattic/mongoose
- Install / index: https://mongoosejs.com/docs/index.html

## Install / setup
```bash
npm install mongoose
```

## Core concepts
- **Schema**: defines document shape, types, defaults, and validation rules for a collection.
- **Model**: a constructor compiled from a schema (`mongoose.model()`) used to create and query documents.
- **Documents**: model instances with getters/setters, validation, and `.save()`.
- **Queries**: chainable query builder (`Model.find().where()...`) returning thenable queries.
- **Middleware (hooks)**: `pre`/`post` hooks on operations like `save`/`validate` for cross-cutting logic.
- **Population**: `populate()` resolves referenced documents across collections (Mongoose's join-like feature).

## Best practices
- Call `mongoose.connect()` once at startup and reuse the connection; Mongoose buffers operations until connected.
- Define validation and required fields in the schema so invalid documents are rejected before write.
- Use `lean()` for read-only queries to skip hydrating full Mongoose documents and improve performance.
- Use `populate()` selectively (with field selection) to avoid pulling large referenced documents.

## Common pitfalls
- Relying on `populate()` like a SQL join for heavy relational workloads → it issues extra queries; model data access patterns accordingly.
- Expecting MongoDB to enforce the schema → only Mongoose enforces it; writes via the raw driver bypass validation.

## Examples
```js
const mongoose = require('mongoose')
await mongoose.connect(process.env.MONGODB_URI)

const userSchema = new mongoose.Schema({ name: { type: String, required: true } })
const User = mongoose.model('User', userSchema)

const ada = await User.create({ name: 'Ada' })
const users = await User.find({ name: 'Ada' }).lean()
```

## Further reading
- https://mongoosejs.com/docs/guide.html — schemas guide
- https://mongoosejs.com/docs/populate.html — population

## Related skills
- ../prisma — also supports MongoDB with a typed client
- ../sequelize — ORM for SQL databases (contrast: relational vs document)
