---
name: xamarin
description: .NET MAUI is Microsoft's cross-platform framework (Xamarin's successor) for building native Android, iOS, macOS, and Windows apps from one C# and XAML codebase; consult when scaffolding with dotnet new maui, writing XAML/MVVM UI, or migrating from Xamarin.Forms.
domain: stack
category: mobile
tags: [maui, xamarin, dotnet, csharp, xaml, mobile, cross-platform]
official_sources:
  - https://learn.microsoft.com/en-us/dotnet/maui/
  - https://github.com/dotnet/maui
  - https://dotnet.microsoft.com/en-us/apps/maui
verified: 2026-06-17
---

# Xamarin / .NET MAUI

## Overview
.NET MAUI (Multi-platform App UI) is Microsoft's open-source framework for building native apps for Android, iOS, macOS, and Windows from a single C#/XAML codebase. It is the evolution and successor of Xamarin.Forms (Xamarin support ended May 1, 2024). Read this when starting a MAUI app, building XAML UI with MVVM/data binding, sharing code across platforms, or migrating a Xamarin.Forms project.

## Official sources
- Docs: https://learn.microsoft.com/en-us/dotnet/maui/
- Repo: https://github.com/dotnet/maui
- Install: https://dotnet.microsoft.com/en-us/apps/maui

## Install / setup
```bash
dotnet workload install maui
dotnet new maui -n MyMauiApp
cd MyMauiApp
dotnet build -t:Run -f net9.0-android
```
CLI creation from https://learn.microsoft.com/en-us/dotnet/maui/get-started/first-app (install the `.NET MAUI` workload / Visual Studio MAUI workload per https://learn.microsoft.com/en-us/dotnet/maui/get-started/installation).

## Core concepts
- **Single project, multi-target** — one project targets `net*-android`, `net*-ios`, `net*-maccatalyst`, `net*-windows`.
- **XAML + code-behind** — declarative UI in XAML paired with C# code-behind/handlers.
- **MVVM & data binding** — `BindingContext`, `INotifyPropertyChanged`, and commands separate UI from logic.
- **Handlers** — lightweight mapping from cross-platform controls to native views (replacing Xamarin renderers).
- **Layouts & controls** — `Grid`, `StackLayout`, `CollectionView`, `Shell` for app structure and navigation.
- **Dependency injection** — built-in DI registered in `MauiProgram.CreateMauiApp()`.
- **Platform code** — conditional `#if ANDROID`/`IOS` and `Platforms/` folders for native specifics.

## Best practices
- Use MVVM with the .NET MAUI Community Toolkit's source generators for clean view models (https://learn.microsoft.com/en-us/dotnet/communitytoolkit/maui/).
- Prefer `CollectionView`/`Shell` over legacy `ListView`/manual navigation (https://learn.microsoft.com/en-us/dotnet/maui/user-interface/controls/collectionview/).
- Register services and pages via DI in `MauiProgram` (https://learn.microsoft.com/en-us/dotnet/maui/fundamentals/dependency-injection).
- Migrate Xamarin.Forms apps with the official upgrade guidance (https://learn.microsoft.com/en-us/dotnet/maui/migration/).

## Common pitfalls
- Blocking the UI thread → use `async`/`await` and `MainThread.BeginInvokeOnMainThread` for UI updates.
- Forgetting the MAUI workload → builds fail; run `dotnet workload install maui`.
- Assuming Xamarin custom renderers carry over → port them to MAUI handlers.

## Examples
```xml
<!-- MainPage.xaml -->
<ContentPage xmlns="http://schemas.microsoft.com/dotnet/2021/maui"
             xmlns:x="http://schemas.microsoft.com/winfx/2009/xaml">
  <VerticalStackLayout Padding="20" Spacing="10">
    <Label Text="Hello, .NET MAUI!" FontSize="24" />
    <Button Text="Click" Clicked="OnClicked" />
  </VerticalStackLayout>
</ContentPage>
```

## Further reading
- https://learn.microsoft.com/en-us/dotnet/maui/fundamentals/data-binding/ — fundamentals: data binding (see also app-lifecycle, shell)
- https://learn.microsoft.com/en-us/dotnet/maui/migration/ — migrating from Xamarin.Forms
- https://learn.microsoft.com/en-us/dotnet/communitytoolkit/maui/ — .NET MAUI Community Toolkit

## Related skills
- ../flutter — alternative single-codebase native cross-platform UI
- ../react-native — JS/React cross-platform mobile framework
- ../android — native Android target underneath MAUI
