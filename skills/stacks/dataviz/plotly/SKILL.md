---
name: plotly
description: Plotly is an open-source interactive graphing library available for Python (plotly.py), JavaScript (plotly.js), and R, producing web-based charts including statistical, scientific, financial, 3D, and geographic plots. Consult when you need interactive, publication-quality charts in notebooks or web apps, Plotly Express one-liners, or the Dash framework for analytical web dashboards.
domain: stack
category: dataviz
tags: [plotly, plotly-express, dataviz, python, javascript, charts, dash]
official_sources:
  - https://plotly.com/python/
  - https://github.com/plotly/plotly.py
  - https://plotly.com/python/getting-started/
verified: 2026-06-17
---

# Plotly

## Overview
Plotly is an open-source interactive charting library with high-level APIs for Python, R, and JavaScript, all built on the plotly.js rendering engine (D3 + WebGL). It produces interactive HTML charts—zoom, pan, hover—across statistical, scientific, 3D, and map chart types, and embeds in Jupyter, standalone HTML, or Dash web apps. Read this when you need interactive, exploratory, or publication-quality charts, especially in Python notebooks.

## Official sources
- Docs: https://plotly.com/python/
- Repo: https://github.com/plotly/plotly.py
- Install: https://plotly.com/python/getting-started/

## Install / setup
```bash
pip install plotly
```
Command from the official Python getting-started guide (https://plotly.com/python/getting-started/); use `pip install "plotly[express]"` for Plotly Express extras, `conda install -c conda-forge plotly`, or for the browser `npm install plotly.js-dist` (https://plotly.com/javascript/getting-started/).

## Core concepts
- **Figure** — the top-level object (`plotly.graph_objects.Figure`), serializable to JSON, containing `data` traces and a `layout`.
- **Traces** — typed data series (scatter, bar, heatmap, surface, choropleth…) added to a figure.
- **Plotly Express (px)** — high-level wrapper that builds whole figures from a dataframe in one call.
- **Graph Objects (go)** — low-level, explicit figure construction for full control.
- **Layout** — axes, titles, legends, annotations, and styling under `figure.layout`.
- **Renderers** — where a figure displays (notebook, browser, static image via Kaleido).
- **Dash** — Plotly's companion framework for building interactive analytic web apps in pure Python.
- **plotly.js** — the underlying JS engine; the Python/R libraries emit configs it renders.

## Best practices
- Reach for Plotly Express first; drop to Graph Objects only when px can't express the chart (https://plotly.com/python/plotly-express/).
- Use `fig.update_layout()` / `fig.update_traces()` to style rather than rebuilding figures (https://plotly.com/python/creating-and-updating-figures/).
- Install Kaleido for static PNG/SVG/PDF export (`pip install kaleido`) (https://plotly.com/python/static-image-export/).
- For large scatter data, use WebGL trace types (`scattergl`) for performance (https://plotly.com/python/webgl-vs-svg/).

## Common pitfalls
- Figures don't render in a plain script → call `fig.show()` and ensure a renderer; in some contexts write HTML with `fig.write_html()`.
- `fig.write_image()` fails → Kaleido isn't installed; `pip install kaleido`.
- Mixing px and go incorrectly → px returns a full `Figure`; add go traces with `fig.add_trace()` rather than reconstructing.

## Examples
```python
import plotly.express as px

df = px.data.iris()
fig = px.scatter(
    df, x="sepal_width", y="sepal_length",
    color="species", size="petal_length",
    title="Iris sepal dimensions",
)
fig.update_layout(legend_title_text="Species")
fig.show()
```

## Further reading
- https://plotly.com/python/reference/ — full figure/trace attribute reference.
- https://dash.plotly.com/ — Dash framework for analytical web apps.

## Related skills
- ../d3 — the low-level layer beneath plotly.js for fully custom visualizations.
- ../chart-js — lighter canvas charts when you don't need scientific/3D types.
