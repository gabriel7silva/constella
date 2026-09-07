---
name: terraform
description: Terraform is HashiCorp's declarative infrastructure-as-code tool using HCL to provision cloud and on-prem resources; consult when writing .tf configs, managing state, using providers/modules, planning and applying changes, or working with variables, outputs, and remote backends.
domain: stack
category: infra
tags: [terraform, iac, hashicorp, hcl, devops, infrastructure, provisioning]
official_sources:
  - https://developer.hashicorp.com/terraform/docs
  - https://github.com/hashicorp/terraform
  - https://developer.hashicorp.com/terraform/install
verified: 2026-06-17
---

# Terraform

## Overview
Terraform is HashiCorp's infrastructure-as-code tool that lets you define cloud and on-prem infrastructure declaratively in HashiCorp Configuration Language (HCL). It computes an execution plan to reach the desired state and applies it through provider plugins, tracking real-world resources in a state file. Read this when authoring `.tf` configuration, managing state, or running the plan/apply lifecycle.

## Official sources
- Docs: https://developer.hashicorp.com/terraform/docs
- Repo: https://github.com/hashicorp/terraform
- Install: https://developer.hashicorp.com/terraform/install

## Install / setup
```bash
brew tap hashicorp/tap
brew install hashicorp/tap/terraform
```
Source: https://developer.hashicorp.com/terraform/install

## Core concepts
- **HCL** — declarative configuration language used in `.tf` files to describe resources.
- **Provider** — plugin (e.g. `aws`, `azurerm`) that maps HCL to a target API.
- **Resource** — a single infrastructure object (`resource "aws_instance" "web" {}`).
- **State** — recorded mapping of config to real resources (`terraform.tfstate`); source of truth for diffs.
- **Plan / apply** — `plan` previews changes; `apply` enacts them to converge to desired state.
- **Module** — reusable, parameterized grouping of resources for composition.
- **Variable / output** — inputs (`variable`) and exported values (`output`) for configurability.
- **Backend** — where state is stored (local, S3, Terraform Cloud) enabling remote/locked state.

## Best practices
- Store state remotely with locking (e.g. S3 + DynamoDB, Terraform Cloud) for team safety (https://developer.hashicorp.com/terraform/language/backend).
- Always review `terraform plan` output before `apply` (https://developer.hashicorp.com/terraform/cli/commands/plan).
- Pin provider and module versions with constraints to ensure reproducible runs (https://developer.hashicorp.com/terraform/language/providers/requirements).
- Structure reusable infrastructure as modules with explicit inputs/outputs (https://developer.hashicorp.com/terraform/language/modules).
- Run `terraform fmt` and `terraform validate` in CI before merging (https://developer.hashicorp.com/terraform/cli/commands/fmt).

## Common pitfalls
- Committing `terraform.tfstate` (often with secrets) to git → use a remote backend and gitignore local state.
- Manual ("click-ops") changes drift from config → run `terraform plan` to detect drift and reconcile.
- Unpinned versions cause surprise upgrades → set `required_providers` and `required_version` constraints.

## Examples
```hcl
terraform {
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
}

provider "aws" { region = "us-east-1" }

resource "aws_s3_bucket" "data" {
  bucket = "my-app-data-bucket"
}
```

## Further reading
- https://developer.hashicorp.com/terraform/language — HCL language reference
- https://registry.terraform.io/ — providers and modules registry
- https://developer.hashicorp.com/terraform/cli/commands — full CLI command reference

## Related skills
- ../ansible — configure resources after Terraform provisions them
- ../azure — target cloud provisioned with the azurerm provider
