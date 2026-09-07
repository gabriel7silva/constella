---
name: javascript
description: Dynamic, prototype-based language of the web (ECMAScript); consult for core semantics, async, and modern syntax.
domain: language
category: language
tags: [javascript, ecmascript, web, async, es modules]
official_sources:
  - https://developer.mozilla.org/en-US/docs/Web/JavaScript
  - https://github.com/tc39/ecma262
verified: 2026-06-16
---

# JavaScript

## Overview
JavaScript is a lightweight, interpreted (or just-in-time compiled) programming language with first-class functions. Best known as the scripting language of web pages, it also runs in many non-browser environments such as Node.js. It is a prototype-based, garbage-collected, dynamic, multi-paradigm language standardized as ECMAScript. Read this for core language semantics, asynchronous patterns, and modern module syntax.

## Official sources
- Docs (reference): https://developer.mozilla.org/en-US/docs/Web/JavaScript
- Language standard repo (ECMA-262 / TC39): https://github.com/tc39/ecma262

## Core concepts
- Dynamic typing: variables are not bound to a type; values carry types and can change. Primitives include string, number, bigint, boolean, undefined, null, symbol; everything else is an object.
- First-class functions and closures: functions are values that can be passed, returned, and capture their lexical scope.
- Prototype-based inheritance: objects inherit directly from other objects via the prototype chain; `class` syntax is sugar over prototypes.
- The event loop and asynchronous model: single-threaded with non-blocking I/O via callbacks, Promises, and `async`/`await`.
- Scoping and hoisting: `let`/`const` are block-scoped (with a temporal dead zone); `var` is function-scoped; declarations are hoisted.
- Strict equality vs. coercion: `===` compares without type coercion; `==` performs coercion and is a frequent source of surprises.
- ES modules: `import`/`export` provide the standardized module system across browsers and Node.js.

## Best practices
- Prefer `const` by default and `let` when reassignment is needed; avoid `var` to escape function-scope and hoisting surprises (per MDN guidance).
- Use strict equality (`===` / `!==`) rather than loose equality to avoid implicit coercion bugs.
- Handle Promise rejections — `await` inside `try/catch`, or attach `.catch()` — to avoid unhandled rejections.
- Use ES module `import`/`export` for clear, statically analyzable dependencies.

## Common pitfalls
- Relying on `this` binding inside detached callbacks → use arrow functions (which capture lexical `this`) or bind explicitly.
- Loose equality and truthiness surprises (`0`, `""`, `null`, `undefined`, `NaN`) → use `===` and explicit checks.
- Floating-point arithmetic precision (e.g. `0.1 + 0.2 !== 0.3`) → round for display or use integer/bigint math where exactness matters.
- Mutating shared objects/arrays unexpectedly → copy (spread, structuredClone) before mutating when isolation is needed.

## Examples
```javascript
async function fetchUser(id) {
  try {
    const res = await fetch(`/api/users/${id}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error("fetchUser failed", err);
    throw err;
  }
}
```

## Further reading
- MDN JavaScript Guide: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide
- ECMAScript draft spec: https://tc39.es/ecma262/

## Related skills
- ../typescript — typed superset that compiles to JavaScript
