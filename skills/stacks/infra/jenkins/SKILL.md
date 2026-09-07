---
name: jenkins
description: Jenkins is an open-source automation server for building, testing, and deploying software via CI/CD pipelines; consult when configuring Jenkinsfile pipelines, declarative vs scripted syntax, agents/nodes, plugins, stages, credentials, or running a Jenkins controller in Docker.
domain: stack
category: infra
tags: [jenkins, ci-cd, automation, pipeline, devops, infrastructure, build]
official_sources:
  - https://www.jenkins.io/doc/
  - https://github.com/jenkinsci/jenkins
  - https://www.jenkins.io/doc/book/installing/
verified: 2026-06-17
---

# Jenkins

## Overview
Jenkins is a self-hosted, open-source automation server that orchestrates continuous integration and continuous delivery (CI/CD) pipelines. Pipelines are defined as code in a `Jenkinsfile` and executed across a controller and distributed agents, with thousands of plugins extending its capabilities. Read this when you need to author pipelines, configure build agents, manage credentials, or stand up a Jenkins instance.

## Official sources
- Docs: https://www.jenkins.io/doc/
- Repo: https://github.com/jenkinsci/jenkins
- Install: https://www.jenkins.io/doc/book/installing/

## Install / setup
```bash
docker run --name jenkins --restart=on-failure --detach \
  --publish 8080:8080 --publish 50000:50000 \
  --volume jenkins-data:/var/jenkins_home \
  jenkins/jenkins:lts-jdk21
```
Source: https://www.jenkins.io/doc/book/installing/docker/

## Core concepts
- **Controller** — central Jenkins server that stores config, schedules builds, and dispatches work to agents.
- **Agent (node)** — worker machine/container that executes build steps; isolates workloads from the controller.
- **Pipeline** — end-to-end automated process defined in a `Jenkinsfile` (declarative or scripted Groovy).
- **Stage / step** — `stage` groups related work; `step` is a single task (e.g. `sh 'make'`).
- **Job/project** — a configured unit of work (freestyle, pipeline, or multibranch).
- **Plugin** — installable extension adding integrations, tools, and pipeline steps.
- **Credentials** — securely stored secrets injected into builds via the Credentials plugin.
- **Executor** — a slot on a node that runs one build at a time.

## Best practices
- Define pipelines as code in a versioned `Jenkinsfile` rather than configuring jobs in the UI (https://www.jenkins.io/doc/book/pipeline/).
- Prefer the Declarative Pipeline syntax for readability and built-in validation (https://www.jenkins.io/doc/book/pipeline/syntax/).
- Run builds on agents, keeping the controller free of heavy workloads (https://www.jenkins.io/doc/book/using/using-agents/).
- Store secrets in the Credentials store and reference via `credentials()`/`withCredentials` (https://www.jenkins.io/doc/book/using/using-credentials/).
- Pin the LTS release line and update plugins regularly for stability and security (https://www.jenkins.io/doc/book/managing/plugins/).

## Common pitfalls
- Running heavy builds on the controller → configure dedicated agents and set controller executors to 0.
- Hardcoding secrets in the Jenkinsfile → use the Credentials plugin and masked bindings.
- Losing config on container restart → mount a persistent volume at `/var/jenkins_home`.

## Examples
```groovy
pipeline {
    agent any
    stages {
        stage('Build') { steps { sh 'make' } }
        stage('Test')  { steps { sh 'make test' } }
    }
}
```

## Further reading
- https://www.jenkins.io/doc/book/pipeline/syntax/ — Declarative & Scripted pipeline syntax reference
- https://plugins.jenkins.io/ — official plugin index
- https://www.jenkins.io/doc/book/security/ — securing a Jenkins instance

## Related skills
- ../circleci — managed CI/CD alternative using YAML config
- ../ansible — provision and configure Jenkins agents
