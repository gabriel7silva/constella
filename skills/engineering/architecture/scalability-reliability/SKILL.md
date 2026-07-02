---
name: scalability-reliability
description: Scaling, SLIs/SLOs, error budgets, and resilience tactics (timeouts, retries with backoff/jitter, load shedding); read before hardening a service.
domain: engineering
category: architecture
tags: [scalability, reliability, slo, resilience, retries]
official_sources:
  - https://sre.google/books/
  - https://aws.amazon.com/builders-library/
verified: 2026-06-16
---

# Scalability & Reliability

## Overview
Scalability is the ability to handle growing load without proportional cost or latency blowups; reliability is delivering the intended function and recovering quickly from failure. Google's SRE practice frames reliability with SLIs, SLOs, and error budgets; the Amazon Builders' Library documents the concrete tactics — timeouts, retries with backoff and jitter, and load shedding. Read this before hardening a service or setting reliability targets.

## Official sources
- Google SRE books (SRE, the Workbook, Building Secure & Reliable Systems): https://sre.google/books/
- Amazon Builders' Library (resilience and operations practices): https://aws.amazon.com/builders-library/

## Core concepts
- **SLI**: a Service Level Indicator is a quantitative measure of a service quality aspect — common examples are request latency, error rate, and availability.
- **SLO**: a Service Level Objective is a target value or range for an SLI; it is the goal you operate against.
- **SLA vs SLO**: an SLA adds explicit consequences (e.g. penalties) for missing targets; without consequences you are looking at an SLO, not an SLA.
- **Error budget**: rather than demanding perfection, allow a rate at which the SLO may be missed and track it over time to inform release decisions.
- **Timeouts, retries, backoff, jitter**: timeouts bound how long calls hang; retries mask transient faults; exponential backoff with jitter spreads retries to avoid synchronized spikes and congestion.
- **Load shedding**: as a server approaches overload it should reject excess requests so it can keep latency low for the requests it does accept.

## Best practices
- Define a few meaningful SLOs from user-centric SLIs and manage to an error budget; keep aggregations simple and avoid unrealistic absolutes (per the SRE book).
- Always set timeouts on remote calls so a slow dependency cannot tie up resources indefinitely.
- Use exponential backoff with jitter for retries to avoid retry storms; consider adaptive retries with a token-bucket retry quota to cap amplification.
- Be cautious with retries against an overloaded dependency — retrying a struggling system amplifies load; retry only when the dependency appears healthy, and shed load when overloaded.

## Common pitfalls
- Retrying without backoff/jitter → synchronized retry storms amplify an outage; add exponential backoff plus jitter.
- Targeting 100% reliability → unsustainable and pointless past user perception; set an SLO with an error budget instead.
- No timeouts on dependency calls → one slow dependency exhausts threads/connections and cascades the failure.

## Examples
```text
Resilient remote call:
  deadline = now + timeout
  for attempt in 0..maxRetries:
    try: return call(deadline)
    except transient:
      if dependencyUnhealthy(): break        # don't amplify overload
      sleep( random(0, base * 2**attempt) )   # exponential backoff + jitter
  raise Unavailable
# Server side: if nearOverload(): reject(503)  # load shedding
```

## Further reading
- SRE book — Service Level Objectives chapter: https://sre.google/sre-book/service-level-objectives/
- Amazon Builders' Library — Timeouts, retries, and backoff with jitter: https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/
- Amazon Builders' Library — Using load shedding to avoid overload: https://aws.amazon.com/builders-library/using-load-shedding-to-avoid-overload/

## Related skills
- ../system-design-fundamentals — latency, throughput, and scaling trade-offs
- ../message-queues-async — queues for load leveling and decoupling
- ../caching-strategies — offloading origins to absorb load
