---
name: d3-visualization-playbook
description: |
  Use this skill when Codex needs teaches the agent to produce D3 charts and interactive data visualizations. A comprehensive D3.js skill with examples across chart types and techniques giving the agent expert-level knowledge to compose complex, interactive visualizations. Helpful for editorial dashboards, reports, data-rich prototypes, and explanatory graphics. Recast from the original d3-visualization/SKILL.md material as the d3-visualization-playbook procedure.
---

# D3 Visualization Playbook

## Role

Use this skill when Codex needs teaches the agent to produce D3 charts and interactive data visualizations. A comprehensive D3.js skill with examples across chart types and techniques giving the agent expert-level knowledge to compose complex, interactive visualizations. Helpful for editorial dashboards, reports, data-rich prototypes, and explanatory graphics. Recast from the original d3-visualization/SKILL.md material as the d3-visualization-playbook procedure.

## Source Trace

- Original Markdown: `d3-visualization/SKILL.md`
- Reformulated skill name: `d3-visualization-playbook`
- Upstream reference: https://github.com/jiannanya/snow-d3/
- Source category: `diagrams`

## Operating Guidance

Follow the rewritten material below as the working procedure. Keep code blocks, commands, file paths, URLs, dimensions, and API names exact when applying the skill.

> Adapted from @jiannanya.

## Purpose

Teaches the agent to produce D3 charts and interactive data visualizations. A comprehensive D3.js skill with examples across chart types and techniques giving the agent expert-level knowledge to compose complex, interactive visualizations. Helpful for editorial dashboards, reports, data-rich prototypes, and explanatory graphics.

## Origin

- Upstream: https://github.com/jiannanya/snow-d3/
- Category: `diagrams`

## Procedure

This catalogue entry advertises the skill in Open Design so the agent
discovers it during planning. To execute the full upstream workflow with
its original assets, scripts, and reference documents, install the upstream
bundle into your active agent's skills directory:

```bash
# Inspect the upstream README for exact paths
open https://github.com/jiannanya/snow-d3/

# Clone or copy the snow-d3/ folder into your workspace's skills/ directory
git clone https://github.com/jiannanya/snow-d3.git skills/snow-d3

```

Then request this skill by name (`d3-visualization`) or with
one of the trigger phrases listed in this skill's frontmatter, e.g.:

> "Produce a zoomable treemap for my sales data"
> "Assemble a force-directed network graph like example 07 but for my own dataset"
> "Compose a calendar heatmap in D3"
