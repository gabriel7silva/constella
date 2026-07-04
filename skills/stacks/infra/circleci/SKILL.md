---
name: circleci
description: CircleCI is a cloud and self-hosted CI/CD platform configured via a .circleci/config.yml file; consult when defining jobs, workflows, executors, orbs, caching, contexts, or runners, and when debugging pipeline syntax (version 2.1) or build failures.
domain: stack
category: infra
tags: [circleci, ci-cd, automation, pipeline, devops, infrastructure, yaml]
official_sources:
  - https://circleci.com/docs/
  - https://github.com/CircleCI-Public
  - https://circleci.com/docs/guides/getting-started/getting-started/
verified: 2026-06-17
---

# CircleCI

## Overview
CircleCI is a continuous integration and delivery platform that runs pipelines defined in a single `.circleci/config.yml` file at the root of your repository. It executes jobs in fully isolated cloud executors (Docker, Linux, macOS, Windows) or on self-hosted runners, orchestrated by workflows. Read this when authoring or debugging CircleCI config, wiring up jobs and workflows, or reusing logic with orbs.

## Official sources
- Docs: https://circleci.com/docs/
- Repo: https://github.com/CircleCI-Public
- Install: https://circleci.com/docs/guides/getting-started/getting-started/

## Install / setup
```yaml
# .circleci/config.yml
version: 2.1
jobs:
  build:
    docker:
      - image: cimg/base:current
    steps:
      - checkout
      - run: echo "Hello, CircleCI"
```
Source: https://circleci.com/docs/guides/getting-started/introduction-to-yaml-configurations/

## Core concepts
- **config.yml** — single YAML file under `.circleci/` defining the entire pipeline; `version: 2.1` is current.
- **Job** — a collection of `steps` run in a single executor; the unit of work.
- **Step** — an individual action such as `checkout` or `run`.
- **Executor** — the environment a job runs in (`docker`, `machine`, `macos`, `windows`).
- **Workflow** — orchestrates jobs with ordering, fan-out/fan-in, and conditional/parallel execution.
- **Orb** — reusable, shareable package of config (jobs, commands, executors).
- **Context** — named, secured set of environment variables shared across projects.
- **Self-hosted runner** — your own machine executing jobs for the CircleCI control plane.

## Best practices
- Use `version: 2.1` to unlock orbs, reusable commands, and pipeline parameters (https://circleci.com/docs/reference/configuration-reference/).
- Organize multi-job pipelines with workflows for parallelism and dependencies (https://circleci.com/docs/guides/orchestrate/workflows/).
- Cache dependencies with `save_cache`/`restore_cache` to speed up builds (https://circleci.com/docs/guides/optimize/caching/).
- Store secrets in Contexts or project environment variables, never in config (https://circleci.com/docs/guides/security/contexts/).
- Reuse vetted logic via the orb registry instead of copy-pasting steps (https://circleci.com/developer/orbs).

## Common pitfalls
- Misindented YAML silently breaks the pipeline → validate with the CircleCI CLI (`circleci config validate`) or VS Code extension.
- Stale caches from an unchanging cache key → include a checksum of the lockfile in the key.
- Committing secrets into config.yml → move them into Contexts or env vars in project settings.

## Examples
```yaml
workflows:
  build-and-test:
    jobs:
      - build
      - test:
          requires:
            - build
```

## Further reading
- https://circleci.com/docs/reference/configuration-reference/ — full config.yml reference
- https://circleci.com/developer/orbs — orb registry
- https://circleci.com/docs/guides/orchestrate/workflows/ — workflows guide

## Related skills
- ../jenkins — self-hosted CI/CD server alternative
- ../terraform — provision infrastructure invoked from CircleCI jobs
