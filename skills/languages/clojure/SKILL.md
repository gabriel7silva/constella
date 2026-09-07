---
name: clojure
description: Clojure is a dynamic, functional Lisp dialect on the JVM with immutable persistent data structures and strong concurrency support; consult when writing Clojure, using the Clojure CLI/deps.edn or Leiningen, working with the REPL, transducers, atoms/refs/agents, or interop with Java and ClojureScript.
domain: language
category: language
tags: [clojure, lisp, jvm, functional, repl, deps-edn, clojurescript]
official_sources:
  - https://clojure.org/
  - https://github.com/clojure/clojure
  - https://clojure.org/guides/install_clojure
verified: 2026-06-17
---

# Clojure

## Overview
Clojure is a dynamic, functional Lisp that compiles to JVM bytecode (with ClojureScript targeting JavaScript), built around immutable persistent data structures and a REPL-driven workflow. It emphasizes pure functions, explicit state, and easy Java interop. Read this when writing Clojure, setting up the CLI/deps.edn, using the REPL, or reasoning about its concurrency primitives.

## Official sources
- Docs: https://clojure.org/
- Repo: https://github.com/clojure/clojure
- Install: https://clojure.org/guides/install_clojure

## Install / setup
```bash
# macOS (Homebrew); Java 11+ required
brew install clojure/tools/clojure
clj  # start a REPL
```
Command per https://clojure.org/guides/install_clojure (Linux uses the `linux-install.sh` script from the same page).

## Core concepts
- **Immutable persistent data structures** — lists, vectors, maps, sets are values; "updates" return new structures via structural sharing.
- **REPL-driven development** — evaluate forms interactively against a running program; the core of the Clojure workflow.
- **Homoiconicity & macros** — code is data (s-expressions); `defmacro` transforms forms at compile time.
- **deps.edn & the CLI** — `clj`/`clojure` resolve dependencies from `deps.edn`; tools.deps is the official build/run mechanism.
- **Sequences & laziness** — the `seq` abstraction plus lazy sequences over collections; `map`/`filter`/`reduce` are universal.
- **Concurrency primitives** — `atom` (uncoordinated sync state), `ref`+`dosync` (STM), `agent` (async), `volatile`.
- **Java interop** — call any Java via `(.method obj)`, `(Class/staticMethod)`, and `(new Class)` / `Class.`.
- **Transducers** — composable, source-independent transformations decoupled from input/output collections.

## Best practices
- Drive development from the REPL; reload changed namespaces rather than restarting (https://clojure.org/guides/repl/introduction).
- Prefer pure functions on immutable data; isolate state in `atom`/`ref` and mutate explicitly (https://clojure.org/reference/atoms).
- Use `deps.edn` aliases for tasks (test, build, run) instead of ad-hoc scripts (https://clojure.org/guides/deps_and_cli).
- Add type/shape checks with `clojure.spec` at boundaries (https://clojure.org/guides/spec).

## Common pitfalls
- Holding the head of a large lazy seq → memory blowup; consume eagerly with `doall`/`reduce` or avoid retaining the binding.
- Expecting side effects inside lazy `map` to run → use `doseq`/`run!` for effects, not lazy sequences.
- Confusing `=` (value equality) with `identical?` (reference) on immutable values → use `=`.

## Examples
```clojure
(defn word-freq [text]
  (->> (re-seq #"\w+" text)
       (map clojure.string/lower-case)
       (frequencies)
       (sort-by val >)))

(word-freq "the cat the dog the cat")
;; => ([\"the\" 3] [\"cat\" 2] [\"dog\" 1])
```

## Further reading
- https://clojure.org/reference/documentation — official language reference index
- https://clojuredocs.org/ — community examples for core functions
- https://clojure.org/guides/deps_and_cli — deps.edn and CLI guide

## Related skills
- ../haskell — another functional language emphasizing immutability and pure functions
- ../erlang — shares a focus on concurrency and the actor/process model
- ../lua — fellow dynamically typed embeddable language
