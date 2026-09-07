---
name: docker
description: Build, ship, and run applications in containers with Docker Engine — consult for Dockerfiles, images, and container runtime workflows.
domain: stack
category: container
tags: [docker, containers, dockerfile, oci, image, container-runtime]
official_sources:
  - https://docs.docker.com/
  - https://github.com/moby/moby
verified: 2026-06-16
---

# Docker

## Overview
Docker packages an application and its dependencies into a portable, isolated container image that runs the same way across machines. It solves the "works on my machine" problem by standardizing build, ship, and run steps. Read this when authoring Dockerfiles, building images, or running containers locally and in CI. The upstream engine is the open-source Moby project.

## Official sources
- Docs: https://docs.docker.com/
- Repo: https://github.com/moby/moby
- Install / download: https://docs.docker.com/get-started/get-docker/

## Install / setup
Docker Desktop (macOS, Windows, Linux) and Docker Engine downloads are listed on the official Get Docker page: https://docs.docker.com/get-started/get-docker/

Install Docker Engine on Ubuntu via the official apt repository (https://docs.docker.com/engine/install/ubuntu/):

```bash
sudo apt install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Convenience script for non-production/development setups (https://docs.docker.com/engine/install/ubuntu/):

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
```

Verify the installation:

```bash
sudo docker run hello-world
```

## Core concepts
- **Image**: a read-only, layered template built from a Dockerfile; each instruction adds a cache-able layer.
- **Container**: a running (or stopped) instance of an image with its own writable layer and isolated process/network/filesystem namespaces.
- **Dockerfile**: the declarative build recipe (`FROM`, `RUN`, `COPY`, `CMD`, `ENTRYPOINT`, ...) consumed by the builder.
- **Registry**: a store for distributing images (e.g. Docker Hub); you `pull`/`push` tagged images by `name:tag`.
- **Volume / bind mount**: mechanisms for persisting or sharing data outside the container's ephemeral writable layer.
- **Network**: virtual networks (bridge, host, none, user-defined) that connect containers and control reachability.
- **BuildKit**: the default modern build backend enabling parallelism, build caching, and multi-stage builds.

## Best practices
- Use multi-stage builds so the final image ships only runtime artifacts, not build tooling (https://docs.docker.com/build/building/multi-stage/).
- Order Dockerfile instructions from least- to most-frequently changing and copy dependency manifests before source to maximize layer-cache hits (https://docs.docker.com/build/building/best-practices/).
- Pin base images to specific tags/digests and keep them minimal (slim/alpine/distroless) to shrink attack surface and size (https://docs.docker.com/build/building/best-practices/).
- Add a `.dockerignore` to exclude `.git`, `node_modules`, and secrets from the build context (https://docs.docker.com/build/concepts/context/#dockerignore-files).
- Run containers as a non-root user where possible (`USER`) (https://docs.docker.com/build/building/best-practices/).

## Common pitfalls
- Baking secrets into image layers via `ENV`/`ARG`/`COPY` → use BuildKit build secrets or runtime env/secret injection instead (https://docs.docker.com/build/building/secrets/).
- Storing important data only in the container's writable layer → it is lost when the container is removed; use a volume (https://docs.docker.com/engine/storage/volumes/).
- Using the convenience script in production → it is intended for development; follow the platform-specific install for production (https://docs.docker.com/engine/install/ubuntu/).

## Examples
```dockerfile
# Multi-stage build keeps the final image small
FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
USER node
CMD ["node", "dist/server.js"]
```

## Further reading
- Dockerfile reference: https://docs.docker.com/reference/dockerfile/
- Building best practices: https://docs.docker.com/build/building/best-practices/

## Related skills
- ../podman — daemonless, Docker-CLI-compatible alternative
- ../containerd — the runtime Docker uses under the hood
