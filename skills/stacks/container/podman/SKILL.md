---
name: podman
description: Daemonless, rootless OCI container and pod engine with a Docker-compatible CLI — consult for running containers without a root daemon.
domain: stack
category: container
tags: [podman, containers, rootless, daemonless, oci, pods]
official_sources:
  - https://docs.podman.io/
  - https://github.com/containers/podman
verified: 2026-06-16
---

# Podman

## Overview
Podman is a daemonless, open-source, Linux-native tool for finding, running, building, sharing, and deploying applications using OCI containers and pods. Unlike Docker it runs without a long-lived root daemon and supports rootless containers, making it attractive for security-sensitive and multi-user environments. Its CLI is largely Docker-compatible, so most `docker` commands map directly to `podman`. Read this when running containers without a daemon or migrating Docker workflows.

## Official sources
- Docs: https://docs.podman.io/
- Repo: https://github.com/containers/podman
- Install / download: https://podman.io/docs/installation

## Install / setup
Install commands per platform from the official installation page (https://podman.io/docs/installation):

```bash
# Fedora / CentOS Stream / RHEL
sudo dnf -y install podman

# Debian
sudo apt-get -y install podman

# Ubuntu
sudo apt-get update
sudo apt-get -y install podman

# Arch / Manjaro
sudo pacman -S podman

# Alpine
sudo apk add podman

# openSUSE
sudo zypper install podman
```

On macOS and Windows, Podman runs containers inside a managed Linux VM. Initialize and start the machine (https://podman.io/docs/installation):

```bash
podman machine init
podman machine start
podman info
```

## Core concepts
- **Daemonless architecture**: each `podman` command is a short-lived process; there is no central root daemon mediating requests.
- **Rootless containers**: containers can run under an unprivileged user via user namespaces, reducing the blast radius of a container escape.
- **Pods**: Podman groups one or more containers that share namespaces (e.g. network) into a pod, mirroring the Kubernetes pod concept.
- **OCI compliance**: images and runtime conform to Open Containers Initiative standards, so images are interchangeable with other OCI tools.
- **Docker-compatible CLI**: command syntax largely matches Docker; `alias docker=podman` works for many workflows.
- **libpod**: the underlying library that manages pods, containers, images, and volumes.

## Best practices
- Prefer rootless mode for everyday use to limit privileges; reserve rootful mode for cases that genuinely require it (https://docs.podman.io/en/latest/markdown/podman.1.html).
- Generate Kubernetes YAML from running pods/containers with `podman kube generate` to bridge local development and cluster deployment (https://docs.podman.io/en/latest/markdown/podman-kube-generate.1.html).
- Use `podman generate systemd` / Quadlet to run containers as managed systemd services for reliable startup and restart (https://docs.podman.io/en/latest/markdown/podman-systemd.unit.5.html).
- Build images with the bundled Buildah-backed `podman build`, consuming standard Dockerfiles (https://docs.podman.io/en/latest/markdown/podman-build.1.html).

## Common pitfalls
- Expecting a background daemon/socket like Docker → Podman is daemonless; tools needing the Docker API require enabling the Podman socket service (https://docs.podman.io/en/latest/markdown/podman-system-service.1.html).
- Privileged-port or low-level networking surprises in rootless mode → rootless containers have restricted capabilities and use slirp/pasta networking by default (https://docs.podman.io/en/latest/markdown/podman-network.1.html).
- Assuming containers persist across host reboot → use systemd/Quadlet units to auto-restart them (https://docs.podman.io/en/latest/markdown/podman-systemd.unit.5.html).

## Examples
```bash
# Run a rootless container, mapping a host port
podman run -d --name web -p 8080:80 docker.io/library/nginx:latest

# Create a pod and add a container to it
podman pod create --name app -p 8000:8000
podman run -d --pod app docker.io/library/python:3.12 python -m http.server 8000

# Export a running pod to Kubernetes YAML
podman kube generate app -f app.yaml
```

## Further reading
- Podman command reference: https://docs.podman.io/en/latest/Commands.html
- Tutorials (incl. Docker-to-Podman transition): https://docs.podman.io/en/latest/Tutorials.html

## Related skills
- ../docker — the daemon-based engine Podman mirrors at the CLI level
- ../containerd — lower-level OCI runtime used by other container stacks
