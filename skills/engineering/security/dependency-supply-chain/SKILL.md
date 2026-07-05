---
name: dependency-supply-chain
description: Manage dependency and supply-chain risk — scan for known-vulnerable components (OWASP Dependency-Check) and verify build provenance with SLSA levels.
domain: engineering
category: security
tags: [supply-chain, dependencies, sca, slsa, provenance, owasp]
official_sources:
  - https://owasp.org/www-project-dependency-check/
  - https://slsa.dev/
verified: 2026-06-16
---

# Dependency & Supply-Chain Security

## Overview
Most applications are mostly third-party code, so a vulnerable or tampered dependency is a direct path into your system (OWASP Top 10 A03 Software Supply Chain Failures). This skill covers two complementary defenses: detecting known-vulnerable components with Software Composition Analysis (OWASP Dependency-Check) and raising the integrity of how artifacts are built using the SLSA framework. Read it when adding dependencies, configuring CI/CD, or hardening a release pipeline.

## Official sources
- OWASP Dependency-Check (docs): https://owasp.org/www-project-dependency-check/
- Dependency-Check repo: https://github.com/dependency-check/DependencyCheck
- SLSA (docs): https://slsa.dev/
- SLSA repo: https://github.com/slsa-framework/slsa (an OpenSSF project)
- Licenses: Dependency-Check (Apache-2.0); SLSA spec (Community Specification License 1.0)

## Install / setup
OWASP Dependency-Check CLI quick start (verbatim from the official repo README; macOS via Homebrew):
```bash
$ brew update && brew install dependency-check
$ dependency-check -h
$ dependency-check --out . --scan [path to jar files to be scanned]
```
On other platforms, download the latest release from GitHub, then run the bundled script:
```bash
# *nix
$ ./bin/dependency-check.sh -h
$ ./bin/dependency-check.sh --out . --scan [path to jar files to be scanned]
```
```bat
:: Windows
> .\bin\dependency-check.bat -h
> .\bin\dependency-check.bat --out . --scan [path to jar files to be scanned]
```

## Core concepts
- **Software Composition Analysis (SCA).** Dependency-Check inventories a project's dependencies, derives CPE identifiers, and maps them to known CVEs from the National Vulnerability Database so you avoid shipping components with publicly disclosed vulnerabilities.
- **Pipeline integration.** Dependency-Check runs as a CLI and ships plugins/integrations for Maven, Gradle, Ant, GitHub Actions, Jenkins, Azure DevOps, and Docker (some community-maintained), so scans can gate builds.
- **SLSA framework.** SLSA ("Supply-chain Levels for Software Artifacts") is a checklist of standards and controls to prevent tampering and improve artifact integrity from source to service.
- **Provenance.** Provenance is verifiable metadata describing what entity built an artifact, what process was used, and what the inputs were. Generating provenance is the first on-ramp to SLSA.
- **SLSA build levels.** Build L0 = no guarantees; Build L1 = provenance exists (may be unsigned); Build L2 = signed provenance from a hosted build platform (prevents post-build tampering); Build L3 = hardened builds with strong isolation (prevents tampering during the build and cross-build interference).

## Best practices
- Run SCA (Dependency-Check) in CI and fail the build on newly introduced known-vulnerable dependencies, not just on a schedule.
- Generate and verify build provenance; aim to progress up the SLSA build levels (start at L1, sign provenance for L2, harden the builder for L3).
- Pin dependency versions and maintain a software bill of materials (SBOM) so you can quickly identify exposure when a new CVE drops.
- Keep components current and patched (OWASP Proactive Control C6) rather than letting transitive dependencies drift.

## Common pitfalls
- Scanning only direct dependencies → transitive dependencies carry most known CVEs; scan the full resolved tree.
- Trusting an artifact with no provenance → without signed provenance you cannot prove how or where it was built; require at least SLSA Build L1 and prefer L2+.
- Treating a one-time scan as sufficient → vulnerability data changes daily; re-scan on every build and re-evaluate released artifacts as new CVEs are published.

## Examples
```yaml
# Concept: gate a build on SCA results, then attest provenance
steps:
  - run: dependency-check --out reports --scan ./build/libs --failOnCVSS 7
  - run: generate-and-sign-provenance   # work toward SLSA Build L2/L3
```

## Further reading
- SLSA build levels specification: https://slsa.dev/spec/v1.0/levels (latest spec linked from slsa.dev)
- OWASP Top 10 A03 Software Supply Chain Failures — ../owasp-top-10

## Related skills
- ../owasp-top-10 — A03 Software Supply Chain Failures
- ../appsec-fundamentals — C6 Keep your Components Secure
- ../secrets-management — protecting pipeline/build secrets
