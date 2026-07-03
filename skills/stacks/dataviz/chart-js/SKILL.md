---
name: chart-js
description: Chart.js is a popular open-source HTML5 Canvas charting library for the browser with built-in chart types (line, bar, pie, doughnut, radar, scatter, bubble, polar area). Consult when you need responsive, animated, framework-agnostic charts quickly without writing low-level SVG, or when integrating charts with React/Vue/Angular via official wrappers.
domain: stack
category: dataviz
tags: [chart-js, chartjs, dataviz, javascript, canvas, charts, visualization]
official_sources:
  - https://www.chartjs.org/docs/latest/
  - https://github.com/chartjs/Chart.js
  - https://www.npmjs.com/package/chart.js
verified: 2026-06-17
---

# Chart.js

## Overview
Chart.js is a simple, flexible open-source JavaScript charting library that renders to an HTML5 `<canvas>`. It ships eight core chart types plus animations, tooltips, and responsive resizing out of the box, with a plugin and scale system for extension. Read this when you need clean, interactive charts fast and don't require the fully custom control of a low-level library like D3.

## Official sources
- Docs: https://www.chartjs.org/docs/latest/
- Repo: https://github.com/chartjs/Chart.js
- Install: https://www.npmjs.com/package/chart.js

## Install / setup
```bash
npm install chart.js
```
Command from the official installation guide (https://www.chartjs.org/docs/latest/getting-started/installation.html); CDN builds are available on jsDelivr (`https://cdn.jsdelivr.net/npm/chart.js`) and CDNJS.

## Core concepts
- **Chart instance** — `new Chart(ctx, config)` mounts a chart onto a canvas 2D context.
- **Config object** — `{ type, data, options }` declaratively describes the chart.
- **Datasets** — each `data.datasets[]` entry holds values, labels, colors, and per-dataset options.
- **Scales** — cartesian (`x`/`y`) and radial axes configured under `options.scales`.
- **Tree-shaking** — register only the controllers/elements you use, or import `chart.js/auto` for everything.
- **Plugins** — lifecycle hooks (`beforeDraw`, `afterEvent`) extend rendering; many community plugins exist.
- **Responsive** — charts resize to their container by default (`responsive: true`).
- **Animations** — transitions are configurable per property under `options.animation`.

## Best practices
- Import from `chart.js/auto` for prototypes, but register components explicitly in production to tree-shake (https://www.chartjs.org/docs/latest/getting-started/integration.html).
- Give the canvas a sized wrapper element and avoid hard-coding width/height for responsiveness (https://www.chartjs.org/docs/latest/configuration/responsive.html).
- Call `chart.update()` after mutating `chart.data`, and `chart.destroy()` before recreating to avoid leaks (https://www.chartjs.org/docs/latest/developers/api.html).
- Use official framework wrappers (react-chartjs-2, vue-chartjs) instead of manually bridging lifecycles.

## Common pitfalls
- "category is not a registered scale" error → you tree-shook too aggressively; register the needed scales/controllers or use `chart.js/auto`.
- Chart grows infinitely tall in a flex/grid parent → set `maintainAspectRatio: false` and size the wrapper.
- Re-rendering over an existing canvas → destroy the previous instance first (`chart.destroy()`).

## Examples
```js
import { Chart } from "chart.js/auto";

const ctx = document.getElementById("myChart").getContext("2d");
new Chart(ctx, {
  type: "bar",
  data: {
    labels: ["Jan", "Feb", "Mar", "Apr"],
    datasets: [{ label: "Sales", data: [12, 19, 7, 15], backgroundColor: "steelblue" }]
  },
  options: { responsive: true, scales: { y: { beginAtZero: true } } }
});
```

## Further reading
- https://www.chartjs.org/docs/latest/charts/line.html — per-chart-type configuration reference.
- https://www.chartjs.org/docs/latest/samples/ — official runnable samples.

## Related skills
- ../d3 — drop down to D3 when you need fully custom, non-standard charts.
- ../plotly — alternative when you need scientific/3D/statistical chart types.
