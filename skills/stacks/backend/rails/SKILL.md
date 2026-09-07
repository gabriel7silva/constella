---
name: rails
description: Convention-driven full-stack Ruby MVC framework with Active Record; consult when building or maintaining a Ruby on Rails backend.
domain: stack
category: backend
tags: [ruby, rails, mvc, active-record, web-framework]
official_sources:
  - https://guides.rubyonrails.org/
  - https://github.com/rails/rails
verified: 2026-06-16
---

# Ruby on Rails

## Overview
Ruby on Rails is a web application framework that includes everything needed to build database-backed apps using the Model-View-Controller pattern. It favors convention over configuration, with Active Record for persistence plus libraries for mail, jobs, WebSockets, file storage, and rich text. Read this when scaffolding, routing, modeling data, or organizing a Rails app.

## Official sources
- Docs: https://guides.rubyonrails.org/
- Repo: https://github.com/rails/rails
- Install / download: https://guides.rubyonrails.org/getting_started.html (install Ruby/Rails: https://guides.rubyonrails.org/install_ruby_on_rails.html)

## Install / setup
```bash
# Install the Rails gem (Ruby must already be installed)
gem install rails

# Create a new application
rails new store
```

## Core concepts
- Convention over configuration: predictable file locations and naming reduce boilerplate; following conventions is what makes Rails productive.
- MVC layers: Models (domain/data, usually Active Record), Views (templates, typically HTML with embedded Ruby), Controllers (handle HTTP requests and coordinate responses).
- Active Record: maps classes to tables and provides associations, validations, and query methods; migrations evolve the schema.
- Routing: `config/routes.rb` maps URLs to controller actions, with RESTful resource routing as the default idiom.
- Generators: `rails generate` scaffolds models, controllers, and migrations following conventions.
- Asset and frontend pipeline: Rails integrates view templates and bundled JS/CSS for full-stack rendering.

## Best practices
- Lean on RESTful resource routes and conventional naming so generators and helpers work as intended (https://guides.rubyonrails.org/getting_started.html).
- Use migrations for every schema change so databases stay reproducible across environments.
- Keep business logic in models/service objects rather than controllers (fat-model/skinny-controller idiom).
- Use the built-in test framework (Minitest) and fixtures to cover models and controllers.

## Common pitfalls
- Fighting conventions (custom paths, non-standard names) → generators, autoloading, and helpers break; follow Rails naming.
- Putting heavy logic in controllers or views → move it into models or plain Ruby objects for testability.
- Editing the schema by hand instead of via migrations → environments drift; always generate and run migrations.

## Examples
```ruby
# config/routes.rb
Rails.application.routes.draw do
  resources :articles
  root "articles#index"
end
```

## Further reading
- https://guides.rubyonrails.org/getting_started.html — Getting started
- https://guides.rubyonrails.org/active_record_basics.html — Active Record basics
- https://guides.rubyonrails.org/routing.html — Rails routing

## Related skills
- ../laravel — analogous convention-driven full-stack framework in PHP
- ../phoenix — MVC-style framework with realtime, in Elixir
