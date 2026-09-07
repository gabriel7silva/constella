[✦ Constella](../../README.pt-BR.md) · [🇬🇧 English](../en/README.md)

![](../assets/divider-orbit.svg)

# 🌌 Documentação da Constella

> O mapa completo do plano de controle Constella. Toda página segue a mesma estrutura — propósito, como
> funciona, fluxos, conceitos, tabelas, diagramas Mermaid, passo a passo, exemplos, estados, integrações,
> segurança, troubleshooting e links relacionados.

**Novo por aqui?** Comece por [Instalação](INSTALLATION.md) → [Onboarding](ONBOARDING.md) →
[Configuração](CONFIGURATION.md), e então escolha um destino de instalação, e veja [Operações](OPERATIONS.md) para executá-lo.

---

## 🌱 Primeiros passos

| Doc | O que cobre |
|-----|-------------|
| [Instalação](INSTALLATION.md) | Rodar via `npx` ou instalação global `npm`; requisitos; primeiro boot |
| [Onboarding](ONBOARDING.md) | O wizard de setup, import de projeto, a SUPER-SPEC e o starter executável |
| [Configuração](CONFIGURATION.md) | Toda variável de ambiente, portas, o arquivo `<HOME>/.env`, o vault |

## 🌠 Instalação & execução

A autenticação é sempre exigida (e-mail + senha), idêntica em todos — a flag de execução só escolhe o destino de instalação.

| Doc | O que cobre |
|-----|-------------|
| [Start (local)](START_MODE.md) | `constella --start`, escuta em `127.0.0.1` — a instalação local padrão |
| [VPS](VPS_MODE.md) | `constella --vps`, escuta em `0.0.0.0` sobre uma tailnet Tailscale (nativo, sem Docker) |
| [Portable (USB)](PORTABLE_MODE.md) | `constella --portable`, roda a partir de um pen-drive, escuta em `0.0.0.0` |

## 🛰️ Arquitetura

| Doc | O que cobre |
|-----|-------------|
| [Arquitetura](ARCHITECTURE.md) | Web + worker, runtime root, jail de FS, SQLite, sync engine |
| [Arquitetura de IA](AI_ARCHITECTURE.md) | Adaptadores de CLI, spawn de agentes, montagem de contexto, custo |
| [Segurança](SECURITY.md) | Jail, vault, scrubbing, locks, guarda de comandos, auth |

## ✦ Agentes & trabalho

| Doc | O que cobre |
|-----|-------------|
| [Agentes](AGENTS.md) | O elenco de 10 agentes, personas, hierarquia, modelos, tetos |
| [Design](DESIGN.md) | O canvas visual da Grace → gate de design → promoção → handoff do CEO |
| [Agente de KB (Vannevar)](KB_AGENT.md) | O agente de Conhecimento: indexação, curadoria, propostas de skill |
| [Agente PO (Donald)](PO_AGENT.md) | Grooming de backlog, story points, MoSCoW |
| [Workflow](WORKFLOW.md) | Goal → Spec → Issue → Plan → Execution → Review → Test → Done |
| [Goals, Specs, Issues, Plans](GOALS_SPECS_ISSUES.md) | O modelo de dados do trabalho e as máquinas de estado |
| [Team Room](TEAM_ROOM.md) | Coordenação multi-agente por `@menção` |
| [DM](DM.md) | Canais de mensagem direta e sessões |
| [Comandos de chat](CHAT_COMMANDS.md) | Todo slash command |
| [Inbox](INBOX.md) | Duplicatas, lacunas e propostas em destaque |

## 🌌 Conhecimento

| Doc | O que cobre |
|-----|-------------|
| [Base de Conhecimento & RAG](KB_RAG.md) | KB curada, taxonomia, embeddings, recuperação |
| [Memory RAG](MEMORY_RAG.md) | Recuperação sobre arquivos e conversas |
| [Synced Blocks](SYNCED_BLOCKS.md) | Blocos canônicos e propostas de agentes |

## 🪐 Capacidades

| Doc | O que cobre |
|-----|-------------|
| [Skills](SKILLS.md) | A biblioteca de skills em Markdown e o vínculo com agentes |
| [Project Stacks](PROJECT_STACKS.md) | Como seu stack guia skills, pesquisa e RAG |
| [Plugins](PLUGINS.md) | Integrações nativas e o modelo de plugins |
| [Modelos](MODELS.md) | Adaptadores de nuvem + CLI, GGUF local, fit-check de GPU |

## 🤖 Integrações

| Doc | O que cobre |
|-----|-------------|
| [Telegram](TELEGRAM.md) | Controle remoto pelo celular |
| [GitHub](GITHUB.md) | Vínculo de repo, commit vs export limpo |
| [API Pública](PUBLIC_API.md) | A API REST protegida por PAT |
| [MCP](MCP.md) | O servidor MCP que permite hosts de IA dirigirem a Constella |

## 🚀 Entrega & operação

| Doc | O que cobre |
|-----|-------------|
| [Operações](OPERATIONS.md) | Iniciar, parar, reiniciar, status, logs, update, rollback, desinstalar — local + VPS |
| [Test Dev](TEST_DEV.md) | Subir e testar o projeto de forma headless |
| [Prepare Deploy](PREPARE_DEPLOY.md) | Pipeline de build de árvore limpa e export |
| [Deploy](DEPLOY.md) | Deploy da própria Constella em produção |
| [Publishing](PUBLISHING.md) | Empacotamento npm e publicação pública limpa |
| [Update](UPDATE.md) | Verificação de versão e updates sensíveis ao contexto |
| [Troubleshooting](TROUBLESHOOTING.md) | Sintomas, causas e correções |
| [FAQ](FAQ.md) | Perguntas frequentes |

---

Histórico do projeto: [Changelog](../../CHANGELOG.pt-BR.md) · Portal principal: [✦ Constella README](../../README.pt-BR.md)
