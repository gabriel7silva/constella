---
name: containerd
description: Industry-standard, CNCF-graduated container runtime that manages the full container lifecycle — consult for low-level runtime and Kubernetes CRI work.
domain: stack
category: container
tags: [containerd, container-runtime, oci, cri, kubernetes, cncf]
official_sources:
  - https://containerd.io/docs/
  - https://github.com/containerd/containerd
verified: 2026-06-16
---

# containerd

## Overview
containerd is an industry-standard container runtime that manages the complete container lifecycle — image transfer and storage, container execution and supervision, low-level storage, and network attachments. It is a CNCF graduated project and the runtime that powers Docker and many Kubernetes installations (via the CRI plugin). Read this when working below the Docker/Podman layer, configuring a Kubernetes node runtime, or embedding container management in your own platform.

## Official sources
- Docs: https://containerd.io/docs/
- Repo: https://github.com/containerd/containerd
- Getting started: https://github.com/containerd/containerd/blob/main/docs/getting-started.md

## Install / setup
Install from the official release binaries, then enable the systemd service (https://github.com/containerd/containerd/blob/main/docs/getting-started.md). Download `containerd-<VERSION>-<OS>-<ARCH>.tar.gz` from https://github.com/containerd/containerd/releases and extract it:

```bash
tar Cxzvf /usr/local containerd-<VERSION>-<OS>-<ARCH>.tar.gz
```

Set up the systemd service unit:

```bash
# Place containerd.service in /usr/local/lib/systemd/system/
systemctl daemon-reload
systemctl enable --now containerd
```

containerd also requires a low-level OCI runtime (`runc`, from https://github.com/opencontainers/runc/releases) and, for networking, the CNI plugins (from https://github.com/containernetworking/plugins/releases).

## Core concepts
- **Daemon + clients**: a long-running `containerd` daemon exposes a gRPC API; the `ctr` CLI and higher-level tools (Docker, Kubernetes) are clients.
- **OCI runtime delegation**: containerd does not run containers itself — it shells out to an OCI runtime such as `runc` to create the process.
- **Namespaces**: API objects (images, containers, snapshots) are isolated into namespaces so multiple consumers (e.g. Docker and k8s) share one daemon without collisions.
- **Snapshotters**: pluggable storage backends (overlayfs, etc.) that materialize image layers into a container rootfs.
- **CRI plugin**: implements the Kubernetes Container Runtime Interface so kubelet can use containerd directly as a node runtime.
- **Content + image store**: content-addressable storage for image layers and manifests, with image pull/push handled over the distribution API.

## Best practices
- Use higher-level tooling (Docker, nerdctl, Kubernetes) for everyday work; reserve `ctr` for debugging since it is intentionally low-level (https://github.com/containerd/containerd/blob/main/docs/getting-started.md).
- Match the configured cgroup driver between containerd and kubelet (commonly `systemd`) to avoid node instability (https://github.com/containerd/containerd/blob/main/docs/getting-started.md).
- Generate and customize the daemon config explicitly (`containerd config default > /etc/containerd/config.toml`) rather than relying on implicit defaults (https://github.com/containerd/containerd/blob/main/docs/getting-started.md).
- Keep `runc` and CNI plugins installed and version-compatible, since containerd depends on them for execution and networking (https://github.com/containerd/containerd/blob/main/docs/getting-started.md).

## Common pitfalls
- Expecting a Docker-like UX from `ctr` → it is a debugging tool with no stable UX; use nerdctl or Docker for ergonomic workflows (https://github.com/containerd/containerd/blob/main/docs/getting-started.md).
- Forgetting that containers from different clients live in separate namespaces → an image pulled in one namespace is not visible in another (https://github.com/containerd/containerd/blob/main/docs/namespaces.md).
- Installing the containerd binary alone → containers fail to start without `runc`, and pods fail to network without CNI plugins (https://github.com/containerd/containerd/blob/main/docs/getting-started.md).

## Examples
```bash
# Pull an image and run a container with the low-level ctr client
sudo ctr image pull docker.io/library/redis:alpine
sudo ctr run --rm -t docker.io/library/redis:alpine redis redis-server

# Inspect objects within a specific namespace
sudo ctr -n k8s.io containers list
```

## Further reading
- Getting started guide: https://github.com/containerd/containerd/blob/main/docs/getting-started.md
- Ops/admin docs: https://github.com/containerd/containerd/blob/main/docs/ops.md

## Related skills
- ../docker — uses containerd as its underlying runtime
- ../podman — alternative engine in the same OCI ecosystem
