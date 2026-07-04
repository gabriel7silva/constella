---
name: vercel-ai-sdk-elements
description: AI Elements — composable shadcn/ui components for AI-native apps (chat, reasoning, tools); consult when building AI SDK chat/agent UIs.
domain: reference
category: reference
tags: [ai-sdk, ai-elements, vercel, shadcn, react, ai-ui]
official_sources:
  - https://elements.ai-sdk.dev/
  - https://github.com/vercel/ai-elements
verified: 2026-06-16
---

# Vercel AI SDK — AI Elements

## Overview
AI Elements is Vercel's component library and custom registry built on top of shadcn/ui to help you build AI-native applications faster. It ships composable, focused pieces (Conversation, Message, Prompt Input, Reasoning, Sources, Tool, Attachments, and more) with deep AI SDK integration — streaming, status states, and type safety built in. Because it follows shadcn/ui conventions, your existing theme applies automatically. Read this when building chat, agent, or generative UIs on the AI SDK.

## Official sources
- Docs: https://elements.ai-sdk.dev/
- Repo: https://github.com/vercel/ai-elements
- Setup: https://elements.ai-sdk.dev/docs/setup
- AI SDK: https://ai-sdk.dev/

## Install / setup
```bash
npx ai-elements@latest
```
Add individual components:
```bash
npx ai-elements@latest add message
```
pnpm/bun equivalents are documented (`pnpm dlx ai-elements@latest`, `bunx --bun ai-elements@latest`); the AI Elements CLI auto-initializes shadcn/ui if it is not already present.

## Core concepts
- Built on shadcn/ui as a custom registry — components are added into your codebase (copy/own model), not hidden behind a dependency.
- Deep AI SDK integration: streaming, status states, and type safety are built into the components.
- Fully composable: small, focused primitives combine into custom chat/agent UIs rather than one monolithic widget.
- Component families span Chatbot (Conversation, Message, Prompt Input, Reasoning, Sources, Tool, Attachments), Code, Voice, and Workflow.
- CSS Variables mode only — relies on shadcn/ui's CSS-variable theming, so your tokens style the components.

## Best practices
- Initialize shadcn/ui and configure Tailwind CSS Variables mode before adding Elements (the CLI can set up shadcn/ui automatically).
- Run the CLI with your project's package runner (npx/pnpm dlx/bunx) so dependencies match your package manager.
- Compose primitives (Message + Reasoning + Sources + Tool) instead of building bespoke chat markup, so streaming and status handling come for free.
- Theme through shadcn/ui CSS variables so Elements inherit your brand automatically.

## Common pitfalls
- Expecting it to work without shadcn/ui or Tailwind → AI Elements requires shadcn/ui initialized and Tailwind configured (CSS Variables mode).
- Treating it as an npm UI dependency → components are added into your repo via the registry; you own and customize the code.
- Skipping the AI SDK wiring → Elements expect AI SDK message/streaming shapes; pair them with the SDK's hooks.

## Examples
```bash
# Add a chat conversation surface and prompt input
npx ai-elements@latest add conversation
npx ai-elements@latest add prompt-input
```

## Further reading
- Components index: https://elements.ai-sdk.dev/
- AI SDK UI docs: https://ai-sdk.dev/

## Related skills
- ../ai-attachments-ui — attachment UI patterns in AI Elements
- ../ai-tool-ui-patterns — rendering tool-call results
- ../shadcn-tailwind-theming — theming the underlying shadcn/ui layer
