---
name: mui
description: Material UI — comprehensive React component library implementing Google's Material Design with theming and Emotion styling; consult for prebuilt MUI components.
domain: stack
category: styling
tags: [mui, material-ui, react, components, emotion]
official_sources:
  - https://mui.com/material-ui/
  - https://github.com/mui/material-ui
verified: 2026-06-16
---

# Material UI (MUI)

## Overview
Material UI is a comprehensive React component library that implements Google's Material Design. It provides a large set of accessible, themeable components and ships with Emotion as the default styling engine. Read this when building a React UI on a complete, batteries-included component system with a centralized theme.

## Official sources
- Docs: https://mui.com/material-ui/
- Repo: https://github.com/mui/material-ui
- Install / download: https://mui.com/material-ui/getting-started/installation/

## Install / setup
```bash
npm install @mui/material @emotion/react @emotion/styled
```

## Core concepts
- **Component library**: a broad catalog of ready-made React components (buttons, inputs, layout, navigation, data display).
- **Theming**: a central theme object configures palette, typography, spacing, and breakpoints across all components.
- **`sx` prop**: apply one-off, theme-aware style overrides inline on any MUI component.
- **Default Emotion engine**: styles are powered by Emotion (`@emotion/react`/`@emotion/styled`) by default.
- **`styled()` utility**: create custom styled components that read from the MUI theme.

## Best practices
- Centralize design decisions in a theme and wrap the app in a theme provider so components stay consistent.
- Use the `sx` prop for small local overrides and `styled()` for reusable custom components.
- Reference theme tokens (palette, spacing) rather than hardcoding colors and pixel values.
- Pick the documented styling engine setup (Emotion by default) and stay consistent across the codebase.

## Common pitfalls
- Forgetting the Emotion peer packages → the default install requires `@emotion/react` and `@emotion/styled`; omitting them breaks styling.
- Overriding styles with high-specificity custom CSS instead of the theme/`sx` → fights the system and creates inconsistency; prefer theme tokens and `sx`.

## Examples
```jsx
import Button from '@mui/material/Button';

export default function App() {
  return <Button variant="contained">Hello world</Button>;
}
```

## Further reading
- https://mui.com/material-ui/getting-started/ — getting started and usage
- https://mui.com/material-ui/customization/theming/ — theming guide

## Related skills
- ../chakra-ui — alternative accessible React component library
- ../shadcn-ui — copy-in component approach on Tailwind + Radix
