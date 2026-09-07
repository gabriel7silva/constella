---
name: flutter
description: Flutter is Google's UI toolkit for building natively compiled iOS, Android, web, and desktop apps from a single Dart codebase; consult when scaffolding with flutter create, building widget trees, managing state, or debugging hot reload, pub packages, and platform builds.
domain: stack
category: mobile
tags: [flutter, dart, mobile, ios, android, cross-platform, widgets]
official_sources:
  - https://docs.flutter.dev/
  - https://github.com/flutter/flutter
  - https://docs.flutter.dev/install
verified: 2026-06-17
---

# Flutter

## Overview
Flutter is an open-source UI framework from Google for building natively compiled applications for mobile, web, and desktop from a single Dart codebase. It renders its own widgets via the Impeller/Skia engine rather than wrapping native controls, giving consistent UI across platforms. Read this when creating a Flutter app, composing widget trees, choosing a state-management approach, or debugging hot reload and `pub` dependencies.

## Official sources
- Docs: https://docs.flutter.dev/
- Repo: https://github.com/flutter/flutter
- Install: https://docs.flutter.dev/install

## Install / setup
```bash
flutter create my_app
cd my_app
flutter run
```
From the official "Create a new Flutter app" reference at https://docs.flutter.dev/reference/create-new-app (install the SDK first per https://docs.flutter.dev/install).

## Core concepts
- **Everything is a widget** — UI is a tree of immutable widgets (layout, styling, and structure are all widgets).
- **Stateless vs Stateful** — `StatelessWidget` for static UI; `StatefulWidget` + `State` for mutable, re-rendering UI.
- **Hot reload** — inject changed source into the running Dart VM without losing app state.
- **BuildContext & build()** — `build()` describes UI from current config/state; `setState()` triggers rebuilds.
- **pubspec.yaml** — declares dependencies and assets; resolved with `flutter pub get`.
- **Material & Cupertino** — first-party widget libraries for Android-style and iOS-style design.
- **Dart** — typed, AOT-compiled language; sound null safety is standard.

## Best practices
- Prefer composition over deep inheritance; build small, reusable widgets (https://docs.flutter.dev/perf/best-practices).
- Use `const` constructors to let Flutter skip rebuilds of unchanged subtrees (https://docs.flutter.dev/perf/best-practices).
- Pick a state-management approach deliberately (Provider/Riverpod/Bloc) (https://docs.flutter.dev/data-and-backend/state-mgmt/options).
- Run `flutter analyze` and `flutter test` in CI; follow Effective Dart (https://dart.dev/effective-dart).

## Common pitfalls
- Doing expensive work in `build()` → it can run every frame; cache results or hoist out of `build`.
- Calling `setState()` after dispose or off the widget's `State` → guard with `mounted` checks.
- Forgetting `flutter pub get` after editing `pubspec.yaml` → run it (IDEs often do this automatically).

## Examples
```dart
import 'package:flutter/material.dart';

void main() => runApp(const MyApp());

class MyApp extends StatelessWidget {
  const MyApp({super.key});
  @override
  Widget build(BuildContext context) => const MaterialApp(
        home: Scaffold(
          body: Center(child: Text('Hello from Flutter')),
        ),
      );
}
```

## Further reading
- https://docs.flutter.dev/ui/widgets — widget catalog
- https://dart.dev/guides — the Dart language
- https://pub.dev/ — package registry for Flutter and Dart

## Related skills
- ../react-native — alternative cross-platform mobile framework (JS/React)
- ../android — underlying native Android platform Flutter targets
- ../ionic — web-tech cross-platform mobile alternative
