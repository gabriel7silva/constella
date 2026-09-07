---
name: ruby
description: Dynamic, object-oriented language focused on developer happiness; consult for Ruby syntax, idioms, gems, and install/setup.
domain: language
category: language
tags: [ruby, dynamic, object-oriented, scripting, gems]
official_sources:
  - https://www.ruby-lang.org/en/documentation/
  - https://github.com/ruby/ruby
verified: 2026-06-16
---

# Ruby

## Overview
Ruby is an interpreted, dynamic, object-oriented programming language created by Yukihiro "Matz" Matsumoto in 1995, designed to make programmers productive and happy. Everything in Ruby is an object, and the language emphasizes readable, expressive syntax. Read this when writing Ruby scripts, working with gems, or setting up a Ruby toolchain.

## Official sources
- Docs: https://www.ruby-lang.org/en/documentation/
- Repo: https://github.com/ruby/ruby
- Install / download: https://www.ruby-lang.org/en/downloads/

## Install / setup
On Windows, the official downloads page recommends RubyInstaller; on macOS and Linux/UNIX it recommends third-party version managers (rbenv and RVM) or the distribution package manager. From the official downloads page, using a version manager:

```bash
# Linux/UNIX or macOS via rbenv (third-party tool recommended on ruby-lang.org)
rbenv install 4.0.5
rbenv global 4.0.5
```

Source: https://www.ruby-lang.org/en/downloads/ (current stable listed there is Ruby 4.0.5; substitute the version you need)

## Core concepts
- Everything is an object — integers, strings, and even `nil` respond to methods; there are no primitives.
- Dynamic typing with duck typing — an object's suitability is determined by the methods it responds to, not its declared class.
- Blocks, procs, and lambdas — first-class chunks of code passed to methods (e.g. `each`, `map`); the foundation of Ruby iteration.
- Mixins via modules — share behavior across classes with `include`/`extend` instead of multiple inheritance.
- Open classes and metaprogramming — classes can be reopened and methods defined at runtime (`define_method`, `method_missing`).
- Gems and Bundler — RubyGems packages libraries; Bundler resolves and locks dependencies via a `Gemfile`.
- Exceptions, iterators, closures, and garbage collection are built into the core language.

## Best practices
- Follow a community style guide (RuboCop, Shopify, GitLab, or Airbnb guides are linked from ruby-lang.org) and run RuboCop to enforce it.
- Use Bundler with a committed `Gemfile.lock` for reproducible dependency installs.
- Prefer iterators and blocks (`each`, `map`, `select`) over manual index loops for idiomatic, readable code.
- Use a version manager (rbenv/RVM) so each project can pin a known Ruby version.

## Common pitfalls
- Treating `nil` as falsy-only — in Ruby only `nil` and `false` are falsy; `0` and `""` are truthy. → Test explicitly when you mean numeric/empty.
- Mutating shared mutable state through reopened classes ("monkey patching") → prefer refinements or composition to limit scope.
- Forgetting that assignment in blocks can leak or shadow variables → keep block-local variables explicit and small.

## Examples
```ruby
# Blocks and iterators
names = ["ada", "grace", "linus"]
names.map { |n| n.capitalize }.each { |n| puts "Hello, #{n}" }
```

## Further reading
- Official documentation hub: https://www.ruby-lang.org/en/documentation/
- API docs for all versions: https://docs.ruby-lang.org/en/

## Related skills
- ../python — another dynamic, batteries-included scripting language
- ../php — server-side scripting comparison
