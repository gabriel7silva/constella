---
name: azure
description: Microsoft Azure is Microsoft's public cloud platform managed via the az CLI; consult when provisioning Azure resources, authenticating with az login, scripting deployments, working with resource groups, ARM/Bicep templates, AKS, App Service, storage accounts, or managing Azure subscriptions from the command line.
domain: stack
category: infra
tags: [azure, cloud, microsoft, az-cli, devops, infrastructure, iac]
official_sources:
  - https://learn.microsoft.com/en-us/cli/azure/
  - https://github.com/Azure/azure-cli
  - https://learn.microsoft.com/en-us/cli/azure/install-azure-cli
verified: 2026-06-17
---

# Microsoft Azure

## Overview
Microsoft Azure is Microsoft's public cloud platform for compute, storage, networking, databases, and managed services. The Azure CLI (`az`) is the cross-platform command-line tool for creating and managing those resources via scripts or interactive commands. Read this when you need to authenticate to Azure, provision or query resources, or automate deployments from the terminal.

## Official sources
- Docs: https://learn.microsoft.com/en-us/cli/azure/
- Repo: https://github.com/Azure/azure-cli
- Install: https://learn.microsoft.com/en-us/cli/azure/install-azure-cli

## Install / setup
```bash
# Windows (Windows Package Manager)
winget install --exact --id Microsoft.AzureCLI
# then authenticate
az login
```
Source: https://learn.microsoft.com/en-us/cli/azure/install-azure-cli-windows

## Core concepts
- **Subscription** — billing/management boundary; each resource lives under one subscription (`az account show`).
- **Resource group** — logical container grouping related resources sharing lifecycle and region.
- **Resource provider** — service namespace (e.g. `Microsoft.Compute`) that must be registered to use its resources.
- **ARM / Bicep** — Azure Resource Manager is the deployment/control plane; Bicep is the declarative IaC DSL that compiles to ARM JSON.
- **Region** — physical datacenter location (e.g. `eastus`) where resources are deployed.
- **RBAC** — role-based access control assigns roles (Owner, Contributor, Reader) to identities at a scope.
- **Managed identity** — Azure-managed service principal so resources authenticate without stored secrets.
- **az login** — interactive (browser/device-code) or service-principal authentication establishing CLI context.

## Best practices
- Use resource groups to align resource lifecycle and apply tags for cost tracking (https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/overview).
- Prefer managed identities over storing credentials in code or config (https://learn.microsoft.com/en-us/entra/identity/managed-identities-azure-resources/overview).
- Define infrastructure with Bicep/ARM templates for repeatable, reviewable deployments (https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/overview).
- Run `az login --use-device-code` on headless/remote machines where no browser is available (https://learn.microsoft.com/en-us/cli/azure/authenticate-azure-cli).
- Keep the CLI current with `az upgrade` to get latest commands and fixes (https://learn.microsoft.com/en-us/cli/azure/update-azure-cli).

## Common pitfalls
- Forgetting to set the active subscription on multi-sub accounts → run `az account set --subscription <id>` before creating resources.
- `az` not found after install on Windows → close and reopen the terminal so PATH refreshes.
- Resource provider not registered → run `az provider register --namespace Microsoft.<Service>` and wait for it to complete.

## Examples
```bash
az group create --name myRG --location eastus
az storage account create \
  --name mystorage$RANDOM \
  --resource-group myRG \
  --location eastus \
  --sku Standard_LRS
```

## Further reading
- https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/ — Bicep IaC language reference
- https://learn.microsoft.com/en-us/cli/azure/reference-index — full `az` command reference
- https://learn.microsoft.com/en-us/azure/architecture/ — Azure Architecture Center patterns

## Related skills
- ../terraform — provision Azure resources declaratively with the azurerm provider
- ../ansible — configure Azure VMs and orchestrate post-provisioning
