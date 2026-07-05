---
name: haskell
description: Haskell is a statically typed, purely functional, lazily evaluated language with type inference and monadic effects, compiled by GHC; consult when writing Haskell, installing the toolchain via GHCup, using Cabal or Stack, reasoning about type classes, monads, laziness, or pure functional design.
domain: language
category: language
tags: [haskell, functional, ghc, cabal, stack, type-classes, monads]
official_sources:
  - https://www.haskell.org/documentation/
  - https://gitlab.haskell.org/ghc/ghc
  - https://www.haskell.org/ghcup/install/
verified: 2026-06-17
---

# Haskell

## Overview
Haskell is a statically typed, purely functional language with global type inference, lazy (non-strict) evaluation, and effects tracked in the type system via monads. The reference compiler is GHC, and packages come from Hackage/Stackage. Read this when writing Haskell, setting up the toolchain with GHCup, building with Cabal or Stack, or reasoning about type classes, monads, and laziness.

## Official sources
- Docs: https://www.haskell.org/documentation/
- Repo: https://gitlab.haskell.org/ghc/ghc
- Install: https://www.haskell.org/ghcup/install/

## Install / setup
```bash
# GHCup installs GHC, Cabal, Stack, and HLS (Linux/macOS/WSL)
curl --proto '=https' --tlsv1.2 -sSf https://get-ghcup.haskell.org | sh
```
Command per https://www.haskell.org/ghcup/install/ (Windows uses the PowerShell bootstrap on the same page).

## Core concepts
- **Purity & referential transparency** — functions have no side effects; the same input always yields the same output.
- **Lazy evaluation** — expressions evaluate only when needed, enabling infinite data structures but requiring care with space.
- **Strong static types + inference** — the compiler infers most types; `Maybe`/`Either` encode absence and errors without exceptions.
- **Type classes** — ad-hoc polymorphism (`Eq`, `Ord`, `Functor`, `Monad`) constrain types by capability.
- **Monads & `do` notation** — sequence effectful computations (`IO`, `Maybe`, `State`) while staying pure.
- **Algebraic data types & pattern matching** — `data` declares sum/product types deconstructed by pattern match.
- **GHC & extensions** — the de-facto compiler; `{-# LANGUAGE ... #-}` pragmas enable language extensions.
- **Cabal / Stack** — build tools; Cabal uses `.cabal`/`cabal.project`, Stack pins curated Stackage snapshots.

## Best practices
- Manage the toolchain with GHCup and an editor using HLS for type-aware feedback (https://www.haskell.org/ghcup/steps/).
- Compile with `-Wall` and fix warnings; let types guide design (https://downloads.haskell.org/ghc/latest/docs/users_guide/using-warnings.html).
- Prefer total functions; use `Maybe`/`Either` over partial functions like `head` on possibly-empty lists (https://www.haskell.org/documentation/).
- Pin reproducible builds with a Stackage resolver or a Cabal freeze file (https://docs.haskellstack.org/).

## Common pitfalls
- Thunk buildup from lazy accumulators → use strict folds (`foldl'`) and `BangPatterns`/`seq` to force evaluation.
- Using partial functions (`head`, `fromJust`) on empty/`Nothing` values → pattern-match or use safe variants.
- Confusing `IO a` ordering → sequence effects with `do`/`>>=`; pure values never "run".

## Examples
```haskell
import Data.List (sortOn, group, sort)
import Data.Ord (Down(..))

wordFreq :: String -> [(String, Int)]
wordFreq = sortOn (Down . snd)
         . map (\ws -> (head ws, length ws))
         . group . sort . words
```

## Further reading
- https://www.haskell.org/documentation/ — official documentation hub
- https://downloads.haskell.org/ghc/latest/docs/users_guide/ — GHC user's guide
- https://hackage.haskell.org/ — central package repository

## Related skills
- ../clojure — another functional language built on immutability and pure functions
- ../erlang — functional language with a different (eager, concurrency-first) emphasis
