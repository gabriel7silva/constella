---
name: elixir
description: Dynamic, functional language on the BEAM (Erlang VM) for scalable, fault-tolerant apps; consult for syntax, OTP, and setup.
domain: language
category: language
tags: [elixir, functional, beam, erlang, concurrency]
official_sources:
  - https://elixir-lang.org/docs.html
  - https://github.com/elixir-lang/elixir
verified: 2026-06-16
---

# Elixir

## Overview
Elixir is a dynamic, functional language designed for building scalable and maintainable applications, running on the Erlang VM (BEAM) and inheriting its lightweight-process concurrency and fault tolerance. It pairs an approachable Ruby-influenced syntax with OTP's battle-tested distribution and supervision model. Read this when writing Elixir, structuring OTP applications, or setting up the toolchain.

## Official sources
- Docs: https://elixir-lang.org/docs.html
- Repo: https://github.com/elixir-lang/elixir
- Install / download: https://elixir-lang.org/install.html

## Install / setup
The official install page lists install scripts as the quickest method. Verbatim (Bash):

```bash
curl -fsSO https://elixir-lang.org/install.sh && sh install.sh elixir@1.20.1 otp@28.4
```

PowerShell (Windows), verbatim from the same page:

```powershell
curl.exe -fsSO https://elixir-lang.org/install.bat && .\install.bat elixir@1.20.1 otp@28.4
```

Source: https://elixir-lang.org/install.html (Homebrew alternative: `brew install elixir`)

## Core concepts
- Immutability — data is never mutated in place; functions return new transformed values.
- Pattern matching — the `=` match operator and function-head matching destructure and branch on data shape.
- The pipe operator `|>` — threads a value through a series of function calls for readable data pipelines.
- Processes and the actor model — lightweight BEAM processes communicate by message passing, not shared memory.
- OTP behaviours — GenServer, Supervisor, and Application provide standard patterns for stateful, supervised, fault-tolerant systems.
- Mix — the build tool for creating projects, running tasks, managing dependencies (Hex), and testing.

## Best practices
- Embrace the "let it crash" philosophy: supervise processes so failures restart cleanly rather than defensively guarding every error.
- Use pattern matching in function heads instead of nested conditionals for clear, declarative branching.
- Structure work into small pure functions and compose them with the pipe operator.
- Use Mix and the Hex package manager for dependencies and project tasks.

## Common pitfalls
- Treating BEAM processes like OS threads or assuming shared mutable state → state lives inside a process and is changed only via messages.
- Overusing `try/rescue` for control flow → prefer pattern matching and supervisors ("let it crash").
- Blocking a GenServer's single message loop with long synchronous work → offload heavy work to a separate process or Task.

## Examples
```elixir
defmodule Greeter do
  def greet(name), do: "Hello, #{name}"
end

["ada", "grace"]
|> Enum.map(&String.capitalize/1)
|> Enum.each(&IO.puts(Greeter.greet(&1)))
```

## Further reading
- Getting started & guides: https://elixir-lang.org/docs.html
- Installation details and version managers: https://elixir-lang.org/install.html

## Related skills
- ../ruby — syntactic inspiration for Elixir
- ../scala — another language emphasizing functional programming on a managed VM
