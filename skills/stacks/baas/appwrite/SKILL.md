---
name: appwrite
description: Appwrite is an open-source, self-hostable Backend-as-a-Service (Auth, Databases, Storage, Functions, Messaging, Realtime, Hosting) deployable via Docker. Consult when self-hosting a backend, adding authentication, building a document database, running serverless functions, handling file storage, or using the Appwrite CLI and client SDKs for web/mobile/Flutter apps.
domain: stack
category: baas
tags: [appwrite, baas, self-hosted, docker, open-source, auth, serverless]
official_sources:
  - https://appwrite.io/docs
  - https://github.com/appwrite/appwrite
  - https://github.com/appwrite/sdk-for-cli
verified: 2026-06-17
---

# Appwrite

## Overview
Appwrite is an open-source Backend-as-a-Service that packages authentication, a document database, file storage, serverless Functions, Messaging, and Realtime behind REST/GraphQL APIs and client SDKs. It runs as a set of Docker containers you self-host (or use Appwrite Cloud), giving you a Firebase-style backend you fully control. Read this when self-hosting a backend, wiring up auth/databases/storage/functions, or scripting deployments with the Appwrite CLI.

## Official sources
- Docs: https://appwrite.io/docs
- Repo: https://github.com/appwrite/appwrite
- Install: https://github.com/appwrite/sdk-for-cli

## Install / setup
```bash
docker run -it --rm \
    --publish 20080:20080 \
    --volume /var/run/docker.sock:/var/run/docker.sock \
    --volume "$(pwd)"/appwrite:/usr/src/code/appwrite:rw \
    --entrypoint="install" \
    appwrite/appwrite:1.9.0
```
Source: https://appwrite.io/docs/advanced/self-hosting/installation (CLI: `npm install -g appwrite-cli`)

## Core concepts
- **Project** — isolated namespace holding databases, users, functions, and API keys; created in the Console.
- **Databases / Collections / Documents** — structured document store with typed attributes, indexes, and per-document permissions.
- **Authentication** — sessions and accounts supporting email/password, OAuth2, magic URL, phone, anonymous, and JWT.
- **Permissions** — role/user-scoped access (`read`, `create`, `update`, `delete`) set on collections or individual documents.
- **Functions** — serverless code in many runtimes, triggered by HTTP, events, or schedules; deployed via CLI.
- **Storage** — file buckets with encryption, antivirus scanning, and on-the-fly image transforms.
- **Realtime** — WebSocket subscriptions to channels for live document, file, and account updates.

## Best practices
- Set collection/document permissions explicitly; default is no access until granted (https://appwrite.io/docs/advanced/platform/permissions).
- Use server SDKs with API keys for trusted backends and the lighter client SDKs in apps (https://appwrite.io/docs/sdks).
- Pin a specific Appwrite version tag and follow the updates/migrations guide between minors — install the new version, then run the Appwrite migration tool (https://appwrite.io/docs/advanced/self-hosting/production/updates).
- Configure `_APP_DOMAIN` and TLS/Traefik for production rather than localhost defaults (https://appwrite.io/docs/advanced/self-hosting).

## Common pitfalls
- Leaving the default `.env` secrets/keys from install → insecure server; rotate `_APP_OPENSSL_KEY_V1` and API keys.
- Exposing API keys in client-side code → use scoped client SDK + permissions, keep API keys server-only.
- Forgetting to register a platform (web/Flutter) for your hostname → CORS blocks requests; add it in Console settings.

## Examples
```javascript
import { Client, Databases, ID } from "appwrite";

const client = new Client()
  .setEndpoint("http://localhost/v1")
  .setProject("YOUR_PROJECT_ID");

const db = new Databases(client);
await db.createDocument({
  databaseId: "dbId",
  collectionId: "messages",
  documentId: ID.unique(),
  data: { text: "hello" },
});
```

## Further reading
- https://appwrite.io/docs/advanced/self-hosting — self-hosting and production setup
- https://appwrite.io/docs/products/databases — Databases product guide
- https://github.com/appwrite/sdk-for-cli — official CLI and deployment tooling

## Related skills
- ../firebase — proprietary Google BaaS with comparable feature set
- ../amplify — AWS fullstack BaaS alternative
