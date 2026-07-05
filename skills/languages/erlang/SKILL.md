---
name: erlang
description: Erlang is a functional, concurrent language built on the BEAM VM and OTP framework for fault-tolerant, distributed, soft-real-time systems using lightweight processes and message passing; consult when writing Erlang, using OTP behaviours (gen_server/supervisor), pattern matching, or building telecom-grade, highly available systems.
domain: language
category: language
tags: [erlang, beam, otp, concurrency, actor-model, distributed, fault-tolerant]
official_sources:
  - https://www.erlang.org/docs
  - https://github.com/erlang/otp
  - https://www.erlang.org/downloads
verified: 2026-06-17
---

# Erlang

## Overview
Erlang is a functional, concurrent language that runs on the BEAM virtual machine and ships with OTP, a framework for building fault-tolerant, distributed, soft-real-time systems. Concurrency is modeled with cheap isolated processes communicating by asynchronous message passing ("let it crash" with supervision). Read this when writing Erlang, using OTP behaviours like `gen_server` and `supervisor`, or building highly available distributed systems.

## Official sources
- Docs: https://www.erlang.org/docs
- Repo: https://github.com/erlang/otp
- Install: https://www.erlang.org/downloads

## Install / setup
```bash
# macOS (Homebrew); or use the installers/source at erlang.org/downloads
brew install erlang
erl  # start the Erlang shell
```
Install options per https://www.erlang.org/downloads (source build, prebuilt packages, kerl/asdf/mise are all documented there).

## Core concepts
- **Lightweight processes** — `spawn` creates isolated, scheduler-managed processes (not OS threads); millions can run.
- **Message passing** — processes communicate with `!` (send) and `receive`; no shared mutable state.
- **Pattern matching** — bind and destructure in function heads, `case`, and `receive` clauses.
- **Immutability & single assignment** — variables are bound once; data is immutable.
- **OTP behaviours** — `gen_server`, `supervisor`, `application`, and `gen_statem` encode proven design patterns.
- **Supervision trees & "let it crash"** — supervisors restart failed children rather than coding defensive error handling.
- **Hot code loading** — modules can be upgraded in a running system without downtime.
- **Distribution** — nodes connect transparently; remote sends look like local sends.

## Best practices
- Structure systems as supervision trees using OTP behaviours instead of raw `spawn` (https://www.erlang.org/doc/system/design_principles.html).
- Embrace "let it crash": handle the expected path, let supervisors recover from the unexpected (https://www.erlang.org/doc/system/sup_princ.html).
- Keep processes small and single-purpose; isolate state per process (https://www.erlang.org/docs).
- Use `gen_server` for stateful services rather than hand-rolling receive loops (https://www.erlang.org/doc/system/gen_server_concepts.html).

## Common pitfalls
- Unbounded mailbox growth from selective `receive` not matching messages → match all expected messages and drain/log unexpected ones.
- Treating processes as cheap shared-memory objects → they have isolated heaps; pass data via messages, copying cost matters for large terms.
- Blocking a `gen_server` callback with long work → offload to a worker/task process to keep the server responsive.

## Examples
```erlang
-module(counter).
-behaviour(gen_server).
-export([start_link/0, inc/0, get/0]).
-export([init/1, handle_call/3, handle_cast/2]).

start_link() -> gen_server:start_link({local, ?MODULE}, ?MODULE, 0, []).
inc()        -> gen_server:cast(?MODULE, inc).
get()        -> gen_server:call(?MODULE, get).

init(N)                  -> {ok, N}.
handle_cast(inc, N)      -> {noreply, N + 1}.
handle_call(get, _F, N)  -> {reply, N, N}.
```

## Further reading
- https://www.erlang.org/docs — official Erlang/OTP documentation hub
- https://www.erlang.org/doc/system/design_principles.html — OTP design principles
- https://www.erlang.org/course — getting-started course on erlang.org

## Related skills
- ../clojure — shares a functional, immutability-first philosophy on a VM
- ../haskell — another functional language; contrast pure/lazy vs concurrent/eager
