---
name: android
description: Native Android app development with Kotlin, Jetpack Compose, and Android Studio/Gradle; consult when building native Android apps, working with activities, the lifecycle, Jetpack libraries, Gradle builds, or publishing to Google Play.
domain: stack
category: mobile
tags: [android, kotlin, jetpack-compose, android-studio, gradle, mobile]
official_sources:
  - https://developer.android.com/develop
  - https://github.com/android
  - https://developer.android.com/studio
verified: 2026-06-17
---

# Android (native)

## Overview
Native Android development builds apps that run directly on the Android OS, written primarily in Kotlin (or Java) using the Android SDK, Jetpack libraries, and Jetpack Compose for UI, built with Gradle in Android Studio. Read this when creating a native Android app, working with activities and the lifecycle, adopting Compose, configuring Gradle, or preparing a release for Google Play.

## Official sources
- Docs: https://developer.android.com/develop
- Repo: https://github.com/android
- Install: https://developer.android.com/studio

## Install / setup
```bash
# Install Android Studio from developer.android.com/studio, then create a project:
# File > New > New Project > "Empty Activity" (Compose), or via Gradle wrapper:
./gradlew assembleDebug
```
Android Studio is the official IDE and SDK manager (https://developer.android.com/studio); new projects are created through its New Project wizard and built with the Gradle wrapper.

## Core concepts
- **Activity & lifecycle** — an `Activity` is an entry point/screen with `onCreate`/`onStart`/`onResume`/`onPause`/etc. callbacks.
- **Jetpack Compose** — modern declarative UI toolkit using `@Composable` functions and state; the recommended way to build UI.
- **Jetpack libraries** — AndroidX components: ViewModel, Lifecycle, Room, Navigation, WorkManager, DataStore.
- **Gradle build system** — `build.gradle(.kts)` defines dependencies, SDK levels, and product flavors.
- **Manifest** — `AndroidManifest.xml` declares components, permissions, and `minSdk`/`targetSdk`.
- **Intents** — messages to start activities/services or pass data between components.
- **Resources & R class** — strings, layouts, drawables in `res/`, referenced via generated `R`.

## Best practices
- Use Kotlin and Jetpack Compose for new UI (https://developer.android.com/courses/android-basics-compose/course).
- Follow recommended app architecture: UI layer + ViewModel + data layer with unidirectional data flow (https://developer.android.com/topic/architecture).
- Keep work off the main thread with coroutines/Flow (https://developer.android.com/kotlin/coroutines).
- Target the latest stable `targetSdk` and test on multiple API levels (https://developer.android.com/google/play/requirements/target-sdk).

## Common pitfalls
- Blocking the main thread with network/disk work → causes ANRs; use coroutines or WorkManager.
- Leaking `Context`/`Activity` across config changes → hold state in `ViewModel`, not the Activity.
- Hardcoding strings/dimensions → use `res/values` resources for localization and theming.

## Examples
```kotlin
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme { Greeting("Android") }
        }
    }
}

@Composable
fun Greeting(name: String) {
    Text(text = "Hello, $name!")
}
```

## Further reading
- https://developer.android.com/jetpack/compose — Jetpack Compose UI
- https://developer.android.com/topic/architecture — recommended app architecture
- https://kotlinlang.org/docs/android-overview.html — Kotlin for Android

## Related skills
- ../flutter — cross-platform toolkit that compiles to native Android
- ../react-native — cross-platform mobile framework targeting Android
- ../nativescript — native Android APIs from JavaScript
