---
name: kubernetes
description: Container orchestration for deploying, scaling, and managing containerized apps; consult for Pods, Deployments, Services, and kubectl.
domain: stack
category: infra
tags: [kubernetes, k8s, containers, orchestration, kubectl, cncf]
official_sources:
  - https://kubernetes.io/docs/
  - https://github.com/kubernetes/kubernetes
verified: 2026-06-16
---

# Kubernetes

## Overview
Kubernetes (K8s) is an open-source system, hosted by the CNCF, for automating the deployment, scaling, and management of containerized applications across a cluster of hosts. It exposes a declarative API where you describe desired state and controllers continuously reconcile actual state toward it. Read this when you need to run, scale, or operate containerized workloads on a cluster.

## Official sources
- Docs: https://kubernetes.io/docs/
- Repo: https://github.com/kubernetes/kubernetes
- Install tools: https://kubernetes.io/docs/tasks/tools/

## Install / setup
Install `kubectl` on Linux, copied verbatim from the official install page:
```bash
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
```

## Core concepts
- Pod: the smallest deployable unit, wrapping one or more containers that share network and storage.
- Deployment: declares a desired replica count and manages rolling updates of stateless Pods via ReplicaSets.
- Service: a stable network endpoint and load balancer for a set of Pods selected by labels.
- ConfigMap & Secret: inject non-secret config and sensitive data into Pods separately from images.
- Namespace: a virtual cluster partition for isolating and scoping resources.
- Controllers & reconciliation: control loops continuously drive actual state toward declared desired state.
- Ingress: rules for routing external HTTP(S) traffic to Services.

## Best practices
- Manage resources declaratively with version-controlled manifests applied via `kubectl apply`, not imperative one-off edits.
- Set resource requests and limits on containers so the scheduler can place Pods and prevent noisy-neighbor exhaustion (per the docs).
- Define liveness and readiness probes so Kubernetes restarts unhealthy Pods and only routes traffic to ready ones.
- Store sensitive values in Secrets (and a real secrets manager) rather than baking them into images or ConfigMaps.

## Common pitfalls
- Omitting resource requests/limits → unschedulable Pods or nodes overcommitted and OOM-killed.
- Missing readiness probe → traffic is sent to Pods before they can serve, causing errors during rollouts.
- Treating Secrets as encrypted by default → base64 is encoding, not encryption; enable encryption at rest and restrict RBAC access.

## Examples
```bash
# Apply a manifest and inspect the rollout
kubectl apply -f deployment.yaml
kubectl get pods -n my-namespace
kubectl rollout status deployment/my-app -n my-namespace
```

## Further reading
- https://kubernetes.io/docs/concepts/ — concepts overview
- https://kubernetes.io/docs/reference/kubectl/ — kubectl reference

## Related skills
- ../aws — managed Kubernetes via EKS
- ../gcp — managed Kubernetes via GKE
