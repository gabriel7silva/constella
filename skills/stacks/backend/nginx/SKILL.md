---
name: nginx
description: Nginx — a high-performance HTTP server, reverse proxy, and load balancer for serving static files, terminating TLS, and proxying to app backends. Consult when writing nginx.conf, configuring server/location blocks, setting up reverse proxy (proxy_pass) or load balancing (upstream), serving static assets, enabling gzip/TLS, or installing from the official nginx.org repo.
domain: stack
category: backend
tags: [nginx, web-server, reverse-proxy, load-balancer, http, tls, backend]
official_sources:
  - https://nginx.org/en/docs/
  - https://github.com/nginx/nginx
  - https://nginx.org/en/linux_packages.html
verified: 2026-06-17
---

# Nginx

## Overview
Nginx is an event-driven HTTP server and reverse proxy known for high concurrency and low memory use. It serves static content, terminates TLS, load-balances across upstream app servers, and proxies dynamic requests (e.g. to PHP-FPM, Node, or a Spring app). Read this when authoring `nginx.conf`, defining server/location blocks, configuring reverse proxy or load balancing, or installing Nginx from the official repository.

## Official sources
- Docs: https://nginx.org/en/docs/
- Repo: https://github.com/nginx/nginx
- Install: https://nginx.org/en/linux_packages.html

## Install / setup
```bash
# Ubuntu/Debian, from the official nginx.org repository (after adding the repo + key):
sudo apt update && sudo apt install nginx
```
Source: https://nginx.org/en/linux_packages.html (add the nginx signing key and `deb ... nginx.org/packages/ubuntu` repo first, then install).

## Core concepts
- **Master/worker processes** — a master manages config; workers handle connections via an event loop.
- **Contexts** — directives nest in `main`, `events`, `http`, `server`, and `location` blocks.
- **server blocks** — virtual hosts matched by `listen` + `server_name`.
- **location blocks** — match request URIs (prefix, `=`, `~` regex) to behavior.
- **Reverse proxy** — `proxy_pass` forwards requests to a backend; set `proxy_set_header` for Host/X-Forwarded-*.
- **upstream / load balancing** — group backends; round-robin, `least_conn`, `ip_hash`.
- **Static serving** — `root`/`alias` + `try_files` resolve files on disk.
- **TLS** — `ssl_certificate`/`ssl_certificate_key` on `listen 443 ssl`.

## Best practices
- Use `try_files $uri $uri/ =404;` (or to a front controller) instead of `if` for routing (https://nginx.org/en/docs/http/ngx_http_core_module.html#try_files).
- Forward client info on proxies: set `Host`, `X-Forwarded-For`, `X-Forwarded-Proto` (https://nginx.org/en/docs/http/ngx_http_proxy_module.html).
- Test config before reload: `nginx -t` then `nginx -s reload` (https://nginx.org/en/docs/beginners_guide.html).
- Enable gzip and sensible `keepalive_timeout`/buffer tuning for throughput (https://nginx.org/en/docs/http/ngx_http_gzip_module.html).

## Common pitfalls
- Overusing `if` inside `location` causes surprising behavior → prefer `try_files`/`map` ("if is evil").
- `proxy_pass` with a trailing slash vs none changes the rewritten URI → know the path-rewrite rule.
- Editing config without `nginx -t` can take down the server on reload → always test first.

## Examples
```nginx
upstream app { server 127.0.0.1:3000; }

server {
    listen 80;
    server_name example.com;

    location /static/ { root /var/www; }

    location / {
        proxy_pass http://app;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Further reading
- https://nginx.org/en/docs/beginners_guide.html — beginner's guide to running and configuring nginx
- https://nginx.org/en/docs/dirindex.html — alphabetical directive index

## Related skills
- ../spring — proxy a Spring Boot app behind Nginx
- ../symfony — serve Symfony's front controller via Nginx + PHP-FPM
