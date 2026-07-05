---
name: ionic
description: Ionic is an open-source UI toolkit for building cross-platform mobile, desktop, and web apps from one web codebase (Angular, React, or Vue) running natively via Capacitor; consult when scaffolding with ionic start, using Ionic UI components, or wiring native device features.
domain: stack
category: mobile
tags: [ionic, capacitor, angular, react, vue, mobile, web]
official_sources:
  - https://ionicframework.com/docs
  - https://github.com/ionic-team/ionic-framework
  - https://ionicframework.com/docs/intro/cli
verified: 2026-06-17
---

# Ionic

## Overview
Ionic is an open-source UI toolkit for building cross-platform apps for mobile, desktop, and web from a single web-technology codebase, integrating with Angular, React, or Vue. UI is composed of framework-agnostic web components; native packaging and device APIs come from Capacitor. Read this when scaffolding an Ionic app, using its component library, theming, or bridging to native features.

## Official sources
- Docs: https://ionicframework.com/docs
- Repo: https://github.com/ionic-team/ionic-framework
- Install: https://ionicframework.com/docs/intro/cli

## Install / setup
```bash
npm install -g @ionic/cli
ionic start myApp tabs --type=angular --capacitor
cd myApp
ionic serve
```
Install command from https://ionicframework.com/docs/intro/cli; `ionic start` usage from https://ionicframework.com/docs/cli/commands/start (swap `--type=react` or `--type=vue` as needed).

## Core concepts
- **Web components** — `<ion-button>`, `<ion-list>`, etc., are framework-agnostic components usable from Angular/React/Vue.
- **Capacitor** — the native runtime that packages the web app as iOS/Android and exposes device plugins (Camera, Filesystem, etc.).
- **Adaptive (mode) styling** — components adapt to `ios` or `md` (Material) mode for platform-appropriate look and feel.
- **Routing & navigation** — uses the host framework's router (Angular Router, React Router, Vue Router) plus `ion-router-outlet`.
- **CSS variables / theming** — customize via CSS custom properties and the global theme.
- **ionic CLI** — `start`, `serve`, `build`, `generate`, and `capacitor` subcommands.

## Best practices
- Use Capacitor (default for new apps) over legacy Cordova for native builds (https://ionicframework.com/docs/developing/starting).
- Choose the framework integration matching your team (Angular/React/Vue) at `ionic start` time (https://ionicframework.com/docs/cli/commands/start).
- Theme with CSS variables rather than overriding component internals (https://ionicframework.com/docs/theming/basics).
- Lazy-load routes/pages to keep startup fast on devices (https://ionicframework.com/docs/angular/navigation).

## Common pitfalls
- Forgetting `npx cap sync` after installing native plugins → native projects miss the changes.
- Heavy DOM/animation work on low-end devices → it's still a WebView; profile and virtualize long lists with your framework's virtual-scroll solution (Angular CDK, react-window, vue-virtual-scroller).
- Mixing Cordova and Capacitor plugin assumptions → prefer Capacitor-native plugins.

## Examples
```html
<ion-header>
  <ion-toolbar>
    <ion-title>Home</ion-title>
  </ion-toolbar>
</ion-header>
<ion-content class="ion-padding">
  <ion-button expand="block">Tap me</ion-button>
</ion-content>
```

## Further reading
- https://ionicframework.com/docs/components — UI component reference
- https://capacitorjs.com/docs — Capacitor native runtime and plugins
- https://ionicframework.com/docs/theming/basics — theming with CSS variables

## Related skills
- ../react-native — alternative cross-platform mobile framework
- ../nativescript — JS-to-native UI without a WebView
- ../flutter — native-rendered cross-platform UI toolkit
