---
name: react-native
description: React Native cross-platform mobile framework that builds native iOS and Android apps from React/JavaScript; consult when scaffolding, navigating, styling, debugging Metro/native modules, or shipping RN apps with Expo or the community CLI.
domain: stack
category: mobile
tags: [react-native, react, mobile, ios, android, expo, javascript]
official_sources:
  - https://reactnative.dev/docs/getting-started
  - https://github.com/facebook/react-native
  - https://reactnative.dev/docs/environment-setup
verified: 2026-06-17
---

# React Native

## Overview
React Native is an open-source framework from Meta for building native iOS and Android apps using React and JavaScript/TypeScript. UI is declared with React components that render to real native views (not a WebView). Read this when starting an RN project, wiring navigation, building native modules, or troubleshooting the Metro bundler and platform builds.

## Official sources
- Docs: https://reactnative.dev/docs/getting-started
- Repo: https://github.com/facebook/react-native
- Install: https://reactnative.dev/docs/environment-setup

## Install / setup
```bash
npx @react-native-community/cli@latest init AwesomeProject
```
From the official "without a framework" guide at https://reactnative.dev/docs/getting-started-without-a-framework. The docs recommend a framework (Expo) for new apps via `npx create-expo-app@latest`.

## Core concepts
- **Components & JSX** — UI built from `View`, `Text`, `Image`, `ScrollView`, etc., instead of HTML elements.
- **Metro bundler** — JS bundler that serves and hot-reloads your code; started with `npx react-native start`.
- **Native modules / New Architecture** — TurboModules and Fabric (the New Architecture, default in RN 0.76+) bridge JS to native APIs via JSI.
- **StyleSheet & Flexbox** — styling uses JS objects and Flexbox; no CSS cascade; values are unitless density-independent pixels.
- **Platform code** — `Platform.OS`, `.ios.js`/`.android.js` file extensions, and `Platform.select` for per-OS branches.
- **Hermes** — default JS engine optimized for RN startup and memory.
- **Frameworks (Expo)** — recommended toolbox providing routing, builds (EAS), and OTA updates on top of RN.

## Best practices
- Prefer a framework like Expo for new apps unless you have unusual native constraints (https://reactnative.dev/docs/getting-started).
- Use the New Architecture and keep RN/native deps aligned via the Upgrade Helper (https://reactnative.dev/docs/upgrading).
- Use `FlatList`/`SectionList` for long lists instead of mapping inside `ScrollView` (https://reactnative.dev/docs/optimizing-flatlist-configuration).
- Type your app with TypeScript; the default template ships TS (https://reactnative.dev/docs/typescript).

## Common pitfalls
- Stale Metro cache after dependency changes → restart with `npx react-native start --reset-cache`.
- Mixing incompatible native lib versions → use the Upgrade Helper and run `cd ios && pod install` after native changes.
- Assuming CSS units/cascade → RN styles are per-component JS objects with Flexbox defaults (`flexDirection: 'column'`).

## Examples
```tsx
import { View, Text, StyleSheet } from 'react-native';

export default function App() {
  return (
    <View style={styles.center}>
      <Text>Hello from React Native</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
```

## Further reading
- https://reactnative.dev/docs/components-and-apis — built-in core components and APIs
- https://reactnavigation.org/ — React Navigation, the standard routing library
- https://docs.expo.dev/ — Expo framework, EAS builds, and OTA updates

## Related skills
- ../ionic — another web-tech cross-platform mobile stack (Capacitor)
- ../flutter — alternative cross-platform native UI toolkit
- ../nativescript — native UI from JS without a WebView
