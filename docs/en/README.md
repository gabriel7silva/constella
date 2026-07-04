[✦ Constella](../../README.md) · [🇧🇷 Português](../pt/README.md)

![](../assets/divider-orbit.svg)

# 🌌 Constella Documentation

> The complete map of the Constella control plane. Every page follows the same structure — purpose, how it
> works, flows, concepts, tables, Mermaid diagrams, step-by-step, examples, states, integrations, security,
> troubleshooting and related links.

**New here?** Start with [Installation](INSTALLATION.md) → [Onboarding](ONBOARDING.md) →
[Configuration](CONFIGURATION.md), then pick an install target, and see [Operations](OPERATIONS.md) to run it.

---

## 🌱 Getting started

| Doc | What it covers |
|-----|----------------|
| [Installation](INSTALLATION.md) | Run via `npx` or a global `npm` install; requirements; first boot |
| [Onboarding](ONBOARDING.md) | The setup wizard, importing a project, the SUPER-SPEC and runnable starter |
| [Configuration](CONFIGURATION.md) | Every environment variable, ports, the `<HOME>/.env` file, the vault |

## 🌠 Install & run

Auth is always required (email + password), identical everywhere — the launch flag only picks the install target.

| Doc | What it covers |
|-----|----------------|
| [Start (local)](START_MODE.md) | `constella --start`, binds `127.0.0.1` — the default local install |
| [VPS](VPS_MODE.md) | `constella --vps`, binds `0.0.0.0` over a Tailscale tailnet (native, no Docker) |
| [Portable (USB)](PORTABLE_MODE.md) | `constella --portable`, runs off a USB drive, binds `0.0.0.0` |

## 🛰️ Architecture

| Doc | What it covers |
|-----|----------------|
| [Architecture](ARCHITECTURE.md) | Web + worker, runtime root, FS jail, SQLite, sync engine |
| [AI Architecture](AI_ARCHITECTURE.md) | CLI adapters, agent spawning, context assembly, cost |
| [Security](SECURITY.md) | Jail, vault, scrubbing, locks, command guard, auth |

## ✦ Agents & work

| Doc | What it covers |
|-----|----------------|
| [Agents](AGENTS.md) | The 10-agent roster, personas, hierarchy, models, caps |
| [Design](DESIGN.md) | Grace's visual canvas → design gate → promotion → CEO handoff |
| [KB Agent (Vannevar)](KB_AGENT.md) | The Knowledge agent: indexing, curation, skill proposals |
| [PO Agent (Donald)](PO_AGENT.md) | Backlog grooming, story points, MoSCoW |
| [Workflow](WORKFLOW.md) | Goal → Spec → Issue → Plan → Execution → Review → Test → Done |
| [Goals, Specs, Issues, Plans](GOALS_SPECS_ISSUES.md) | The work data model and state machines |
| [Team Room](TEAM_ROOM.md) | Multi-agent coordination by `@mention` |
| [DM](DM.md) | Direct-message channels and sessions |
| [Chat Commands](CHAT_COMMANDS.md) | Every slash command |
| [Inbox](INBOX.md) | Surfaced duplicates, gaps and proposals |

## 🌌 Knowledge

| Doc | What it covers |
|-----|----------------|
| [Knowledge Base & RAG](KB_RAG.md) | Curated KB, taxonomy, embeddings, retrieval |
| [Memory RAG](MEMORY_RAG.md) | Retrieval over files and conversations |
| [Synced Blocks](SYNCED_BLOCKS.md) | Canonical blocks and agent proposals |

## 🪐 Capabilities

| Doc | What it covers |
|-----|----------------|
| [Skills](SKILLS.md) | The Markdown skills library and agent linking |
| [Project Stacks](PROJECT_STACKS.md) | How your stack drives skills, research and RAG |
| [Plugins](PLUGINS.md) | Native integrations and the plugin model |
| [Models](MODELS.md) | Cloud + CLI adapters, local GGUF, GPU fit-check |

## 🤖 Integrations

| Doc | What it covers |
|-----|----------------|
| [Telegram](TELEGRAM.md) | Remote control from your phone |
| [GitHub](GITHUB.md) | Repo binding, commit vs clean export |
| [Public API](PUBLIC_API.md) | The PAT-secured REST API |
| [MCP](MCP.md) | The MCP server that lets AI hosts drive Constella |

## 🚀 Delivery & ops

| Doc | What it covers |
|-----|----------------|
| [Operations](OPERATIONS.md) | Start, stop, restart, status, logs, update, rollback, uninstall — local + VPS |
| [Test Dev](TEST_DEV.md) | Boot and headlessly test your project |
| [Prepare Deploy](PREPARE_DEPLOY.md) | Clean-tree build and export pipeline |
| [Deploy](DEPLOY.md) | Deploying Constella itself to production |
| [Publishing](PUBLISHING.md) | npm packaging and clean public publishing |
| [Update](UPDATE.md) | Version checks and context-aware updates |
| [Troubleshooting](TROUBLESHOOTING.md) | Symptoms, causes and fixes |
| [FAQ](FAQ.md) | Frequently asked questions |

---

Project history: [Changelog](../../CHANGELOG.md) · Main portal: [✦ Constella README](../../README.md)
