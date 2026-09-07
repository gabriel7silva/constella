---
name: grafana
description: Grafana is an open-source observability and analytics platform for querying, visualizing, alerting on, and exploring metrics, logs, and traces from many data sources (Prometheus, Loki, InfluxDB, SQL, and more). Consult when you need to build operational dashboards, set up alerting, wire up data sources, or provision dashboards-as-code for monitoring and observability.
domain: stack
category: dataviz
tags: [grafana, dataviz, observability, dashboards, monitoring, prometheus, alerting]
official_sources:
  - https://grafana.com/docs/grafana/latest/
  - https://github.com/grafana/grafana
  - https://grafana.com/docs/grafana/latest/setup-grafana/installation/
verified: 2026-06-17
---

# Grafana

## Overview
Grafana is an open-source platform for monitoring and observability: it connects to dozens of data sources and lets you compose interactive dashboards, run ad-hoc queries (Explore), and define alerting—all without storing data itself. It is the de-facto visualization layer for Prometheus, Loki, and time-series stacks. Read this when you need operational dashboards, alert rules, data-source configuration, or dashboards provisioned as code.

## Official sources
- Docs: https://grafana.com/docs/grafana/latest/
- Repo: https://github.com/grafana/grafana
- Install: https://grafana.com/docs/grafana/latest/setup-grafana/installation/

## Install / setup
```bash
docker run -d -p 3000:3000 --name grafana grafana/grafana-oss
```
Quick-start Docker command from the official install docs (https://grafana.com/docs/grafana/latest/setup-grafana/installation/docker/); browse to http://localhost:3000 and sign in with admin / admin. APT/RPM/Windows installers are documented under the install page.

## Core concepts
- **Data source** — a connection to a backend (Prometheus, Loki, InfluxDB, MySQL, etc.); Grafana queries it live, it stores nothing.
- **Dashboard** — a collection of panels arranged on a grid, JSON-modeled and shareable.
- **Panel** — one visualization (time series, gauge, table, stat, bar gauge…) backed by one or more queries.
- **Query & transformations** — per-panel queries plus client-side transforms (joins, calculations, reshaping).
- **Variables** — template variables make dashboards reusable/parameterized (e.g. `$instance`).
- **Alerting** — unified alert rules evaluate queries and route notifications via contact points.
- **Provisioning** — data sources and dashboards defined as YAML/JSON files for GitOps.
- **Explore** — ad-hoc query/log/trace exploration outside dashboards.

## Best practices
- Provision data sources and dashboards as code (files under `provisioning/`) instead of clicking in the UI (https://grafana.com/docs/grafana/latest/administration/provisioning/).
- Use template variables and repeating panels/rows to keep dashboards DRY (https://grafana.com/docs/grafana/latest/dashboards/variables/).
- Move off the bundled SQLite to PostgreSQL/MySQL for production HA (https://grafana.com/docs/grafana/latest/setup-grafana/installation/).
- Change the default admin password and configure proper auth/proxy before exposing (https://grafana.com/docs/grafana/latest/setup-grafana/configure-security/).

## Common pitfalls
- Editing dashboards in the UI when they're provisioned from files → changes are read-only/overwritten; edit the source files instead.
- Relying on SQLite for production → it doesn't scale; migrate the Grafana database to Postgres/MySQL.
- Dashboard "No data" → mismatched data-source UID or query time range; verify the data source and `$__range`/time picker.

## Examples
```yaml
# provisioning/datasources/prometheus.yaml — provision a data source as code
apiVersion: 1
datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
```

## Further reading
- https://grafana.com/docs/grafana/latest/fundamentals/getting-started/ — build your first dashboard.
- https://grafana.com/docs/grafana/latest/alerting/ — unified alerting reference.

## Related skills
- ../plotly — code-driven interactive charts when you control the rendering app.
- ../d3 — fully custom one-off visualizations outside a dashboard tool.
