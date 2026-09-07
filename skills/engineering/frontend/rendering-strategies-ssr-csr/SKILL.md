---
name: rendering-strategies-ssr-csr
description: Trade-offs between SSR, CSR, static rendering, and streaming for web apps; consult when choosing where and when UI is rendered.
domain: engineering
category: frontend
tags: [ssr, csr, ssg, streaming, hydration, rendering, nextjs]
official_sources:
  - https://web.dev/articles/rendering-on-the-web
  - https://nextjs.org/docs/app/getting-started/server-and-client-components
  - https://github.com/vercel/next.js
verified: 2026-06-16
---

# Rendering Strategies (SSR / CSR / Static / Streaming)

## Overview
Where and when you render HTML — on the server, in the browser, at build time, or progressively streamed — affects first paint, interactivity, and the amount of JavaScript shipped. There is no single best choice; each strategy trades time-to-first-byte, first contentful paint, and interactivity differently. Read this when picking a rendering approach for a page or framework, or diagnosing slow loads.

## Official sources
- Google web.dev — Rendering on the Web: https://web.dev/articles/rendering-on-the-web
- Next.js — Server and Client Components: https://nextjs.org/docs/app/getting-started/server-and-client-components
- Repo (Next.js): https://github.com/vercel/next.js

## Core concepts
- **Server-side rendering (SSR).** Render the app on the server and send HTML; this gives fast first contentful paint and ships less JavaScript, but server work can delay time-to-first-byte (web.dev/articles/rendering-on-the-web).
- **Client-side rendering (CSR).** Render in the browser with JavaScript modifying the DOM; large bundles can hurt interactivity (INP) (web.dev/articles/rendering-on-the-web).
- **Static rendering (SSG).** Generate HTML at build time, one file per URL, for fast FCP and low blocking time; struggles when URLs are unpredictable (web.dev/articles/rendering-on-the-web).
- **Hydration / rehydration.** Run client scripts to attach state and interactivity to server-rendered HTML; done poorly, a page can look interactive before it actually is (web.dev/articles/rendering-on-the-web).
- **Streaming SSR.** Send HTML in chunks the browser renders progressively, improving perceived load (web.dev/articles/rendering-on-the-web).
- **Server vs Client Components (Next.js).** Components default to the server for data fetching and smaller bundles; mark interactive ones with `'use client'`, and stream server-rendered chunks to the client (nextjs.org server-and-client-components).

## Best practices
- Measure where the bottleneck is (TTFB, FCP, INP) before choosing a strategy; the right answer depends on your content and audience (web.dev/articles/rendering-on-the-web).
- Prefer server rendering for data-fetching and secret access, keeping API keys off the client and reducing shipped JavaScript (nextjs.org server-and-client-components).
- Add `'use client'` to the smallest interactive components rather than large subtrees, so static parts stay server-rendered and bundles stay small (nextjs.org server-and-client-components).
- Use streaming with `<Suspense>` boundaries so a fast shell renders while slower, dynamic content streams in (nextjs.org server-and-client-components).

## Common pitfalls
- Shipping a large CSR bundle for content that could be static or server-rendered → use SSR/SSG to cut JavaScript and improve FCP (web.dev/articles/rendering-on-the-web).
- Marking large subtrees `'use client'` → every import in that file joins the client bundle; scope the directive to the interactive leaf (nextjs.org server-and-client-components).

## Examples
```tsx
// Next.js App Router: Server Component fetches data; only the leaf is a Client Component.
import LikeButton from './like-button'; // 'use client' lives in this file

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await getPost(id); // runs on the server
  return <article><h1>{post.title}</h1><LikeButton likes={post.likes} /></article>;
}
```

## Further reading
- https://web.dev/articles/rendering-on-the-web — full SSR/CSR/static/streaming trade-off guide
- https://nextjs.org/docs/app/getting-started — Next.js App Router fundamentals

## Related skills
- ../frontend-architecture — code-splitting and component boundaries
- ../state-management — hydrating and managing state across the server/client boundary
