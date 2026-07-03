---
name: code-optimization
description: Making code faster the right way — measure first, fix algorithms before micro-optimizing, and validate with benchmarks.
domain: engineering
category: practices
tags: [performance, optimization, profiling, benchmarking, algorithms]
official_sources:
  - https://developer.mozilla.org/en-US/docs/Web/Performance
  - https://en.algorithmica.org/hpc/
verified: 2026-06-16
---

# Code Optimization

## Overview
Code optimization is making software faster or lighter without breaking correctness — but only where measurement shows it matters. Consult this when something is genuinely slow, before reaching for a rewrite. MDN's Web Performance pages cover measuring and budgeting on the web; Algorithmica's "Algorithms for Modern Hardware" covers profiling, benchmarking, and low-level optimization on modern CPUs.

## Official sources
- Docs (web performance): https://developer.mozilla.org/en-US/docs/Web/Performance
- Docs (high-performance computing): https://en.algorithmica.org/hpc/
- Repo (Algorithmica): https://github.com/algorithmica-org/algorithmica

## Core concepts
- **Measure first.** Before optimizing, establish a baseline with real tools and metrics; MDN's overarching guidance is to measure your actual performance before changing anything.
- **Profiling vs. benchmarking.** Profiling finds *where* time goes (instrumentation, statistical sampling, machine-code analysis — covered in Algorithmica's profiling chapter); benchmarking measures *whether* a specific change actually helped.
- **Algorithms still dominate, but not alone.** Asymptotic complexity (Big-O) is the first lever, yet Algorithmica stresses that on modern hardware it is no longer the sole deciding factor — constant factors and hardware behavior matter.
- **The memory hierarchy / cache.** Access patterns and CPU caching often determine real speed; cache-friendly layouts can beat algorithmically "equal" code (Algorithmica devotes a section to caching and memory).
- **Performance budgets.** MDN recommends setting budgets — explicit limits on metrics like load time or bundle size — to prevent regressions over time.
- **Measure user-perceived performance.** MDN notes that what matters is how users perceive performance (RUM, perceived metrics), not just raw milliseconds.

## Best practices
- **Profile to find the real bottleneck, then optimize that.** Optimize the hot path the profiler identifies rather than guessing; most code is not on the critical path.
- **Improve the algorithm/data structure before micro-optimizing.** A better Big-O usually beats hand-tuning a poor algorithm; reach for SIMD/cache tricks only after the algorithm is right.
- **Benchmark every change.** Confirm each optimization is a real, repeatable speedup (and didn't regress correctness) before keeping it.
- **Set and enforce a performance budget.** Use budgets in CI/monitoring so performance gains don't silently erode (MDN performance budgets).

## Common pitfalls
- **Optimizing without measuring** → profile first; intuition about the bottleneck is frequently wrong, and effort lands off the hot path.
- **Micro-optimizing a bad algorithm** → fix the algorithm/data structure first; constant-factor tweaks can't fix a quadratic loop.
- **Trusting a one-shot timing** → benchmark with repetition and a stable setup; noise and warm-up effects make single runs misleading.
- **Sacrificing correctness/readability for speed off the hot path** → only trade clarity for performance where measurement proves it matters.

## Examples
```javascript
// O(n^2): membership check inside a loop
const dupes = a.filter(x => b.includes(x));   // includes scans b each time

// O(n): hoist the lookups into a Set — algorithmic win, then measure
const bSet = new Set(b);
const dupes2 = a.filter(x => bSet.has(x));
// Verify with a benchmark before assuming it's faster for your input sizes.
```

## Further reading
- MDN — Measuring performance: https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Performance/Measuring_performance
- Algorithmica — Profiling: https://en.algorithmica.org/hpc/profiling/

## Related skills
- ../clean-code — keep optimized code readable; document non-obvious perf tradeoffs
- ../refactoring — restructure safely under test before/after optimizing
