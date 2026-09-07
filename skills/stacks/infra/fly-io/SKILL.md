---
name: fly-io
description: Run full-stack apps and databases on a global edge using flyctl and Fly Machines; consult for deploys, regions, and scaling.
domain: stack
category: infra
tags: [hosting, edge, containers, deploy, flyctl, global]
official_sources:
  - https://fly.io/docs/
  - https://github.com/superfly/flyctl
verified: 2026-06-16
---

# Fly.io

## Overview
Fly.io runs your app as containers (Fly Machines) on hardware in many regions, placing instances close to users worldwide. It deploys apps, databases, and background workers driven by the `flyctl` CLI and a `fly.toml` config. Read this when you need to deploy a containerized full-stack app with low latency across regions.

## Official sources
- Docs: https://fly.io/docs/
- Repo (flyctl): https://github.com/superfly/flyctl
- Install: https://fly.io/docs/flyctl/install/

## Install / setup
```bash
curl -L https://fly.io/install.sh | sh
```

## Core concepts
- Fly Machines: fast-starting micro-VMs running your container image; the unit of compute you deploy and scale.
- `fly.toml`: per-app configuration declaring services, ports, regions, health checks, and scaling.
- Regions: apps run in chosen regions; Fly's edge routes each request to a nearby instance.
- Volumes: persistent local disks attached to a Machine for stateful workloads.
- Apps & deploys: `fly deploy` builds/pushes an image and rolls Machines to the new release.
- Private networking: apps in an organization share a private IPv6 (6PN) network for service-to-service traffic.

## Best practices
- Define health checks in `fly.toml` so rolling deploys only shift traffic to healthy Machines.
- Co-locate stateful storage (volumes/databases) in the same region as the app instances that use them to avoid cross-region latency.
- Use secrets (`fly secrets set`) for credentials instead of baking them into the image or committing them.
- Scale by region to match where your users are rather than over-provisioning a single region.

## Common pitfalls
- Assuming volumes follow the app across regions → a volume is pinned to one region/Machine; plan placement and replication.
- Forgetting health checks → a broken release can receive traffic before failing.
- Treating Machines as long-lived pets → they can be recreated; persist state in volumes or external databases.

## Examples
```bash
# Authenticate, scaffold config, and deploy
fly auth login
fly launch
fly deploy

# Store a secret used by the app at runtime
fly secrets set DATABASE_URL=postgres://...
```

## Further reading
- https://fly.io/docs/reference/configuration/ — fly.toml reference
- https://fly.io/docs/volumes/ — persistent volumes

## Related skills
- ../railway — similar deploy-anything platform for apps and databases
