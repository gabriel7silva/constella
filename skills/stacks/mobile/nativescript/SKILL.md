---
name: nativescript
description: NativeScript is an open-source framework for building truly native iOS and Android apps from JavaScript/TypeScript with direct access to native APIs (no WebView), usable plain or with Angular, Vue, React, Svelte, or SolidJS; consult when scaffolding with ns create or calling native platform APIs.
domain: stack
category: mobile
tags: [nativescript, typescript, javascript, mobile, ios, android, native]
official_sources:
  - https://docs.nativescript.org/
  - https://github.com/NativeScript/NativeScript
  - https://docs.nativescript.org/setup/
verified: 2026-06-17
---

# NativeScript

## Overview
NativeScript is an open-source framework for building truly native iOS and Android apps using JavaScript or TypeScript, rendering native UI components (not a WebView) and giving direct, synchronous access to native platform APIs. It works standalone or with Angular, Vue, React, Svelte, or SolidJS flavors. Read this when scaffolding a NativeScript app, calling iOS/Android APIs directly from JS, or wiring native UI.

## Official sources
- Docs: https://docs.nativescript.org/
- Repo: https://github.com/NativeScript/NativeScript
- Install: https://docs.nativescript.org/setup/

## Install / setup
```bash
npm install -g nativescript
ns create myCoolApp --template @nativescript/template-blank
cd myCoolApp
ns run android   # or: ns run ios
```
Install command from https://docs.nativescript.org/setup/windows; `ns create` template usage from https://docs.nativescript.org/guide/creating-a-project.

## Core concepts
- **Direct native API access** — call iOS (Objective-C/Swift) and Android (Java/Kotlin) APIs straight from JS via generated bindings.
- **Native UI elements** — XML/markup maps to real native views (`<Label>`, `<Button>`, `<ListView>`), no DOM/WebView.
- **Flavors** — author in plain JS/TS or with Angular, Vue, React, Svelte, or SolidJS bindings.
- **ns CLI** — `create`, `run`, `build`, `debug`, `preview`, and `plugin` subcommands.
- **Plugins** — npm packages wrapping native SDKs; installed with `ns plugin add`.
- **Webpack & HMR** — bundled with webpack; hot module replacement during `ns run`.

## Best practices
- Pick a flavor that matches your team and scaffold with the right template (`--ng`, `--vue`, `--react`, etc.) (https://docs.nativescript.org/guide/creating-a-project).
- Verify your toolchain with `ns doctor` before building (https://docs.nativescript.org/setup/).
- Prefer maintained `@nativescript/*` plugins for native features (https://docs.nativescript.org/guide/development-workflow/using-packages).
- Use TypeScript for type-safe access to native API typings; generate them with `ns typings ios`/`ns typings android` (https://docs.nativescript.org/guide/native-code/generate-typings).

## Common pitfalls
- Missing native SDKs/emulators → run `ns doctor` and follow the per-OS setup guide.
- Treating it like web → there is no DOM or CSS cascade; layout uses NativeScript layout containers and a CSS subset.
- Stale build artifacts after native changes → `ns clean`, then rebuild.

## Examples
```xml
<!-- main-page.xml -->
<Page xmlns="http://schemas.nativescript.org/tns.xsd">
  <StackLayout>
    <Label text="Hello from NativeScript" />
    <Button text="Tap" tap="{{ onTap }}" />
  </StackLayout>
</Page>
```

## Further reading
- https://docs.nativescript.org/guide/marshalling/ — marshalling and calling native APIs
- https://market.nativescript.org/ — plugins marketplace
- https://docs.nativescript.org/setup/ — environment setup and `ns doctor`

## Related skills
- ../react-native — also renders native UI from JavaScript
- ../ionic — web-tech cross-platform mobile alternative (Capacitor)
- ../android — native Android APIs surfaced by NativeScript
