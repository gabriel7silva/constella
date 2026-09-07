---
name: go
description: Compiled, concurrent language for simple, reliable network services; consult for goroutines, modules, and tooling.
domain: language
category: language
tags: [go, golang, concurrency, goroutines, modules]
official_sources:
  - https://go.dev/doc/
  - https://github.com/golang/go
  - https://go.dev/dl/
verified: 2026-06-16
---

# Go

## Overview
Go is an open-source programming language that makes it easy to build simple, reliable, and efficient software. It is statically typed and compiled, ships with a garbage collector, and provides built-in concurrency primitives (goroutines and channels) designed for network services and tooling. Read this for the module system, concurrency model, and the standard toolchain.

## Official sources
- Docs: https://go.dev/doc/
- Repo: https://github.com/golang/go
- Install / download: https://go.dev/dl/

## Install / setup
Download the installer for your platform from https://go.dev/dl/ and follow the instructions at https://go.dev/doc/install. Verify the install:
```bash
go version
```

## Core concepts
- Goroutines and channels: lightweight concurrent functions started with `go`, communicating over typed channels ("share memory by communicating").
- Modules: dependency management via `go.mod`/`go.sum`; a module is a versioned collection of packages.
- Interfaces are implicit: a type satisfies an interface simply by implementing its methods — no explicit `implements`.
- Explicit error handling: functions return `error` values that callers check; no exceptions for ordinary control flow.
- Structs and methods: data is grouped in structs; methods attach to types via receivers; no class inheritance, composition instead.
- The standard toolchain: `go build`, `go run`, `go test`, `go fmt`, and `go vet` are part of the official distribution.
- Defer/panic/recover: `defer` schedules cleanup; `panic`/`recover` are for truly exceptional conditions, not normal errors.

## Best practices
- Format code with `gofmt`/`go fmt` — canonical formatting is part of the language culture and is non-negotiable in idiomatic Go.
- Handle every returned `error`; wrap with context using `fmt.Errorf("...: %w", err)` rather than discarding it.
- Use `context.Context` to carry cancellation and deadlines through call chains, especially for servers.
- Keep interfaces small and define them at the consumer; prefer composition over inheritance.

## Common pitfalls
- Ignoring returned errors (`val, _ := ...`) → silently drops failures; check and propagate them.
- Loop-variable capture in goroutines/closures → in older Go versions the variable was shared; capture explicitly or rely on the per-iteration scoping of recent Go.
- Unbuffered channel deadlocks → a send blocks until a receiver is ready; ensure a consumer exists or use buffering/`select`.
- Data races on shared state → guard with channels, `sync.Mutex`, or run `go test -race` to detect them.

## Examples
```go
package main

import (
	"fmt"
	"sync"
)

func main() {
	var wg sync.WaitGroup
	results := make(chan int, 3)
	for i := 1; i <= 3; i++ {
		wg.Add(1)
		go func(n int) {
			defer wg.Done()
			results <- n * n
		}(i)
	}
	wg.Wait()
	close(results)
	for r := range results {
		fmt.Println(r)
	}
}
```

## Further reading
- A Tour of Go: https://go.dev/tour/
- Effective Go: https://go.dev/doc/effective_go

## Related skills
- (sibling language skills under ../)
