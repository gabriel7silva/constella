---
name: amplify
description: AWS Amplify (Gen 2) is a TypeScript-first fullstack platform for building and hosting cloud backends on AWS (Auth via Cognito, data/GraphQL via AppSync+DynamoDB, Functions via Lambda, Storage via S3). Consult when scaffolding an Amplify backend, defining code-first cloud resources, running the sandbox, wiring auth/data/storage into a React/Next app, or deploying via Amplify Hosting.
domain: stack
category: baas
tags: [amplify, aws, baas, typescript, cognito, appsync, fullstack]
official_sources:
  - https://docs.amplify.aws/
  - https://github.com/aws-amplify/amplify-backend
  - https://www.npmjs.com/package/create-amplify
verified: 2026-06-17
---

# AWS Amplify

## Overview
AWS Amplify Gen 2 is a fullstack development platform that lets you define cloud backends in TypeScript and deploy them on AWS managed services — Cognito for auth, AppSync + DynamoDB for data, Lambda for functions, and S3 for storage. The code-first model generates infrastructure (CDK under the hood) and a typed client so frontend and backend ship together. Read this when scaffolding an Amplify backend, running the cloud sandbox, or integrating auth/data/storage into a web app deployed on Amplify Hosting.

## Official sources
- Docs: https://docs.amplify.aws/
- Repo: https://github.com/aws-amplify/amplify-backend
- Install: https://www.npmjs.com/package/create-amplify

## Install / setup
```bash
npm create amplify@latest
npx ampx sandbox
```
Source: https://docs.amplify.aws/react/start/manual-installation/

## Core concepts
- **Backend definition** — `amplify/backend.ts` composes resources via `defineBackend({ auth, data, storage })` in TypeScript.
- **Auth** — `defineAuth` provisions Amazon Cognito user pools (email/social/MFA) with typed access rules.
- **Data** — `defineData` builds an AppSync GraphQL API over DynamoDB from a typed schema with per-model authorization.
- **Functions** — `defineFunction` creates Lambda handlers triggered by data events, schedules, or auth flows.
- **Storage** — `defineStorage` provisions an S3 bucket with path-based access rules.
- **Sandbox** — `ampx sandbox` deploys an isolated per-developer cloud environment that hot-reloads on file changes.
- **amplify_outputs.json** — generated config consumed by `Amplify.configure()` to wire the frontend client.

## Best practices
- Use per-developer cloud sandboxes for iteration, not a shared environment (https://docs.amplify.aws/react/deploy-and-host/sandbox-environments/).
- Define authorization rules in the data schema (`a.allow.*`) rather than in client code (https://docs.amplify.aws/react/build-a-backend/data/customize-authz/).
- Connect a Git branch to Amplify Hosting for fullstack CI/CD deploys per commit (https://docs.amplify.aws/react/deploy-and-host/fullstack-branching/).
- Generate a typed data client with `generateClient<Schema>()` for end-to-end type safety (https://docs.amplify.aws/react/build-a-backend/data/connect-to-API/).

## Common pitfalls
- Confusing Gen 1 (CLI `amplify ...`) with Gen 2 (`ampx`/`create-amplify`) docs → follow Gen 2 only for new projects.
- Missing/expired AWS credentials or profile → sandbox deploy fails; configure an AWS profile first.
- Committing `amplify_outputs.json` from a teammate's sandbox → wrong endpoints; regenerate locally.

## Examples
```typescript
// amplify/data/resource.ts
import { a, defineData, type ClientSchema } from "@aws-amplify/backend";

const schema = a.schema({
  Todo: a.model({ content: a.string() }).authorization(allow => [allow.owner()]),
});

export type Schema = ClientSchema<typeof schema>;
export const data = defineData({ schema });
```

## Further reading
- https://docs.amplify.aws/react/start/ — React getting-started guide
- https://docs.amplify.aws/react/build-a-backend/ — building auth/data/storage/functions
- https://aws-amplify.github.io/amplify-backend/ — Amplify Toolbox / ampx reference

## Related skills
- ../firebase — comparable Google BaaS with auth/data/functions
- ../appwrite — open-source self-hosted BaaS alternative
