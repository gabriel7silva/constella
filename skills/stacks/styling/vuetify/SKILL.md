---
name: vuetify
description: Vuetify is a Vue component framework implementing Material Design with 80+ prebuilt components, a responsive grid, and a theming system; consult when scaffolding a Vue+Vuetify app, registering it with createVuetify, using v-* components like v-btn/v-data-table, configuring themes, or enabling tree-shaking via vite-plugin-vuetify.
domain: stack
category: styling
tags: [vuetify, vue, material-design, components, frontend, sass, typescript]
official_sources:
  - https://vuetifyjs.com/en/getting-started/installation/
  - https://github.com/vuetifyjs/vuetify
  - https://www.npmjs.com/package/create-vuetify
verified: 2026-06-17
---

# Vuetify

## Overview
Vuetify is an open-source Vue 3 component framework that implements Google's Material Design spec. It provides 80+ ready-made `v-*` components, a 12-column responsive grid, a configurable theme/color system, and SASS variables for customization. Read this when scaffolding a new Vue + Vuetify project, registering the plugin with `createVuetify`, composing UIs from Vuetify components, theming, or setting up auto-import/tree-shaking with the Vite plugin.

## Official sources
- Docs: https://vuetifyjs.com/en/getting-started/installation/
- Repo: https://github.com/vuetifyjs/vuetify
- Install: https://www.npmjs.com/package/create-vuetify

## Install / setup
```bash
npm create vuetify@latest
```
Scaffolding command from the official installation guide (https://vuetifyjs.com/en/getting-started/installation/). To add to an existing app: `npm i vuetify`.

## Core concepts
- **createVuetify plugin** — instantiate with `createVuetify({ components, directives })` and register via `app.use(vuetify)`.
- **Components** — 80+ `v-*` components (`v-btn`, `v-card`, `v-text-field`, `v-data-table`, `v-app-bar`) following Material Design.
- **v-app / layout** — `<v-app>` is the required root; layout components (`v-app-bar`, `v-navigation-drawer`, `v-main`) compose the shell.
- **Grid system** — `v-container` > `v-row` > `v-col` with breakpoint props (`cols`, `sm`, `md`, `lg`, `xl`).
- **Theming** — light/dark themes and named color palettes configured in `createVuetify({ theme: {...} })`.
- **Display/breakpoints** — `useDisplay()` composable and responsive props react to xs–xxl breakpoints.
- **Directives** — opt-in directives (`v-ripple`, `v-intersect`) registered alongside components.
- **Tree-shaking** — `vite-plugin-vuetify` auto-imports only used components and SASS for smaller bundles.

## Best practices
- Use `npm create vuetify@latest` to scaffold; it wires Vite, the plugin, and tree-shaking for you (https://vuetifyjs.com/en/getting-started/installation/).
- Enable automatic component import + on-demand styles with `vite-plugin-vuetify` rather than importing everything (https://vuetifyjs.com/en/features/treeshaking/).
- Define themes and brand colors centrally in `createVuetify({ theme })`, not per-component overrides (https://vuetifyjs.com/en/features/theme/).
- Wrap the app in a single `<v-app>` and use `v-main` for routed content so layout components position correctly (https://vuetifyjs.com/en/features/application-layout/).

## Common pitfalls
- Components render unstyled / overlays mis-position → app not wrapped in `<v-app>`, or `vuetify/styles` not imported.
- Bundle is huge → globally registering all components; switch to `vite-plugin-vuetify` auto-import.
- Theme colors not applying → set them in `createVuetify({ theme })` config, not ad-hoc CSS, and reference via `color="primary"`.

## Examples
```js
// main.js
import { createApp } from 'vue'
import App from './App.vue'
import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

const vuetify = createVuetify({
  components,
  directives,
  theme: { defaultTheme: 'dark' },
})

createApp(App).use(vuetify).mount('#app')
```
```vue
<!-- App.vue -->
<template>
  <v-app>
    <v-main>
      <v-container>
        <v-btn color="primary">Click me</v-btn>
      </v-container>
    </v-main>
  </v-app>
</template>
```

## Further reading
- https://vuetifyjs.com/en/components/all/ — full component API reference
- https://vuetifyjs.com/en/features/theme/ — theme and color configuration
- https://vuetifyjs.com/en/features/treeshaking/ — auto-import and bundle optimization

## Related skills
- ../bootstrap — non-Vue component framework alternative
- ../tailwind — utility-first CSS often paired with Vue
