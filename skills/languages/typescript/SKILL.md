---
name: typescript
description: Typed superset of JavaScript that compiles to plain JS; consult for type system, tsconfig, and compiler usage.
domain: language
category: language
tags: [typescript, javascript, types, compiler, tsc]
official_sources:
  - https://www.typescriptlang.org/docs/
  - https://github.com/microsoft/TypeScript
  - https://www.typescriptlang.org/download
verified: 2026-06-16
---

# TypeScript

## Overview
TypeScript is a strongly typed programming language that builds on JavaScript by adding optional static types, then compiles down to plain JavaScript that runs anywhere JavaScript runs. It catches whole classes of errors before runtime and powers richer editor tooling for large-scale applications. Read this when configuring a TypeScript build, designing types, or debugging compiler errors.

## Official sources
- Docs: https://www.typescriptlang.org/docs/
- Repo: https://github.com/microsoft/TypeScript
- Install / download: https://www.typescriptlang.org/download

## Install / setup
```bash
npm install typescript --save-dev
```

## Core concepts
- Structural typing: types are compatible based on their shape (members), not their declared name; an object satisfying an interface's members is assignable to it.
- Type annotations and inference: annotate variables, parameters, and return types, but lean on the compiler's inference where it already knows the type.
- Interfaces and type aliases: model object shapes and unions; `interface` is open to declaration merging, `type` can express unions, intersections, and mapped types.
- Generics: write reusable, type-safe components and functions parameterized over types (`Array<T>`, `Promise<T>`).
- Union, intersection, and literal types: combine types and narrow them with control-flow analysis (type guards) to model precise states.
- `tsconfig.json`: the project configuration file controlling the compiler — target, module system, `strict` flags, and which files are included.
- The `tsc` compiler: type-checks and emits JavaScript; type errors do not necessarily block emit unless configured to.

## Best practices
- Enable `strict` mode in `tsconfig.json` — it turns on the full family of strict type-checking options recommended by the docs for catching more bugs.
- Prefer letting the compiler infer types for locals; annotate public API boundaries (function signatures, exported values) explicitly.
- Avoid `any`; prefer `unknown` when a value's type is genuinely not known, then narrow it before use.
- Use union types and discriminated unions plus exhaustiveness checking instead of loose runtime type juggling.

## Common pitfalls
- Treating TypeScript types as runtime values → types are erased at compile time; use runtime checks (`typeof`, validation libraries) for runtime guarantees.
- Assuming a clean `tsc` build means the JS won't run on errors → by default emit can still occur; use `noEmitOnError` if you want errors to block output.
- Overusing `any` to silence errors → it disables checking and propagates; prefer `unknown`, generics, or proper narrowing.

## Examples
```typescript
interface User {
  id: number;
  name: string;
}

function greet(user: User): string {
  return `Hello, ${user.name}`;
}

const u: User = { id: 1, name: "Ada" };
console.log(greet(u));
```

## Further reading
- TypeScript Handbook: https://www.typescriptlang.org/docs/handbook/intro.html
- tsconfig reference: https://www.typescriptlang.org/tsconfig/

## Related skills
- ../javascript — the language TypeScript compiles to
