---
name: gcp
description: Google Cloud Platform and the gcloud CLI; consult for compute, storage, networking, IAM, and scripting GCP resources.
domain: stack
category: infra
tags: [cloud, gcp, gcloud, iam, compute, cli]
official_sources:
  - https://cloud.google.com/docs
  - https://cloud.google.com/sdk/docs/install
verified: 2026-06-16
---

# GCP (Google Cloud Platform)

## Overview
Google Cloud Platform offers compute (Compute Engine, Cloud Run, GKE), storage (Cloud Storage), databases, networking, and IAM across Google's global infrastructure. The Google Cloud CLI (`gcloud`, part of the Google Cloud SDK) is the unified tool for managing and scripting these resources. Read this when you need to provision, manage, or automate GCP infrastructure.

## Official sources
- Docs: https://cloud.google.com/docs
- CLI install: https://cloud.google.com/sdk/docs/install
- Note: the gcloud CLI / Google Cloud SDK is a Google-distributed product without a single canonical public source repo; install from the official download above. The GoogleCloudPlatform GitHub org (https://github.com/GoogleCloudPlatform) hosts samples and tooling such as the cloud-sdk-docker image.

## Install / setup
Linux, copied verbatim from the official install page:
```bash
curl -O https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/google-cloud-cli-linux-x86_64.tar.gz
tar -xf google-cloud-cli-linux-x86_64.tar.gz
./google-cloud-sdk/install.sh
```

## Core concepts
- Projects: the top-level container for resources, billing, and permissions; nearly everything belongs to a project.
- IAM: roles and policies binding members (users, service accounts) to permissions on resources.
- Service accounts: non-human identities used by workloads to call GCP APIs.
- Regions & zones: resources are deployed to zones within regions for locality and redundancy.
- Compute options: Compute Engine (VMs), Cloud Run (containers, serverless), and GKE (managed Kubernetes).
- gcloud config: the active project, account, and region/zone are stored in a CLI configuration.

## Best practices
- Set the active project/region in your gcloud config (or pass `--project`) so commands target the intended resources.
- Grant least-privilege IAM roles and use service accounts for workloads instead of personal credentials (per GCP IAM docs).
- Use Workload Identity / short-lived credentials for CI rather than downloading long-lived service-account key files.
- Separate environments into distinct projects to isolate billing, quotas, and blast radius.

## Common pitfalls
- Forgetting to set the active project → commands fail or hit the wrong project.
- Downloading and committing service-account JSON keys → credential leakage; prefer keyless/short-lived auth.
- Over-broad primitive roles (Owner/Editor) → use predefined or custom least-privilege roles instead.

## Examples
```bash
# Authenticate and select the active project
gcloud auth login
gcloud config set project my-project-id

# List compute instances
gcloud compute instances list
```

## Further reading
- https://cloud.google.com/sdk/gcloud — gcloud command reference
- https://cloud.google.com/iam/docs — IAM documentation

## Related skills
- ../aws — comparable hyperscale cloud platform
- ../kubernetes — container orchestration often run on GCP (GKE)
