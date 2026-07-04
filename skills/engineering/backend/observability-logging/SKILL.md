---
name: backend/observability-logging
description: Observability via the three signals (logs, metrics, traces) with OpenTelemetry, plus SRE practices like SLOs and the four golden signals.
domain: engineering
category: engineering
tags: [observability, logging, metrics, tracing, opentelemetry, sre, slo]
official_sources:
  - https://opentelemetry.io/docs/
  - https://sre.google/books/
verified: 2026-06-16
---

# Observability and Logging

## Overview
Observability is the ability to understand a system's internal state from its outputs. This skill covers the three telemetry signals — logs, metrics, and traces — instrumented in a vendor-neutral way with OpenTelemetry, and the operational practices Google SRE uses to act on that data (SLIs/SLOs, error budgets, the four golden signals). Read it when adding instrumentation, choosing what to log, or defining what "healthy" means for a service.

## Official sources
- OpenTelemetry docs: https://opentelemetry.io/docs/
- Repo (OpenTelemetry org): https://github.com/open-telemetry
- Google SRE books (free online): https://sre.google/books/

## Core concepts
- **Three signals.** OpenTelemetry standardizes **traces** (the path of a request across services), **metrics** (numeric measurements over time), and **logs** (timestamped records of discrete events).
- **OpenTelemetry is instrumentation, not a backend.** It is "a vendor-neutral open source Observability framework for instrumenting, generating, collecting, and exporting telemetry data" — it does not store or visualize data; you send it to a backend.
- **The Collector.** A vendor-agnostic process to receive, process, and export telemetry, decoupling your app from any specific backend.
- **OTLP and vendor neutrality.** A common wire protocol and broad vendor support (90+ observability vendors) let you switch tools without re-instrumenting, avoiding lock-in.
- **SLIs and SLOs.** A Service Level Indicator is a measured quality (e.g. request latency); a Service Level Objective is a target for it. Error budgets quantify allowable unreliability against the SLO (Google SRE).
- **The four golden signals.** Google SRE recommends monitoring **latency, traffic, errors, and saturation** as the primary health signals of a user-facing system.

## Best practices
- Emit structured logs (e.g. JSON with consistent fields) and correlate them with traces via trace/span IDs so you can pivot between signals.
- Instrument with OpenTelemetry rather than vendor-specific SDKs so the backend stays swappable.
- Define SLOs for the user-facing behaviors that matter and alert on SLO burn / the four golden signals, not on every raw metric (Google SRE).
- Run the OpenTelemetry Collector to centralize processing (batching, attribute scrubbing, routing) instead of exporting directly from every service.

## Common pitfalls
- Treating OpenTelemetry as a storage/visualization product → it only generates and ships telemetry; pair it with a backend.
- Logging unstructured free text → emit structured, queryable fields and avoid logging secrets/PII.
- Alerting on raw resource metrics with no SLO → alert on user-impacting symptoms (golden signals / SLO burn) to cut noise (Google SRE).

## Examples
```text
A single user request, observed across the three signals:
  trace : frontend → orders-api → payments-api (spans with timing)
  metric: http.server.duration, error.rate, queue.saturation
  log   : {"level":"error","trace_id":"abc123","msg":"payment declined"}
```
```text
Four golden signals to dashboard/alert on:
  latency · traffic · errors · saturation
```

## Further reading
- OpenTelemetry — what is observability: https://opentelemetry.io/docs/concepts/observability-primer/
- SRE Book, Monitoring Distributed Systems (golden signals): https://sre.google/sre-book/monitoring-distributed-systems/

## Related skills
- ./backend-fundamentals — the "logs" twelve-factor concern and service operation
- ./auth-and-authorization — logging authorization failures for audit
