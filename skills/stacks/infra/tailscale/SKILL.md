---
name: tailscale
description: Zero-config WireGuard mesh VPN; consult for private networking, ACLs, subnet routing, and secure device-to-device connectivity.
domain: stack
category: infra
tags: [vpn, wireguard, networking, mesh, zero-trust]
official_sources:
  - https://tailscale.com/kb/
  - https://github.com/tailscale/tailscale
verified: 2026-06-16
---

# Tailscale

## Overview
Tailscale builds a private mesh network ("tailnet") between your devices using the WireGuard protocol, with automatic NAT traversal and key distribution handled by a coordination server. It removes the need to manually configure WireGuard keys, firewall holes, or a central VPN concentrator. Read this when you need secure, encrypted connectivity between machines, services, or users without exposing public ports.

## Official sources
- Docs: https://tailscale.com/kb/
- Repo: https://github.com/tailscale/tailscale
- Install / download: https://tailscale.com/download

## Install / setup
```bash
curl -fsSL https://tailscale.com/install.sh | sh
```

## Core concepts
- Tailnet: the private network of all devices logged into your Tailscale account/organization; each device gets a stable 100.x.y.z address.
- WireGuard data plane: traffic is end-to-end encrypted directly between peers; the coordination server only brokers keys and metadata, not user traffic.
- NAT traversal: Tailscale establishes direct peer connections where possible and falls back to encrypted DERP relays when direct paths are blocked.
- ACLs: a centrally managed policy file defines which devices and identity groups may reach which others, defaulting to deny.
- Subnet routers: a node can advertise routes so the tailnet reaches non-Tailscale hosts (e.g. an on-prem subnet or cloud VPC).
- Exit nodes: a node can route all internet traffic for other devices, acting like a traditional full-tunnel VPN egress.
- MagicDNS: assigns memorable DNS names to devices so you connect by hostname instead of IP.

## Best practices
- Define least-privilege ACLs rather than relying on the default "allow all" tailnet policy (see Tailscale KB on access control).
- Use tagged ACL identities (`tag:server`) for servers and CI nodes instead of personal user logins, so access survives staff changes.
- Apply key expiry and device approval for sensitive tailnets to limit the blast radius of a leaked node.
- Prefer ephemeral nodes for short-lived/CI workloads so stale devices do not accumulate in the tailnet.

## Common pitfalls
- Forgetting to enable IP forwarding and `--advertise-routes` on a subnet router → the advertised subnet is unreachable; routes must also be approved in the admin console.
- Leaving devices with non-expiring keys → revoking access later is harder; set key expiry per the docs.
- Assuming all connections are direct → behind strict NATs traffic relays through DERP, adding latency; check `tailscale status` for the relay indicator.

## Examples
```bash
# Bring a node onto the tailnet
sudo tailscale up

# Advertise a local subnet so the tailnet can reach it
sudo tailscale up --advertise-routes=10.0.0.0/24

# Inspect connectivity and peer relay status
tailscale status
```

## Further reading
- https://tailscale.com/kb/1019/subnets/ — subnet routers
- https://tailscale.com/kb/1018/acls/ — access control policy

## Related skills
- ../cloudflare — alternative for tunnels and zero-trust access to private services
