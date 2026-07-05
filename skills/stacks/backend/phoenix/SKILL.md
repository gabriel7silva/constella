---
name: phoenix
description: Elixir web framework with realtime channels, LiveView, and an MVC structure on the BEAM; consult when building Phoenix apps or realtime features.
domain: stack
category: backend
tags: [elixir, phoenix, liveview, realtime, web-framework]
official_sources:
  - https://hexdocs.pm/phoenix/
  - https://github.com/phoenixframework/phoenix
verified: 2026-06-16
---

# Phoenix

## Overview
Phoenix is a web framework written in Elixir that aims for "peace of mind from prototype to production." Running on the Erlang VM (BEAM), it provides an MVC structure, realtime communication via Channels, and server-rendered interactive UIs via LiveView. Read this when building Phoenix web apps, APIs, or realtime features.

## Official sources
- Docs: https://hexdocs.pm/phoenix/ (canonical: https://phoenix.hexdocs.pm/)
- Repo: https://github.com/phoenixframework/phoenix
- Install / download: https://hexdocs.pm/phoenix/installation.html

## Install / setup
```bash
# Install the Phoenix application generator
mix archive.install hex phx_new

# Create a new application (replace "hello" with your app name)
mix phx.new hello
```

## Core concepts
- Endpoint & Router: the Endpoint is the entry point handling all requests; the Router maps paths to controllers and pipelines.
- Plugs & pipelines: composable request-processing functions; pipelines group plugs (e.g. `:browser`, `:api`) applied to route scopes.
- Controllers, views, templates: controllers handle requests and render templates via view modules, following an MVC structure.
- Contexts: modules that group related domain logic and data access, keeping the web layer thin.
- Channels: bidirectional realtime messaging over WebSockets for features like chat and live updates.
- LiveView: server-rendered, stateful interactive UIs without writing custom client-side JavaScript.
- Ecto: the data-mapping/query library typically used with Phoenix for schemas and migrations.

## Best practices
- Organize domain logic into Contexts so the web layer (controllers/LiveViews) stays thin (https://hexdocs.pm/phoenix/contexts.html).
- Use router pipelines (`:browser`, `:api`) to apply the right plugs per route group.
- Use Channels/LiveView for realtime rather than polling, leveraging the BEAM's concurrency.
- Use Ecto migrations and changesets for schema changes and validation.

## Common pitfalls
- Putting business logic in controllers or LiveViews → move it into Contexts for testability and reuse.
- Applying the wrong pipeline to a route (e.g. CSRF-protected `:browser` plugs on an API) → scope routes under the matching pipeline.
- Confusing the package on Hex (`phx_new` generator) with the runtime dependency (`phoenix`) → install the generator archive first, then generate the app.

## Examples
```elixir
# lib/hello_web/router.ex
scope "/", HelloWeb do
  pipe_through :browser
  get "/", PageController, :home
end
```

## Further reading
- https://hexdocs.pm/phoenix/up_and_running.html — Up and running
- https://hexdocs.pm/phoenix/contexts.html — Contexts
- https://hexdocs.pm/phoenix/channels.html — Channels (realtime)

## Related skills
- ../rails — another MVC, convention-driven web framework
- ../laravel — full-stack framework with realtime broadcasting
