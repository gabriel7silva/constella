---
name: ai-tool-ui-patterns
description: UI patterns for AI tool-calls and results — turn tool JSON into typed, validated components; consult when rendering tool outputs in chat.
domain: reference
category: reference
tags: [tool-ui, ai-ui, tool-calling, zod, shadcn, assistant-ui]
official_sources:
  - https://www.tool-ui.com/docs/overview
  - https://github.com/assistant-ui/tool-ui
verified: 2026-06-16
---

# AI Tool UI Patterns

## Overview
When a model calls a tool, most apps dump raw JSON into the conversation. Tool UI (by the assistant-ui project) is an open-source component library where each component turns a specific kind of tool output — a card, table, option list, chart, approval, form, or media card — into real, interactive UI so users can understand and act without leaving the chat. It is JSON-native, typed (Zod schemas), accessible, and built on Tailwind, Radix, and shadcn/ui. Read this when designing how tool-call results render and how users approve or respond to them.

## Official sources
- Docs: https://www.tool-ui.com/docs/overview
- Repo: https://github.com/assistant-ui/tool-ui
- Quick start: https://www.tool-ui.com/docs/quick-start

## Install / setup
```bash
npx shadcn@latest add @tool-ui/link-preview
```
Components use the shadcn copy/paste model — they live in your codebase with no dependency lock-in; swap `link-preview` for any component name.

## Core concepts
- Each component maps one kind of tool output to UI (table, chart, option list, approval, form, media card), instead of showing raw JSON.
- Copy/paste model (like shadcn/ui): components live in your repo, so there is no dependency lock-in.
- Every component ships a colocated `schema.ts` Zod schema; tool output is validated, rendered when valid, and fails safely when not.
- A three-part flow: backend tool defines input/output via AI SDK + Zod, the schema validates on server and client, and a frontend `toolkit` maps tool names to components.
- Built on Tailwind, Radix, and shadcn/ui, so it inherits accessible primitives and your theme.

## Best practices
- Validate tool output against the component's Zod schema on both server and client before rendering.
- Maintain a `toolkit` mapping of backend tool names to frontend components so the runtime can pick the right renderer.
- Prefer interactive surfaces (approvals, forms) over read-only JSON dumps for actions the user must take.
- Since components are copied into your repo, version and customize them deliberately rather than expecting upstream updates.

## Common pitfalls
- Rendering unvalidated tool JSON → parse against the Zod schema and fail safely when it does not match.
- Hard-coding which component renders a tool → use the `toolkit` name→component map so new tools are easy to wire.
- Treating it like an installed npm package → it is copy/paste; you own the code and its updates.

## Examples
```ts
// Register tools -> components so the runtime knows what to render.
const toolkit = {
  getMetrics: MetricsTable,
  deployPlan: ApprovalCard,
  linkPreview: LinkPreview,
};
```

## Further reading
- Quick start: https://www.tool-ui.com/docs/quick-start
- assistant-ui project: https://github.com/assistant-ui

## Related skills
- ../vercel-ai-sdk-elements — AI Elements (includes a Tool component)
- ../ai-attachments-ui — attachment UI patterns
