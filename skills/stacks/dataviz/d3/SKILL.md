---
name: d3
description: D3.js (Data-Driven Documents) is a low-level JavaScript library for binding data to the DOM/SVG/Canvas and building bespoke, fully custom interactive data visualizations. Consult when you need hand-crafted charts, scales, axes, transitions, geo/map projections, force layouts, or custom SVG dataviz that off-the-shelf chart libraries can't express.
domain: stack
category: dataviz
tags: [d3, d3js, dataviz, javascript, svg, charts, visualization]
official_sources:
  - https://d3js.org/getting-started
  - https://github.com/d3/d3
  - https://www.npmjs.com/package/d3
verified: 2026-06-17
---

# D3.js

## Overview
D3.js (Data-Driven Documents) is a low-level JavaScript library for manipulating documents based on data. It gives you scales, selections, axes, shapes, transitions, layouts, and geo projections so you can build any visualization you can imagine—but you draw the marks yourself (SVG/Canvas). Read this when you need fully custom, interactive, or animated charts beyond what high-level libraries like Chart.js or Plotly offer.

## Official sources
- Docs: https://d3js.org/getting-started
- Repo: https://github.com/d3/d3
- Install: https://www.npmjs.com/package/d3

## Install / setup
```bash
npm install d3
```
Command from the official getting-started guide (https://d3js.org/getting-started); for browser-only use, import the ESM bundle from `https://cdn.jsdelivr.net/npm/d3@7/+esm`.

## Core concepts
- **Selections** — `d3.select`/`selectAll` wrap DOM nodes for declarative manipulation and the enter/update/exit data-join pattern.
- **Data join** — `selection.data(arr).join("rect")` binds data to elements, creating, updating, and removing nodes to match.
- **Scales** — `d3.scaleLinear`, `scaleBand`, `scaleTime`, `scaleOrdinal` map data domains to visual ranges (pixels, colors).
- **Axes** — `d3.axisBottom(scale)` renders ticks/labels from a scale into an SVG group.
- **Shape generators** — `d3.line`, `d3.arc`, `d3.area`, `d3.pie` produce SVG path strings from data.
- **Transitions** — `selection.transition().duration(...)` interpolates attributes/styles for animation.
- **Modules** — D3 is a collection of independent packages (d3-array, d3-scale, d3-geo…) importable individually.
- **Geo** — `d3-geo` projections + GeoJSON drive maps and choropleths.

## Best practices
- Cherry-pick submodules (`import {scaleLinear} from "d3-scale"`) to shrink bundle size (https://d3js.org/getting-started).
- Use the enter/update/exit (or `.join()`) pattern for dynamic data rather than re-rendering everything (https://d3js.org/d3-selection/joining).
- Prefer Canvas over SVG when rendering thousands of marks for performance (https://d3js.org/d3-selection).
- Keep D3 for data/layout math and let a framework own the DOM when integrating with React/Vue.

## Common pitfalls
- Forgetting the data key function makes `.data()` rebind by index, breaking object constancy → pass a key: `.data(arr, d => d.id)`.
- Mutating the DOM with both React and D3 causes conflicts → let D3 compute attrs, render via the framework, or isolate D3 in a ref.
- Misreading scale direction for SVG `y` (origin top-left) → invert the range: `scaleLinear([0, max], [height, 0])`.

## Examples
```js
import * as d3 from "d3";

const data = [4, 8, 15, 16, 23, 42];
const w = 420, h = 120;
const x = d3.scaleBand().domain(data.map((_, i) => i)).range([0, w]).padding(0.1);
const y = d3.scaleLinear().domain([0, d3.max(data)]).range([h, 0]);

const svg = d3.select("body").append("svg").attr("width", w).attr("height", h);
svg.selectAll("rect")
  .data(data)
  .join("rect")
    .attr("x", (_, i) => x(i))
    .attr("y", d => y(d))
    .attr("width", x.bandwidth())
    .attr("height", d => h - y(d))
    .attr("fill", "steelblue");
```

## Further reading
- https://d3js.org/ — module-by-module API reference and live examples.
- https://observablehq.com/@d3/gallery — official gallery of D3 visualizations.

## Related skills
- ../chart-js — higher-level canvas charting when you don't need custom marks.
- ../plotly — declarative interactive charts built on top of d3/WebGL.
