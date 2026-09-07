---
name: vue
description: Progressive, incrementally adoptable JavaScript framework for building web UIs; consult for SFCs, reactivity, and composition API.
domain: stack
category: frontend
tags: [vue, reactivity, sfc, composition-api, ui, spa]
official_sources:
  - https://vuejs.org/guide/
  - https://github.com/vuejs/core
verified: 2026-06-16
---

# Vue

## Overview
Vue is a progressive JavaScript framework for building user interfaces, designed to be incrementally adoptable from a sprinkle of interactivity to full single-page apps. It centers on declarative, reactive rendering and Single-File Components (`.vue`) that co-locate template, script, and styles. Read this when building Vue components, using the Composition API, or scaffolding a Vue project.

## Official sources
- Docs: https://vuejs.org/guide/
- Repo: https://github.com/vuejs/core
- Install / download: https://vuejs.org/guide/quick-start.html

## Install / setup
Scaffold a new project with the official `create-vue` tool (copied verbatim from vuejs.org/guide/quick-start.html):

```bash
npm create vue@latest
```

## Core concepts
- **Reactivity** — `ref()` and `reactive()` create reactive state; the DOM updates automatically when it changes.
- **Single-File Components (SFC)** — `.vue` files bundle `<template>`, `<script setup>`, and `<style>` together.
- **Composition API** — `<script setup>` with `ref`, `computed`, `watch`, and lifecycle hooks for organizing logic by concern.
- **Options API** — alternative object-based component style (`data`, `methods`, `computed`).
- **Template directives** — `v-if`, `v-for`, `v-bind` (`:`), `v-on` (`@`), `v-model` for two-way binding.
- **Computed & watchers** — `computed()` for derived cached values; `watch`/`watchEffect` for side effects.
- **Components & props/emits** — pass data down via props, communicate up via emitted events.

## Best practices
- Prefer the Composition API with `<script setup>` for new projects (recommended in the docs for SFCs).
- Use `computed` for derived state instead of recomputing in templates or watchers.
- Always provide a unique `:key` when using `v-for`.
- Use Pinia (the official state store) for cross-component shared state.
- Pin the Vue version and use the official Vue DevTools for debugging.

## Common pitfalls
- Destructuring a `reactive()` object loses reactivity → keep the object intact or use `toRefs`.
- Mutating props inside a child → emit an event or use `v-model` so the parent owns the state.
- Using `v-if` and `v-for` on the same element → split them; `v-if` has higher precedence and the behavior is discouraged.

## Examples
```vue
<script setup>
import { ref } from 'vue';
const count = ref(0);
</script>

<template>
  <button @click="count++">Clicked {{ count }} times</button>
</template>
```

## Further reading
- https://vuejs.org/guide/introduction.html — full introduction and concepts
- https://vuejs.org/guide/quick-start.html — quick start and tooling

## Related skills
- ../react — alternative component UI library
- ../svelte — compiler-first reactive framework
