---
name: jvm
description: The Java Virtual Machine — the runtime executing Java/Kotlin/Scala bytecode. Consult for JDK selection, deployment, and JVM tuning. OpenJDK builds via Temurin.
domain: stack
category: runtime
tags: [jvm, java, openjdk, temurin, bytecode, runtime]
official_sources:
  - https://docs.oracle.com/en/java/javase/
  - https://github.com/openjdk/jdk
verified: 2026-06-16
---

# JVM (Java Virtual Machine)

## Overview
The Java Virtual Machine executes platform-independent bytecode produced from Java, Kotlin, Scala, Clojure, and other JVM languages. OpenJDK is the open-source reference implementation; Eclipse Temurin (Adoptium) provides free, TCK-certified prebuilt OpenJDK binaries. Read this when selecting a JDK, packaging a JVM service, or reasoning about runtime/GC behavior.

## Official sources
- Docs: https://docs.oracle.com/en/java/javase/
- Repo: https://github.com/openjdk/jdk
- Install / download: https://adoptium.net/

## Install / setup
Download a prebuilt, TCK-certified OpenJDK (Eclipse Temurin) for your platform from https://adoptium.net/ ("Download Temurin"). Verify the install:

```bash
java -version
javac -version
```

## Core concepts
- Bytecode + JIT: source compiles to `.class` bytecode; the JVM interprets then JIT-compiles hot paths to native code.
- The JVM is a spec; OpenJDK is the reference implementation and Temurin is a certified distribution of it.
- Automatic memory management with a garbage collector (G1 by default on recent JDKs; alternatives like ZGC exist).
- LTS release lines (e.g. JDK 8, 11, 17, 21) get extended support; non-LTS releases are shorter-lived.
- The classpath/module path locate compiled classes and dependencies; the Java Platform Module System organizes modules.
- "Write once, run anywhere": the same bytecode runs on any conformant JVM/OS.

## Best practices
- Target an LTS release (e.g. 17 or 21) for production; check active versions at https://docs.oracle.com/en/java/javase/.
- Use a certified distribution (Temurin) for production to ensure TCK compliance.
- Size the heap explicitly (`-Xms`/`-Xmx`) for predictable memory behavior in containers.
- Select a GC appropriate to latency vs throughput needs rather than relying solely on defaults.

## Common pitfalls
- Running an unsupported/EOL JDK → upgrade to a supported LTS line.
- Leaving heap unbounded in containers → set `-Xmx` (or container-aware flags) to avoid OOM kills.
- Confusing the JRE-only runtime with the full JDK when you need `javac`/tooling → install the JDK.

## Examples
```java
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello from the JVM");
    }
}
// javac Main.java && java Main
```

## Further reading
- Java SE documentation: https://docs.oracle.com/en/java/javase/
- OpenJDK project: https://openjdk.org/

## Related skills
- ../dotnet — comparable managed runtime on the .NET platform
- ../beam — alternative VM (Erlang/Elixir) for concurrent systems
