---
name: backbone
description: Backbone.js — a minimalist JavaScript MVC-ish library that gives web apps structure via Models, Collections, Views, Events, and a hash/pushState Router over a RESTful JSON API. Consult when working in a legacy or lightweight Backbone codebase, wiring model change events to view re-renders, syncing models/collections to a REST backend, defining client-side routes, or integrating with Underscore/jQuery and patterns like Marionette.
domain: stack
category: frontend
tags: [backbone, backbonejs, mvc, underscore, jquery, frontend, javascript]
official_sources:
  - https://backbonejs.org/
  - https://github.com/jashkenas/backbone
  - https://www.npmjs.com/package/backbone
verified: 2026-06-17
---

# Backbone.js

## Overview
Backbone.js is a small, unopinionated library that adds structure to JavaScript-heavy web apps with key-value-bound Models, ordered Collections, event-driven Views, and a Router, all connecting to an existing API over a RESTful JSON interface. Its only hard dependency is Underscore.js; jQuery (or Zepto) is used for DOM and Ajax. Read this when maintaining or extending a Backbone codebase, debugging model/view event wiring, or syncing data with a REST backend.

## Official sources
- Docs: https://backbonejs.org/
- Repo: https://github.com/jashkenas/backbone
- Install: https://www.npmjs.com/package/backbone

## Install / setup
```bash
npm install backbone underscore jquery
```
Backbone's only hard dependency is Underscore.js (>= 1.8.3); jQuery (>= 1.11.0) is needed for `Backbone.View` DOM work and `Backbone.sync` (https://backbonejs.org/#Getting-started). You can also drop in `backbone-min.js` via a script tag from backbonejs.org.

## Core concepts
- **Model** — key-value data with validation, defaults, and `change` events via `get`/`set`.
- **Collection** — ordered set of models with Underscore enumerable methods and `add`/`remove`/`reset` events.
- **View** — binds a DOM `el` to model/collection data, declares an `events` hash, and `render`s.
- **Events** — mixin (`on`/`off`/`trigger`, `listenTo`) usable on any object; foundation of all reactivity.
- **Router** — maps URL fragments to handlers using hashchange or History `pushState`.
- **Backbone.sync** — default persistence layer mapping CRUD to RESTful JSON (override for custom backends).
- **Backbone.history** — singleton started with `Backbone.history.start()` to begin route monitoring.
- **extend** — class-style inheritance helper (`Backbone.Model.extend({...})`) for all components.

## Best practices
- Use `listenTo`/`stopListening` instead of `on` so views unbind cleanly and avoid leaks (https://backbonejs.org/#Events-listenTo).
- Keep view-managed DOM scoped to `this.$el` / the `events` hash rather than global selectors (https://backbonejs.org/#View-delegateEvents).
- Define `model` on Collections and `url`/`urlRoot` so `fetch`/`save` hit the right REST endpoint (https://backbonejs.org/#Collection-url).
- Implement `validate` and listen for `invalid` to reject bad `set`/`save` calls (https://backbonejs.org/#Model-validate).

## Common pitfalls
- Re-binding handlers with `on` on re-render leaks listeners → use `listenTo` and call `remove()`/`stopListening` on teardown.
- Routes never fire because `Backbone.history.start()` was not called → start history after routers are constructed.
- Expecting reactive templates → Backbone does not auto-render; call `render()` from a `change` listener yourself.

## Examples
```javascript
var Todo = Backbone.Model.extend({ defaults: { done: false } });

var TodoView = Backbone.View.extend({
  tagName: 'li',
  events: { 'click .toggle': 'toggle' },
  initialize: function () {
    this.listenTo(this.model, 'change', this.render);
  },
  toggle: function () {
    this.model.set('done', !this.model.get('done'));
  },
  render: function () {
    this.$el.text(this.model.get('title'));
    return this;
  }
});

var view = new TodoView({ model: new Todo({ title: 'Learn Backbone' }) });
$('#list').append(view.render().el);
```

## Further reading
- https://backbonejs.org/#FAQ — official FAQ and design rationale
- https://backbonejs.org/examples/todos/ — the canonical TodoMVC-style example
- https://marionettejs.com/ — Marionette, a higher-level framework built on Backbone

## Related skills
- ../jquery — DOM/Ajax layer Backbone relies on for views and sync
- ../react — modern component framework that superseded Backbone-era MVC
- ../ember — opinionated SPA framework contrast to Backbone's minimalism
