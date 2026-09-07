---
name: spring
description: Spring Framework and Spring Boot — the Java/Kotlin application framework for dependency injection, web/REST APIs, data access, and security. Consult when building Java backends, wiring beans, writing @RestController endpoints, configuring Spring Boot auto-configuration, JPA/JDBC data access, or bootstrapping a project from Spring Initializr (start.spring.io).
domain: stack
category: backend
tags: [spring, spring-boot, java, kotlin, jvm, dependency-injection, rest]
official_sources:
  - https://docs.spring.io/spring-framework/reference/
  - https://github.com/spring-projects/spring-framework
  - https://start.spring.io/
verified: 2026-06-17
---

# Spring Framework

## Overview
Spring is the dominant application framework for the JVM, providing an inversion-of-control (IoC) container, declarative transactions, web MVC, data access, and security. Spring Boot layers opinionated auto-configuration and an embedded server on top so apps run with `java -jar`. Read this when building Java/Kotlin backends, defining beans, writing REST controllers, or wiring Spring Data/Security.

## Official sources
- Docs: https://docs.spring.io/spring-framework/reference/
- Repo: https://github.com/spring-projects/spring-framework
- Install: https://start.spring.io/

## Install / setup
```bash
# Generate a Spring Boot project from Spring Initializr (web dependency)
curl https://start.spring.io/starter.zip -d dependencies=web -d type=gradle-project -o demo.zip
unzip demo.zip && ./gradlew bootRun
```
Source: https://spring.io/quickstart/ (start.spring.io generates the project; `./gradlew bootRun` runs it on :8080).

## Core concepts
- **IoC container / ApplicationContext** — manages bean lifecycle and dependency injection.
- **Beans & stereotypes** — `@Component`, `@Service`, `@Repository`, `@Controller` register beans; `@Autowired`/constructor injection wires them.
- **Auto-configuration (Boot)** — `@SpringBootApplication` enables component scan + conditional config based on the classpath.
- **Spring MVC** — `@RestController` + `@GetMapping`/`@PostMapping` map HTTP to handler methods.
- **Spring Data** — repository interfaces (`JpaRepository`) generate queries from method names.
- **Declarative transactions** — `@Transactional` manages commit/rollback boundaries.
- **Profiles & config** — `application.yml`/`application.properties`, `@Profile`, externalized `@ConfigurationProperties`.
- **Spring Security** — filter-chain based authn/authz via `SecurityFilterChain` beans.

## Best practices
- Prefer constructor injection over field injection for testability and immutability (https://docs.spring.io/spring-framework/reference/core/beans/dependencies/factory-collaborators.html).
- Let Spring Boot starters manage versions; do not pin transitive deps manually (https://docs.spring.io/spring-boot/reference/using/build-systems.html).
- Externalize config and use profiles instead of hardcoding env values (https://docs.spring.io/spring-boot/reference/features/external-config.html).
- Keep `@Transactional` on the service layer, not controllers (https://docs.spring.io/spring-framework/reference/data-access/transaction.html).

## Common pitfalls
- Calling a `@Transactional`/`@Cacheable` method from within the same bean bypasses the proxy → split into a separate bean or use self-injection.
- Field injection hides missing deps and breaks unit tests → use constructor injection.
- `@SpringBootApplication` in the wrong package skips component scanning → place it at the root package.

## Examples
```java
@RestController
class HelloController {
  @GetMapping("/hello")
  String hello(@RequestParam(defaultValue = "World") String name) {
    return "Hello " + name;
  }
}
```

## Further reading
- https://docs.spring.io/spring-boot/index.html — Spring Boot reference docs
- https://spring.io/guides — official task-focused getting-started guides

## Related skills
- ../graphql — expose a Spring backend via GraphQL (Spring for GraphQL)
- ../nginx — reverse-proxy a Spring Boot app behind Nginx
