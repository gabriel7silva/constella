---
name: web-performance-core-vitals
description: Measure and optimize Core Web Vitals (LCP, INP, CLS) for real-user front-end performance; consult when tuning page load and interactivity.
domain: engineering
category: performance
tags: [web-vitals, lcp, inp, cls, frontend, rum, performance]
official_sources:
  - https://web.dev/articles/vitals
  - https://github.com/GoogleChrome/web-vitals
verified: 2026-06-16
---

# Web Performance: Core Web Vitals

## Overview
Core Web Vitals are the subset of Web Vitals that Google considers essential signals of real-user experience: loading (LCP), interactivity (INP), and visual stability (CLS). Read this when you need to measure page performance against objective field thresholds and prioritize fixes that affect actual users rather than synthetic lab scores alone.

## Official sources
- Docs: https://web.dev/articles/vitals
- Optimize LCP guide: https://web.dev/articles/optimize-lcp
- MDN performance hub: https://developer.mozilla.org/en-US/docs/Web/Performance
- Repo (measurement library): https://github.com/GoogleChrome/web-vitals
- Install / download: https://www.npmjs.com/package/web-vitals

## Install / setup
```bash
npm install web-vitals
```

## Core concepts
- **The three Core Web Vitals.** LCP (Largest Contentful Paint) measures loading, INP (Interaction to Next Paint) measures interactivity, and CLS (Cumulative Layout Shift) measures visual stability.
- **"Good" thresholds at the 75th percentile.** Per web.dev: LCP within 2.5 s, INP of 200 ms or less, CLS of 0.1 or less — assessed at the 75th percentile of page loads, split across mobile and desktop.
- **Field (RUM) vs lab data.** Core Web Vitals are defined against real-user (field) data such as the Chrome User Experience Report; lab tools like Lighthouse approximate but cannot replace field measurement.
- **LCP load breakdown.** web.dev decomposes LCP into time to first byte, resource load delay, resource load duration, and element render delay — optimizing LCP is largely about loading the LCP resource sooner and faster.
- **Layout shift scoring.** CLS sums layout shift scores (impact fraction x distance fraction) from unexpected shifts; shifts within 500 ms of user input are excluded.
- **Performance APIs.** Browsers expose timing via the Navigation Timing, Resource Timing, and Long Animation Frame APIs (see MDN), which the web-vitals library reads through `PerformanceObserver`.

## Best practices
- **Measure with the official library on real users.** Use `web-vitals` (`onLCP`, `onINP`, `onCLS`) with its `buffered` PerformanceObserver flag so metrics match Chrome's own reporting; send results to your analytics endpoint.
- **Make the LCP resource discoverable early.** Per the optimize-LCP guide, include it in the initial HTML, set appropriate `fetchpriority`, and avoid loading it via JavaScript that delays discovery.
- **Reserve space to prevent CLS.** Set explicit `width`/`height` (or `aspect-ratio`) on images and media, and avoid inserting content above existing content after load.
- **Reduce main-thread work for INP.** Break up long tasks and minimize JavaScript executed during interactions so the next paint after an input happens within 200 ms.
- **Cut TTFB.** Minimize redirects and serve cacheable HTML from CDN edge servers, since TTFB is the floor for LCP.

## Common pitfalls
- **Optimizing only lab scores** → Lighthouse is a lab approximation; ship against field/CrUX data because that is what Core Web Vitals are measured on.
- **Treating averages as the target** → thresholds are evaluated at the 75th percentile across devices; a good average can still fail at p75 on slow mobile.
- **Lazy-loading the LCP image** → deferring the largest above-the-fold element delays its load and inflates LCP; eager-load it instead.
- **Ignoring INP because FID looked fine** → INP replaced FID as a Core Web Vital and considers all interactions across the page lifecycle, not just the first input.

## Examples
```js
import { onLCP, onINP, onCLS } from 'web-vitals';

function send(metric) {
  // metric: { name, value, rating, delta, id }
  navigator.sendBeacon('/analytics', JSON.stringify(metric));
}

onLCP(send);
onINP(send);
onCLS(send);
```

## Further reading
- https://web.dev/articles/optimize-lcp — optimizing LCP step by step
- https://web.dev/articles/cls — understanding and reducing layout shift
- https://developer.mozilla.org/en-US/docs/Web/Performance — MDN performance guides and APIs

## Related skills
- ../profiling-and-benchmarking — measuring before optimizing, browser profilers
- ../backend-performance — server-side TTFB and load handling that feeds LCP
