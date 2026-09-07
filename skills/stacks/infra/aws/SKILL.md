---
name: aws
description: Amazon Web Services cloud platform and AWS CLI; consult for compute, storage, networking, IAM, and scripting AWS resources.
domain: stack
category: infra
tags: [cloud, aws, iam, ec2, s3, cli]
official_sources:
  - https://docs.aws.amazon.com/
  - https://github.com/aws/aws-cli
verified: 2026-06-16
---

# AWS (Amazon Web Services)

## Overview
AWS is a broad cloud platform offering compute (EC2, Lambda), storage (S3, EBS), databases, networking (VPC), and identity (IAM), among hundreds of services. The AWS CLI (`aws`) is the unified command-line tool for managing these resources and scripting automation. Read this when you need to provision, manage, or script AWS infrastructure.

## Official sources
- Docs: https://docs.aws.amazon.com/
- Repo (AWS CLI): https://github.com/aws/aws-cli
- CLI install: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html

## Install / setup
Linux (x86_64), copied verbatim from the official install page:
```bash
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
```

## Core concepts
- Regions & Availability Zones: resources live in a region, which contains isolated AZs for fault tolerance.
- IAM: identities (users, roles) and policies that grant least-privilege permissions to AWS actions and resources.
- EC2 & Lambda: virtual machines for long-running compute vs. event-driven serverless functions.
- S3: object storage organized into buckets with fine-grained access policies.
- VPC: a logically isolated virtual network with subnets, route tables, and security groups.
- Credentials & profiles: the CLI resolves credentials from environment variables, shared config/credentials files, and named profiles.

## Best practices
- Grant least-privilege IAM policies and prefer roles over long-lived access keys (per AWS IAM best practices).
- Avoid using the account root user for everyday tasks; create scoped IAM identities instead.
- Scope resources to the correct region and use multiple AZs for high availability.
- In CI, use short-lived role credentials (e.g. OIDC-assumed roles) rather than embedding static keys.

## Common pitfalls
- Running a CLI command with no/incorrect `--region` or profile → it targets the wrong region or fails to find resources.
- Over-broad IAM policies (`Action: "*"`) → security risk; scope to specific actions and resources.
- Public S3 bucket misconfiguration → unintended data exposure; verify bucket policies and Block Public Access.

## Examples
```bash
# Configure credentials and a default region
aws configure

# List S3 buckets and copy a file
aws s3 ls
aws s3 cp ./report.csv s3://my-bucket/report.csv
```

## Further reading
- https://docs.aws.amazon.com/cli/latest/userguide/ — AWS CLI user guide
- https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html — IAM best practices

## Related skills
- ../gcp — comparable hyperscale cloud platform
- ../kubernetes — container orchestration often run on AWS (EKS)
