---
name: ai-in-browser-webllm
description: Run LLMs fully in-browser/locally with WebLLM via WebGPU; consult for client-side inference, offline AI, and OpenAI-style chat without a server.
domain: reference
category: reference
tags: [webllm, llm, webgpu, in-browser, mlc, local-inference]
official_sources:
  - https://webllm.mlc.ai/docs/
  - https://github.com/mlc-ai/web-llm
verified: 2026-06-16
---

# WebLLM — In-Browser LLM Inference

## Overview
WebLLM is a high-performance, in-browser LLM inference engine from the MLC project. It runs open models (Llama 3, Phi 3, Gemma, Mistral, Qwen, and more) entirely on the client using WebGPU for hardware acceleration, with no server-side processing. It exposes an OpenAI-compatible API (streaming, JSON mode), making it useful for privacy-preserving, offline-capable, or zero-backend AI features. Read this when you need client-side inference in a web app.

## Official sources
- Docs: https://webllm.mlc.ai/docs/
- Repo: https://github.com/mlc-ai/web-llm
- Getting started: https://webllm.mlc.ai/docs/user/get_started.html

## Install / setup
```bash
npm install @mlc-ai/web-llm
```
yarn and pnpm equivalents are documented:
```bash
yarn add @mlc-ai/web-llm
pnpm install @mlc-ai/web-llm
```

## Core concepts
- `MLCEngine` is the core interface for model loading, chat completions, and embeddings; create it with the `CreateMLCEngine` factory or `new MLCEngine()` then `engine.reload(model)`.
- Models load asynchronously; pass an `initProgressCallback` to surface download/compile progress to users (first load can be large).
- WebGPU is the acceleration backend — runs entirely in-browser with no server support required.
- OpenAI-compatible chat completion API, including streaming and structured JSON-mode output.
- Built-in model registry plus support for custom MLC-format models compiled via MLC LLM.
- Cache backends for model weights: Cache API, IndexedDB, OPFS, and Cross-Origin Storage; optional SRI integrity verification.

## Best practices
- Offload generation to a Web Worker or Service Worker so heavy compute does not block the main UI thread (documented in Advanced Use Cases).
- Reuse a single loaded engine instance and persist weights in a cache backend to avoid re-downloading on every visit.
- Always wire `initProgressCallback` so users see progress during the first (potentially large) model download.
- Pick the smallest model that meets quality needs; in-browser memory and download size are real constraints.

## Common pitfalls
- Assuming it works everywhere → WebGPU support is required; gate the feature and provide a fallback when the browser/device lacks it.
- Loading the model on the main thread → use a Web Worker / Service Worker to keep the UI responsive.
- Treating first load as instant → weights must download and compile; cache them and show progress.

## Examples
```javascript
import { CreateMLCEngine } from "@mlc-ai/web-llm";

const engine = await CreateMLCEngine(
  "Llama-3.1-8B-Instruct-q4f32_1-MLC",
  { initProgressCallback: (p) => console.log(p) }
);

const reply = await engine.chat.completions.create({
  messages: [{ role: "user", content: "Hello!" }],
});
console.log(reply.choices[0].message.content);
```

## Further reading
- Basic Usage: https://webllm.mlc.ai/docs/user/basic_usage.html
- API Reference: https://webllm.mlc.ai/docs/user/api_reference.html
- Advanced Use Cases (Web Worker): https://webllm.mlc.ai/docs/user/advanced_usage.html

## Related skills
- ../vercel-ai-sdk-elements — UI components for AI-native apps
- ../ai-tool-ui-patterns — rendering tool-call results in chat UIs
