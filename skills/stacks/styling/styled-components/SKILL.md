---
name: styled-components
description: CSS-in-JS for React using tagged template literals to attach scoped styles to components; consult when styling React with co-located CSS.
domain: stack
category: styling
tags: [styled-components, css-in-js, react, theming, ssr]
official_sources:
  - https://styled-components.com/docs
  - https://github.com/styled-components/styled-components
verified: 2026-06-16
---

# styled-components

## Overview
styled-components is a CSS-in-JS library for React that lets you write actual CSS in tagged template literals, producing React components with their styles attached. It removes the mapping between components and styles and scopes CSS automatically. Read this when styling React (including Server Components, client components, and SSR) with co-located styles.

## Official sources
- Docs: https://styled-components.com/docs
- Repo: https://github.com/styled-components/styled-components
- Install / download: https://styled-components.com/docs/basics#installation

## Install / setup
```bash
npm install styled-components
```

## Core concepts
- **Tagged template literals**: `styled.button\`...\`` creates a React component whose CSS lives in the template string, automatically generating unique class names.
- **Adapting based on props**: interpolated functions receive the component's props (e.g. `$primary`) so styles can change dynamically per render.
- **Extending styles**: `styled(Existing)\`...\`` builds a new component that inherits another's styles and overrides specific declarations.
- **`.attrs`**: attach static or computed props/attributes to a styled component before it renders.
- **`keyframes`**: generates scoped animation names to avoid collisions; pair with the `css` helper for code-splitting compatibility.

## Best practices
- Prefix transient props (`$primary`) so they drive styling without being forwarded to the DOM.
- Reuse styles by extending existing styled components rather than duplicating declarations.
- Define `keyframes` once and reference it, keeping animations scoped and collision-free.
- Provide theme values through a theme provider so colors and spacing stay consistent across components.

## Common pitfalls
- Defining `styled(...)` components inside a render function → a new component identity each render hurts performance and can break state; define them at module scope.
- Forwarding non-standard props to DOM elements → use transient `$` props or `.attrs` so invalid attributes don't leak into the HTML.

## Examples
```jsx
import styled from 'styled-components';

const Button = styled.button`
  background: ${props => props.$primary ? 'palevioletred' : 'white'};
  color: ${props => props.$primary ? 'white' : 'palevioletred'};
  padding: 0.5em 1em;
`;
```

## Further reading
- https://styled-components.com/docs/basics — core usage guide
- https://styled-components.com/docs/advanced — theming, SSR, and refs

## Related skills
- ../vanilla-extract — zero-runtime alternative authored in TypeScript
- ../tailwind — utility-first alternative to CSS-in-JS
