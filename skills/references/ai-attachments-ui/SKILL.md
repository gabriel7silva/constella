---
name: ai-attachments-ui
description: Attachment UI patterns for AI chat using AI Elements' Attachments component; consult when showing files/sources in prompts and messages.
domain: reference
category: reference
tags: [ai-elements, attachments, file-upload, ai-ui, shadcn, react]
official_sources:
  - https://elements.ai-sdk.dev/components/attachments
  - https://github.com/vercel/ai-elements
verified: 2026-06-16
---

# AI Attachments UI

## Overview
The Attachments component from Vercel's AI Elements provides a unified way to display file attachments and source documents in AI chat UIs, with grid, inline, and list layout variants. It is a set of composable sub-components that render previews, file info, and a remove control, and it accepts AI SDK `FileUIPart` / `SourceDocumentUIPart` data. Read this when building file-upload affordances in a prompt input or showing attached/source files inside messages.

## Official sources
- Docs: https://elements.ai-sdk.dev/components/attachments
- Repo: https://github.com/vercel/ai-elements
- Setup: https://elements.ai-sdk.dev/docs/setup

## Install / setup
```bash
npx ai-elements@latest add attachments
```
Requires shadcn/ui initialized and Tailwind CSS Variables mode (per AI Elements setup).

## Core concepts
- `<Attachments />` is the container and takes a `variant` of `"grid" | "inline" | "list"` to control layout.
- `<Attachment />` wraps a single item and accepts `data` (a `FileUIPart` or `SourceDocumentUIPart` with an id) plus an `onRemove` callback.
- Composable sub-parts: `<AttachmentPreview />` (image/video/icon), `<AttachmentInfo />` (filename + media type), `<AttachmentRemove />` (remove button), `<AttachmentHoverCard />` (hover preview), `<AttachmentEmpty />` (empty state).
- `AttachmentInfo` exposes `showMediaType`, and `AttachmentRemove` accepts a custom `label` for accessibility.
- Designed to map directly over AI SDK file/source-document parts, so it pairs naturally with Prompt Input and Message.

## Best practices
- Choose the layout `variant` to match context: `grid` for galleries, `inline` for compact prompt-bar chips, `list` for detailed/source views.
- Provide an accessible `label` on `AttachmentRemove` so screen-reader users understand the remove action.
- Render attachments by mapping AI SDK `FileUIPart` data rather than inventing a parallel attachment shape.
- Use `AttachmentEmpty` to communicate the empty state instead of rendering nothing.

## Common pitfalls
- Passing data without a stable `id` → each attachment's `data` should carry an id so list rendering and removal stay correct.
- Building custom remove buttons → use `AttachmentRemove` with `onRemove` so behavior and a11y are handled.
- Forgetting media-type cues → enable `showMediaType` / previews so users can tell files apart at a glance.

## Examples
```tsx
<Attachments variant="grid">
  {files.map((file) => (
    <Attachment key={file.id} data={file} onRemove={() => remove(file.id)}>
      <AttachmentPreview />
      <AttachmentInfo showMediaType />
      <AttachmentRemove label="Remove attachment" />
    </Attachment>
  ))}
</Attachments>
```

## Further reading
- Prompt Input component: https://elements.ai-sdk.dev/
- AI SDK docs: https://ai-sdk.dev/

## Related skills
- ../vercel-ai-sdk-elements — the parent AI Elements library
- ../ai-tool-ui-patterns — rendering tool results in chat
