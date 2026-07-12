---
name: beam
description: The BEAM (Erlang/OTP VM) running Erlang and Elixir — built for massively scalable, fault-tolerant, soft real-time systems. Consult for concurrent/HA services.
domain: stack
category: runtime
tags: [beam, erlang, elixir, otp, concurrency, fault-tolerance]
official_sources:
  - https://www.erlang.org/docs
  - https://github.com/erlang/otp
verified: 2026-06-16
---

# BEAM (Erlang/OTP VM)

## Overview
The BEAM is the virtual machine in Erlang/OTP that executes Erlang and Elixir code. Erlang is designed for building massively scalable soft real-time systems with high-availability requirements. OTP is the runtime system plus a set of libraries and design principles for building robust concurrent applications. Read this when building fault-tolerant, highly concurrent, or distributed services.

## Official sources
- Docs: https://www.erlang.org/docs
- Repo: https://github.com/erlang/otp
- Install / download: https://www.erlang.org/downloads

## Install / setup
Install via a package manager (commands shown on the official downloads page):

```bash
brew install erlang      # macOS (Homebrew)
apt-get install erlang   # Ubuntu/Debian
```

Or build from source per the official build instructions:

```bash
./configure && make && make install
```

Verify the install by starting the shell with `erl` (the downloads page also lists version managers such as kerl, asdf, and mise).

## Core concepts
- Lightweight processes: BEAM schedules huge numbers of isolated processes that share no memory and communicate by message passing.
- "Let it crash": processes fail fast and are restarted by supervisors rather than defensively handling every error.
- OTP behaviours (`gen_server`, supervisors, applications) encode proven patterns for concurrent, supervised systems.
- Preemptive per-process scheduling gives soft real-time, low-latency responsiveness under load.
- Built-in distribution lets nodes connect and processes communicate across machines transparently.
- Hot code loading allows updating running systems without full restarts.

## Best practices
- Structure applications around supervision trees so failures are isolated and recovered automatically.
- Build stateful concurrency on OTP behaviours (e.g. `gen_server`) rather than ad-hoc process loops.
- Keep processes small and single-purpose to maximize isolation and fault containment.
- Prefer immutable message passing over shared state, in line with the actor model.

## Common pitfalls
- Writing defensive try/catch everywhere instead of leveraging supervisors → adopt "let it crash" with supervision.
- Building bespoke process plumbing instead of OTP behaviours → reuse `gen_server`/supervisor patterns.
- Large messages copied between processes → keep messages small since processes do not share memory.

## Examples
```erlang
% Spawn a process and send it a message
Pid = spawn(fun() ->
    receive Msg -> io:format("got: ~p~n", [Msg]) end
end),
Pid ! hello.
```

## Further reading
- OTP design principles: https://www.erlang.org/doc/system/design_principles.html
- Documentation hub: https://www.erlang.org/docs

## Related skills
- ../jvm — alternative VM for concurrent, long-running services
