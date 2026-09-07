---
name: spring-boot
description: Convention-over-configuration JVM framework for production-grade Spring apps with auto-configuration and embedded servers; consult for Java/Kotlin backends.
domain: stack
category: backend
tags: [spring-boot, java, kotlin, jvm, dependency-injection, backend]
official_sources:
  - https://docs.spring.io/spring-boot/
  - https://github.com/spring-projects/spring-boot
verified: 2026-06-16
---

# Spring Boot

## Overview
Spring Boot helps you create Spring-powered, production-grade applications and services with absolute minimum fuss — no code generation and no XML configuration required. It layers opinionated auto-configuration, starter dependencies, and embedded servers on top of the Spring Framework so apps run standalone. Read this when building JVM (Java/Kotlin) web services or APIs and you want convention over configuration.

## Official sources
- Docs: https://docs.spring.io/spring-boot/
- Repo: https://github.com/spring-projects/spring-boot
- Quickstart: https://spring.io/quickstart

## Install / setup
The official quickstart scaffolds a project at https://start.spring.io (choose the "web" dependency), then builds and runs it with the bundled Gradle wrapper:
```bash
./gradlew bootRun
```
On Windows the docs show `.\gradlew.bat bootRun`. (Source: https://spring.io/quickstart)

## Core concepts
- **Auto-configuration** — Spring Boot configures beans automatically based on the classpath and properties, overridable when needed.
- **Starters** — curated dependency descriptors (e.g. `spring-boot-starter-web`) pull in a coherent set of libraries.
- **Inversion of Control / DI** — the Spring container manages beans and injects dependencies (`@Component`, `@Autowired`, constructor injection).
- **Embedded server** — apps package an embedded Tomcat/Jetty/Netty and run as a standalone executable jar.
- **Externalized configuration** — `application.properties` / `application.yml`, environment variables, and profiles configure the app.
- **Actuator** — production-ready endpoints for health, metrics, and monitoring.

## Best practices
- Use starter dependencies and Spring Initializr (start.spring.io) to get a coherent, version-aligned setup (https://spring.io/quickstart).
- Prefer constructor injection for required dependencies; it makes beans immutable and easier to test (https://docs.spring.io/spring-framework/reference/core/beans/dependencies/factory-collaborators.html).
- Externalize configuration and use profiles for environment-specific settings rather than hardcoding (https://docs.spring.io/spring-boot/reference/features/external-config.html).
- Add Actuator and expose only the endpoints you need for health/metrics in production (https://docs.spring.io/spring-boot/reference/actuator/index.html).

## Common pitfalls
- Placing components outside the main application class's package → component scanning misses them; keep `@SpringBootApplication` at a root package above your components (https://docs.spring.io/spring-boot/reference/using/structuring-your-code.html).
- Exposing all Actuator endpoints publicly → leaks sensitive operational data; restrict and secure exposed endpoints (https://docs.spring.io/spring-boot/reference/actuator/endpoints.html).

## Examples
```java
@SpringBootApplication
@RestController
public class DemoApplication {

  @GetMapping("/")
  public String home() {
    return "Hello World!";
  }

  public static void main(String[] args) {
    SpringApplication.run(DemoApplication.class, args);
  }
}
```

## Further reading
- https://docs.spring.io/spring-boot/tutorial/first-application/index.html — first application tutorial
- https://docs.spring.io/spring-boot/reference/features/external-config.html — configuration reference

## Related skills
- ../nestjs — comparable DI/module-driven framework in the Node ecosystem
