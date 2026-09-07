---
name: objectivec
description: Objective-C is a superset of C that adds Smalltalk-style message passing and a dynamic runtime, historically the primary language for Apple macOS and iOS development with Cocoa/Cocoa Touch; consult when writing or maintaining Objective-C, using ARC, the runtime, categories, protocols, or bridging with Swift and C.
domain: language
category: language
tags: [objectivec, apple, cocoa, ios, macos, runtime, arc]
official_sources:
  - https://developer.apple.com/library/archive/documentation/Cocoa/Conceptual/ProgrammingWithObjectiveC/
  - https://developer.apple.com/documentation/objectivec
  - https://developer.apple.com/xcode/
verified: 2026-06-17
---

# Objective-C

## Overview
Objective-C is a strict superset of C that adds object-oriented programming through Smalltalk-style message passing and a dynamic runtime. It was the primary language for Apple's Cocoa (macOS) and Cocoa Touch (iOS) frameworks before Swift and remains common in legacy apps and frameworks. Read this when writing or maintaining Objective-C, using ARC memory management, the runtime, categories/protocols, or bridging with Swift and C.

## Official sources
- Docs: https://developer.apple.com/library/archive/documentation/Cocoa/Conceptual/ProgrammingWithObjectiveC/
- Repo: https://developer.apple.com/documentation/objectivec (runtime reference; the compiler is Apple Clang, https://github.com/llvm/llvm-project)
- Install: https://developer.apple.com/xcode/

## Install / setup
```bash
# Install Xcode's command-line tools (includes Apple Clang), then compile:
xcode-select --install
clang -fobjc-arc -framework Foundation hello.m -o hello
```
Xcode/tooling per https://developer.apple.com/xcode/ ; ARC and Foundation flags per https://developer.apple.com/documentation/objectivec.

## Core concepts
- **Message passing** — `[receiver message:arg]` sends messages; dispatch is resolved dynamically at runtime.
- **Classes & instances** — `@interface`/`@implementation` define classes; `id` is the dynamic object type.
- **ARC** — Automatic Reference Counting inserts retain/release; manage cycles with `weak`/`strong` references.
- **Protocols** — declare method contracts (`@protocol`) adopted by classes; similar to interfaces.
- **Categories & extensions** — add methods to existing classes (`@interface NSString (MyExtras)`) without subclassing.
- **Properties** — `@property` synthesizes accessors with attributes (`nonatomic`, `strong`, `copy`, `weak`).
- **The Objective-C runtime** — introspection, dynamic method resolution, and swizzling via `<objc/runtime.h>`.
- **Foundation/Cocoa** — `NSString`, `NSArray`, `NSDictionary`, and the broader framework stack.

## Best practices
- Use ARC (`-fobjc-arc`) and reason about ownership with `strong`/`weak`/`copy` property attributes (https://developer.apple.com/library/archive/documentation/Cocoa/Conceptual/ProgrammingWithObjectiveC/).
- Adopt `NS_ASSUME_NONNULL_BEGIN`/nullability annotations to improve Swift interop (https://developer.apple.com/documentation/objectivec).
- Prefer protocols and composition over deep class hierarchies (https://developer.apple.com/library/archive/documentation/Cocoa/Conceptual/ProgrammingWithObjectiveC/WorkingwithProtocols/WorkingwithProtocols.html).
- Use `copy` for mutable-backed properties like `NSString`/`NSArray` to avoid external mutation.

## Common pitfalls
- Retain cycles between objects (e.g., delegate/block captures `self`) → declare back-references `weak` and use `__weak`/`__strong` in blocks.
- Sending messages to `nil` returns zero/`nil` silently → check assumptions rather than relying on no-op dispatch.
- Mutating a collection while enumerating it → enumerate a copy or collect changes and apply afterward.

## Examples
```objc
#import <Foundation/Foundation.h>

@interface Greeter : NSObject
- (NSString *)greet:(NSString *)name;
@end

@implementation Greeter
- (NSString *)greet:(NSString *)name {
    return [NSString stringWithFormat:@"Hello, %@!", name];
}
@end

int main(void) {
    @autoreleasepool {
        Greeter *g = [Greeter new];
        NSLog(@"%@", [g greet:@"World"]);
    }
    return 0;
}
```

## Further reading
- https://developer.apple.com/library/archive/documentation/Cocoa/Conceptual/ProgrammingWithObjectiveC/ — Programming with Objective-C guide
- https://developer.apple.com/documentation/objectivec — Objective-C runtime reference
- https://developer.apple.com/documentation/swift/objective-c-and-c-code-customization — Swift/Objective-C interop

## Related skills
- ../c — Objective-C is a strict superset of C and compiles C directly
- ../lua — another language frequently embedded in iOS/macOS apps
