---
name: cloudflare
description: Cloudflare CDN, DNS, WAF, Workers edge compute, and Tunnels; consult for edge delivery, DNS, and exposing private origins securely.
domain: stack
category: infra
tags: [cdn, dns, edge, tunnel, workers, waf]
official_sources:
  - https://developers.cloudflare.com/
  - https://github.com/cloudflare/cloudflared
verified: 2026-06-16
---

# Cloudflare

## Overview
Cloudflare is a global network that sits in front of your sites and services to provide CDN caching, DNS, TLS, a Web Application Firewall, and edge compute (Workers). `cloudflared` additionally creates outbound-only Tunnels so you can expose a local or private origin without opening inbound firewall ports. Read this when you need to accelerate, protect, or securely publish a web service.

## Official sources
- Docs: https://developers.cloudflare.com/
- Repo (cloudflared): https://github.com/cloudflare/cloudflared
- Tunnel install methods: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/

## Install / setup
`cloudflared` is distributed as OS packages and binaries (Homebrew, Debian/RPM, Windows, Docker) rather than a single universal script. On macOS with Homebrew:
```bash
brew install cloudflared
```
See the repo and docs for Linux package and Docker installs.

## Core concepts
- CDN & caching: edge nodes cache origin responses; cache behavior is controlled by cache rules and response headers.
- DNS: Cloudflare acts as authoritative DNS; records can be proxied (orange-cloud, traffic flows through Cloudflare) or DNS-only (grey-cloud).
- WAF & security: managed and custom rules filter malicious requests at the edge before they reach the origin.
- Workers: serverless JavaScript/Wasm functions that run on the edge close to users.
- Tunnel (cloudflared): an outbound-only daemon that proxies traffic from Cloudflare's network to your origin, avoiding inbound port exposure.
- Zero Trust (Access/Gateway): identity-aware policies gate access to applications and networks.

## Best practices
- Proxy (orange-cloud) records you want protected/cached; keep records DNS-only when the service must not route through Cloudflare.
- Prefer Tunnels over opening inbound firewall ports for private origins, since cloudflared connects outbound only (see Cloudflare One docs).
- Use cache rules and appropriate `Cache-Control` headers rather than relying on defaults to avoid caching dynamic/private responses.
- Put authentication-sensitive apps behind Zero Trust Access policies instead of relying on network obscurity.

## Common pitfalls
- Proxying a record that needs the visitor's real IP → the origin sees Cloudflare IPs; read `CF-Connecting-IP` instead of the socket address.
- Caching authenticated or per-user responses → set proper cache bypass rules or no-store headers.
- Running a Tunnel without scoping its public hostname/routes → unintended exposure; define ingress rules explicitly.

## Examples
```bash
# Authenticate cloudflared and create a named tunnel
cloudflared tunnel login
cloudflared tunnel create my-app

# Route a hostname to the tunnel and run it
cloudflared tunnel route dns my-app app.example.com
cloudflared tunnel run my-app
```

## Further reading
- https://developers.cloudflare.com/workers/ — edge compute
- https://developers.cloudflare.com/cloudflare-one/ — Zero Trust and Tunnels

## Related skills
- ../tailscale — alternative private-network/VPN approach for device connectivity
