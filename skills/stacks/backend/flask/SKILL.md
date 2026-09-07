---
name: flask
description: Minimal Python WSGI microframework built on Werkzeug and Jinja; consult for small services, APIs, or when you want to assemble your own stack.
domain: stack
category: backend
tags: [flask, python, wsgi, microframework, jinja, backend]
official_sources:
  - https://flask.palletsprojects.com/
  - https://github.com/pallets/flask
verified: 2026-06-16
---

# Flask

## Overview
Flask is a lightweight WSGI web microframework for Python, designed for a quick start that scales up to complex applications. It is built on Werkzeug (WSGI) and Jinja (templating) and ships a minimal core, leaving database, validation, and other choices to you via extensions. Read this when you want a small, flexible Python web app or API without a prescribed project structure.

## Official sources
- Docs: https://flask.palletsprojects.com/
- Repo: https://github.com/pallets/flask
- Install: https://flask.palletsprojects.com/en/stable/installation/

## Install / setup
```bash
pip install Flask
```
The docs recommend creating and activating a virtual environment first:
```bash
mkdir myproject
cd myproject
python3 -m venv .venv
. .venv/bin/activate
```
(Source: https://flask.palletsprojects.com/en/stable/installation/)

## Core concepts
- **Application object** — `Flask(__name__)` creates the WSGI app; you register routes and run it.
- **Routing & view functions** — the `@app.route()` decorator maps URLs to functions that return responses.
- **Request / response context** — the request-bound `request` object and the application/request context manage per-request state.
- **Templates (Jinja)** — `render_template()` renders Jinja templates with auto-escaping.
- **Blueprints** — group related routes/handlers into reusable components for larger apps.
- **Extensions** — optional packages (e.g. SQLAlchemy, Flask-Login) add ORM, auth, etc.

## Best practices
- Develop inside a virtual environment to isolate dependencies, as the install guide instructs (https://flask.palletsprojects.com/en/stable/installation/).
- Use the application factory pattern and Blueprints to structure non-trivial apps (https://flask.palletsprojects.com/en/stable/patterns/appfactories/).
- Never run the built-in development server in production; use a production WSGI server like Gunicorn or uWSGI (https://flask.palletsprojects.com/en/stable/deploying/).
- Keep configuration in `app.config` / environment variables, not hardcoded.

## Common pitfalls
- Leaving `debug=True` (or the dev server) enabled in production → exposes the interactive debugger, which allows arbitrary code execution; disable debug and deploy behind a real WSGI server (https://flask.palletsprojects.com/en/stable/deploying/).
- Accessing `request` or other context-bound globals outside a request/app context → raises a "working outside of request context" error; push a context or restructure the code (https://flask.palletsprojects.com/en/stable/appcontext/).

## Examples
```python
from flask import Flask

app = Flask(__name__)

@app.route("/")
def hello():
    return "Hello, World!"
```

## Further reading
- https://flask.palletsprojects.com/en/stable/quickstart/ — quickstart
- https://flask.palletsprojects.com/en/stable/deploying/ — deployment options

## Related skills
- ../django — batteries-included Python alternative
- ../fastapi — async, typed Python API framework
