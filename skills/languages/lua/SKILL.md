---
name: lua
description: Lua is a small, fast, dynamically typed scripting language designed to be embedded in host applications via a clean C API, with tables as its sole data-structuring mechanism; consult when writing Lua, embedding/extending it from C, using metatables, coroutines, or scripting games, Neovim, Redis, or nginx.
domain: language
category: language
tags: [lua, scripting, embedded, dynamic, tables, coroutines, c-api]
official_sources:
  - https://www.lua.org/manual/5.5/
  - https://www.lua.org/
  - https://www.lua.org/download.html
verified: 2026-06-17
---

# Lua

## Overview
Lua is a lightweight, dynamically typed scripting language built around a single data structure (the table) and designed to be embedded into host programs through a small, well-documented C API. It is fast, portable (pure ISO C), and widely used for game scripting, Neovim config, Redis, and nginx (OpenResty). Read this when writing Lua, embedding or extending it from C, or using metatables and coroutines.

## Official sources
- Docs: https://www.lua.org/manual/5.5/
- Home: https://www.lua.org/ — the authoritative source for Lua is lua.org, not GitHub
- Install: https://www.lua.org/download.html
- Mirror (unofficial): https://github.com/lua/lua — read-only mirror of Lua dev code, "mirrored irregularly"; no PRs accepted (see its README). Official releases come from lua.org.

## Install / setup
```bash
curl -L -R -O https://www.lua.org/ftp/lua-5.5.0.tar.gz
tar zxf lua-5.5.0.tar.gz
cd lua-5.5.0
make all test
```
Build steps per https://www.lua.org/download.html (Lua compiles unmodified on any platform with an ISO C compiler).

## Core concepts
- **Tables** — the only structured type; serve as arrays, dictionaries, objects, and namespaces.
- **Metatables & metamethods** — `__index`, `__newindex`, `__add`, etc., customize behavior and implement OOP/inheritance.
- **First-class functions & closures** — functions are values with lexical scoping over `upvalues`.
- **Coroutines** — cooperative multitasking via `coroutine.create`/`resume`/`yield`; not OS threads.
- **The C API & stack** — host programs push/pop Lua values on a virtual stack to call into and out of Lua.
- **1-based indexing** — arrays and string positions start at 1, not 0.
- **`nil` and truthiness** — only `nil` and `false` are falsy; `0` and `""` are truthy.
- **Lua vs LuaJIT** — reference Lua (lua.org) vs the separate high-performance JIT implementation.

## Best practices
- Localize frequently used globals (`local sqrt = math.sqrt`) for speed and clarity (https://www.lua.org/manual/5.5/).
- Use `pcall`/`xpcall` to handle runtime errors instead of letting them propagate (https://www.lua.org/manual/5.5/manual.html#pdf-pcall).
- Implement OOP with metatables and `__index` rather than copying methods per instance (https://www.lua.org/pil/16.html).
- When embedding, always balance the C API stack and check `lua_pcall` return codes (https://www.lua.org/manual/5.5/manual.html#4).

## Common pitfalls
- Assuming 0-based indexing → Lua arrays/strings are 1-based; iterate with `ipairs` for sequences.
- Treating `0` or `""` as false → only `nil`/`false` are falsy; test explicitly with `== nil`.
- Holes in a "sequence" table breaking `#t` and `ipairs` → keep array tables contiguous or track length yourself.

## Examples
```lua
-- Metatable-based class
local Account = {}
Account.__index = Account

function Account.new(balance)
  return setmetatable({ balance = balance or 0 }, Account)
end

function Account:deposit(n) self.balance = self.balance + n end

local a = Account.new(100)
a:deposit(50)
print(a.balance)  --> 150
```

## Further reading
- https://www.lua.org/manual/5.5/ — Lua 5.5 reference manual (language, libraries, C API)
- https://www.lua.org/pil/ — Programming in Lua (first edition, online)
- https://www.lua.org/docs.html — documentation index

## Related skills
- ../c — Lua is written in ISO C and embeds through its C API
- ../clojure — fellow dynamically typed, functional-leaning language
