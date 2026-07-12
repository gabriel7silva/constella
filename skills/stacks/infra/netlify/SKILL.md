---
name: netlify
description: Managed hosting for web apps with Git deploys, functions, and edge; consult for deploys, redirects, env vars, and the Netlify CLI.
domain: stack
category: infra
tags: [hosting, serverless, frontend, deploy, cli, jamstack]
official_sources:
  - https://docs.netlify.com/
  - https://github.com/netlify/cli
verified: 2026-06-16
---

# Netlify

## Overview
Netlify is a managed platform for building and hosting web apps, providing Git-connected continuous deployment, serverless and edge functions, and per-deploy preview URLs. It targets static sites and frontend frameworks plus their attached backend functions. Read this when you need to deploy a web app, configure redirects/headers, or drive deploys with the CLI.

## Official sources
- Docs: https://docs.netlify.com/
- Repo (CLI): https://github.com/netlify/cli
- CLI install: https://docs.netlify.com/cli/get-started/

## Install / setup
```bash
npm install -g netlify-cli
```

## Core concepts
- Continuous deployment: connecting a Git repo triggers a build and deploy on each push.
- Deploy previews: pull requests/branches get isolated preview URLs before merging to production.
- Functions: serverless (and edge) functions deployed alongside the site for backend logic.
- `netlify.toml`: project configuration for build settings, redirects, headers, and function paths.
- Redirects & rewrites: rule-based routing (including SPA fallback and proxying) defined in config or a `_redirects` file.
- Environment variables: configured per site/context (production, deploy-preview, branch) and used during build and at runtime.

## Best practices
- Keep build, publish directory, redirects, and headers in `netlify.toml` so configuration is versioned with the code.
- For CI environments, install the CLI as a local dev dependency (`npm install netlify-cli --save-dev`) rather than relying on a global install (per the docs).
- Use an SPA catch-all redirect (`/* /index.html 200`) for client-side routed apps so deep links resolve.
- Scope environment variables to the correct deploy context to avoid leaking production secrets into previews.

## Common pitfalls
- Missing SPA redirect → client-side routes 404 on direct navigation.
- Setting a wrong publish directory → the build succeeds but the deployed site is empty or shows the wrong root.
- Expecting functions to hold state between invocations → they are stateless and short-lived; use external storage.

## Examples
```bash
# Authenticate, link the repo, and deploy to production
netlify login
netlify link
netlify deploy --prod
```

## Further reading
- https://docs.netlify.com/routing/redirects/ — redirects and rewrites
- https://docs.netlify.com/functions/overview/ — functions overview

## Related skills
- ../vercel — comparable managed frontend hosting platform
