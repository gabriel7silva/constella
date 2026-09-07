---
name: java
description: JVM object-oriented, statically typed language; consult for OOP, the JDK toolchain, and runtime/build basics.
domain: language
category: language
tags: [java, jvm, openjdk, oop, temurin]
official_sources:
  - https://docs.oracle.com/en/java/
  - https://github.com/openjdk/jdk
  - https://adoptium.net/installation/
verified: 2026-06-16
---

# Java

## Overview
Java is a statically typed, object-oriented, class-based language that compiles to bytecode and runs on the Java Virtual Machine (JVM), giving it "write once, run anywhere" portability. OpenJDK is the open-source reference implementation; Eclipse Temurin (from Adoptium) is a widely used prebuilt OpenJDK distribution. Read this for OOP fundamentals, the JDK toolchain, and runtime/build basics.

## Official sources
- Docs: https://docs.oracle.com/en/java/
- Repo (OpenJDK): https://github.com/openjdk/jdk
- Install (Eclipse Temurin / Adoptium): https://adoptium.net/installation/

## Install / setup
Install Eclipse Temurin (OpenJDK). On Windows via winget, per https://adoptium.net/installation/:
```bash
winget install EclipseAdoptium.Temurin.25.JDK
```
On other platforms use the package managers, installers, or archives listed on the Adoptium installation page.

## Core concepts
- Classes and objects: code is organized into classes; objects are instances. Single inheritance of classes, multiple inheritance of interfaces.
- Static typing and the type system: types are checked at compile time; generics provide type-safe collections and APIs.
- The JVM and bytecode: `javac` compiles `.java` to `.class` bytecode that the JVM executes, with JIT compilation and garbage collection.
- Interfaces and abstraction: interfaces define contracts; abstract classes provide partial implementation.
- Checked vs. unchecked exceptions: checked exceptions must be declared or handled; unchecked (RuntimeException) need not be.
- Packages and the module system: packages namespace classes; the JPMS module system (`module-info.java`) adds explicit dependencies.
- Build tools and the classpath: Maven/Gradle manage dependencies and builds; the classpath/modulepath locates classes at runtime.

## Best practices
- Program to interfaces, not implementations, so code depends on contracts rather than concrete classes.
- Prefer immutability for value types and use `final` where appropriate to make intent and thread-safety clearer.
- Use a build tool (Maven or Gradle) and declared dependencies instead of manually managing JARs on the classpath.
- Close resources deterministically with try-with-resources for anything implementing `AutoCloseable`.

## Common pitfalls
- Calling methods on a `null` reference → guard with checks or use `Optional` to express absence at API boundaries.
- Comparing objects with `==` instead of `.equals()` → `==` compares references; override/use `equals`/`hashCode` consistently.
- Forgetting to close streams/connections → leaks resources; use try-with-resources.
- Mutable shared state across threads without synchronization → causes races; use immutability, `synchronized`, or `java.util.concurrent`.

## Examples
```java
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

public class ReadLines {
    public static void main(String[] args) throws Exception {
        List<String> lines = Files.readAllLines(Path.of("data.txt"));
        lines.forEach(System.out::println);
    }
}
```

## Further reading
- Java SE documentation (Oracle): https://docs.oracle.com/en/java/javase/
- OpenJDK project: https://openjdk.org/

## Related skills
- ../kotlin — modern JVM language interoperable with Java
