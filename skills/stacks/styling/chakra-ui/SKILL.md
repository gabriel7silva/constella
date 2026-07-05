---
name: chakra-ui
description: Accessible React component system for building products fast, with theming and a CLI that adds component snippets; consult when styling React with Chakra.
domain: stack
category: styling
tags: [chakra-ui, react, components, accessible, theming]
official_sources:
  - https://chakra-ui.com/docs
  - https://github.com/chakra-ui/chakra-ui
verified: 2026-06-16
---

# Chakra UI

## Overview
Chakra UI is a component system for building React products with speed, providing accessible, composable components and a theming system. Its CLI adds pre-built component snippets into your project, and apps are wrapped in a `Provider` for theme and styling context. Read this when building an accessible React UI with a consistent design system.

## Official sources
- Docs: https://chakra-ui.com/docs
- Repo: https://github.com/chakra-ui/chakra-ui
- Install / download: https://chakra-ui.com/docs/get-started/installation

## Install / setup
```bash
npm i @chakra-ui/react @emotion/react
```
Then add snippets with `npx @chakra-ui/cli snippet add` and wrap your app in the `Provider` component, per the installation guide.

## Core concepts
- **Accessible component system**: composable React components designed for building SaaS products quickly with accessibility built in.
- **Provider setup**: the app is wrapped in a `Provider` to supply theme and styling context.
- **CLI snippets**: `@chakra-ui/cli snippet add` generates ready-to-use component code into your project.
- **Theming / design tokens**: a configurable system for colors, typography, spacing, and other tokens.
- **Style props**: pass style-related props directly to components for quick, consistent styling.

## Best practices
- Wrap the app in the `Provider` so all components receive theme and styling context.
- Use the CLI to add snippets rather than hand-writing boilerplate component scaffolding.
- Drive styling from the theme/design tokens for consistency instead of ad-hoc inline values.
- Compose primitives and style props to build UI quickly while keeping accessibility intact.

## Common pitfalls
- Rendering components without the `Provider` → they lack theme/context and won't style or behave correctly; set up the provider first.
- Missing the `@emotion/react` peer dependency → the documented install pairs it with `@chakra-ui/react`; omitting it breaks the styling runtime.

## Examples
```jsx
import { Button } from "@chakra-ui/react";

export default function App() {
  return <Button colorPalette="teal">Click me</Button>;
}
```

## Further reading
- https://chakra-ui.com/docs/get-started/installation — framework setup
- https://chakra-ui.com/docs — components and theming reference

## Related skills
- ../mui — alternative React component library
- ../styled-components — the Emotion-style CSS-in-JS layer underneath
