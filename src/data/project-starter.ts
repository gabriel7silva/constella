/**
 * Deterministic, stack-aware RUNNABLE starter for a freshly-created project. Generates a real,
 * configured app that boots a dev server out of the box (so Test Dev previews it immediately), with
 * a themed landing page. The agents then build the actual product ON TOP of this base.
 *
 * Pure functions (no fs) — `starterFor(ctx)` returns [relPath, content][] like scaffold's
 * workspaceFiles(). Written ONCE at onboarding, absent-only (see scaffold.scaffoldProjectStarter),
 * so agent edits are never clobbered. The `static` template (pure Node http) is the universal
 * fallback — Node is always present, so every project boots SOMETHING regardless of stack.
 */

export type StarterId =
  | "next" | "vite-react" | "vite-vue" | "vite-svelte"
  | "node-express" | "node-fastify" | "node-koa" | "node-hono" | "node-nest"
  | "fastapi" | "flask" | "django"
  | "go-http" | "go-gin"
  | "rust-axum" | "rust-actix"
  | "static";

export type StarterCtx = { company: string; mission: string; objective: string; slug: string; stack: Record<string, string> };

// Deterministic per-project palette (duplicated from readme-template to keep data modules decoupled).
const PALETTES = [
  { c1: "0E0D17", c2: "E0A44E" }, { c1: "0B1120", c2: "38BDF8" }, { c1: "1A0B2E", c2: "A855F7" },
  { c1: "0A1F1C", c2: "2DD4BF" }, { c1: "1F0A0A", c2: "F87171" }, { c1: "0A0A1F", c2: "6366F1" },
  { c1: "131A0A", c2: "A3E635" }, { c1: "1F140A", c2: "FB923C" },
];
function paletteFor(name: string) {
  let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTES[h % PALETTES.length];
}

const esc = (s: string) => (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function stackLine(stack: Record<string, string>): string {
  return Object.values(stack || {}).filter((v) => v && v !== "None").slice(0, 10).join(" · ");
}

/** A self-contained, themed HTML landing page (used by every server-rendered template). */
export function landingHtml(ctx: StarterCtx): string {
  const p = paletteFor(ctx.company);
  const obj = ctx.objective?.trim() || "this product";
  const chips = stackLine(ctx.stack);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(ctx.company)}</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: radial-gradient(1200px 800px at 70% -10%, #${p.c2}33, transparent), linear-gradient(160deg, #${p.c1}, #05060d); color: #e8eaf2; }
  .card { max-width: 680px; padding: 48px 44px; text-align: center; }
  .badge { display: inline-block; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: #${p.c2}; border: 1px solid #${p.c2}55; border-radius: 999px; padding: 5px 14px; margin-bottom: 22px; }
  h1 { font-size: 52px; margin: 0 0 14px; background: linear-gradient(120deg, #fff, #${p.c2}); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .mission { font-size: 17px; line-height: 1.6; color: #c3c7d6; margin: 0 0 26px; }
  .build { font-size: 14px; color: #9aa0b8; background: #ffffff0a; border: 1px solid #ffffff14; border-radius: 12px; padding: 14px 18px; margin-bottom: 22px; }
  .build b { color: #${p.c2}; }
  .chips { font-size: 12px; color: #8b90a8; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; margin-bottom: 30px; }
  .foot { font-size: 12px; color: #6b7088; }
  .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #${p.c2}; margin-right: 7px; box-shadow: 0 0 12px #${p.c2}; animation: pulse 1.8s ease-in-out infinite; }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .4; } }
</style>
</head>
<body>
  <div class="card">
    <span class="badge">● Live starter</span>
    <h1>${esc(ctx.company)}</h1>
    <p class="mission">${esc(ctx.mission || "Your project, scaffolded and running.")}</p>
    <div class="build"><span class="dot"></span>Your AI team is building <b>${esc(obj)}</b> on top of this starter.</div>
    ${chips ? `<div class="chips">${esc(chips)}</div>` : ""}
    <div class="foot">Runnable starter scaffolded by Constella · edit these files to build the product.</div>
  </div>
</body>
</html>`;
}

/* ----------------------------------------------------------------- shared small files */
const GITIGNORE_NODE = `node_modules\n.next\ndist\nbuild\n.env\n.env.local\n*.log\n.DS_Store\n`;
const GITIGNORE_PY = `__pycache__/\n*.pyc\n.venv/\nvenv/\n.env\n*.log\n.constella-pyinstalled\n`;
const GITIGNORE_GO = `/bin/\n*.exe\n.env\n*.log\n`;
const GITIGNORE_RUST = `/target\n.env\n*.log\n`;
const ENV_EXAMPLE = `# Copy to .env and fill in. The dev server binds the PORT chosen by Test Dev.\nPORT=\n`;

const pkg = (slug: string, fields: Record<string, unknown>) =>
  JSON.stringify({ name: slug || "project", version: "0.1.0", private: true, ...fields }, null, 2) + "\n";

/* ----------------------------------------------------------------- Node templates */
// Embed the landing HTML as a JS string literal via JSON.stringify (no backtick nesting).
function nodeServer(ctx: StarterCtx, flavor: "http" | "express" | "fastify" | "koa" | "hono"): string {
  const HTML = JSON.stringify(landingHtml(ctx));
  const head = `const PORT = Number(process.env.PORT) || 3000;\nconst HTML = ${HTML};\n`;
  if (flavor === "http") return `const http = require("http");\n${head}http.createServer((req, res) => { res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); res.end(HTML); }).listen(PORT, "127.0.0.1", () => console.log("listening on http://127.0.0.1:" + PORT));\n`;
  if (flavor === "express") return `const express = require("express");\n${head}const app = express();\napp.get("/", (_req, res) => res.type("html").send(HTML));\napp.listen(PORT, "127.0.0.1", () => console.log("listening on http://127.0.0.1:" + PORT));\n`;
  if (flavor === "fastify") return `const Fastify = require("fastify");\n${head}const app = Fastify();\napp.get("/", (_req, reply) => reply.type("text/html").send(HTML));\napp.listen({ port: PORT, host: "127.0.0.1" }).then(() => console.log("listening on http://127.0.0.1:" + PORT));\n`;
  if (flavor === "koa") return `const Koa = require("koa");\n${head}const app = new Koa();\napp.use((ctx) => { ctx.type = "html"; ctx.body = HTML; });\napp.listen(PORT, "127.0.0.1", () => console.log("listening on http://127.0.0.1:" + PORT));\n`;
  return `const { serve } = require("@hono/node-server");\nconst { Hono } = require("hono");\n${head}const app = new Hono();\napp.get("/", (c) => c.html(HTML));\nserve({ fetch: app.fetch, port: PORT, hostname: "127.0.0.1" }, () => console.log("listening on http://127.0.0.1:" + PORT));\n`;
}

function nodeBackend(ctx: StarterCtx, id: "node-express" | "node-fastify" | "node-koa" | "node-hono" | "static"): [string, string][] {
  const flavor = id === "static" ? "http" : id === "node-express" ? "express" : id === "node-fastify" ? "fastify" : id === "node-koa" ? "koa" : "hono";
  const deps: Record<string, string> =
    flavor === "express" ? { express: "^4.19.2" } :
    flavor === "fastify" ? { fastify: "^4.28.1" } :
    flavor === "koa" ? { koa: "^2.15.3" } :
    flavor === "hono" ? { hono: "^4.5.0", "@hono/node-server": "^1.12.0" } : {};
  return [
    ["package.json", pkg(ctx.slug, { scripts: { dev: "node server.js", start: "node server.js" }, ...(Object.keys(deps).length ? { dependencies: deps } : {}) })],
    ["server.js", nodeServer(ctx, flavor as "http" | "express" | "fastify" | "koa" | "hono")],
    [".gitignore", GITIGNORE_NODE],
    [".env.example", ENV_EXAMPLE],
  ];
}

function nodeNest(ctx: StarterCtx): [string, string][] {
  const HTML = JSON.stringify(landingHtml(ctx));
  const main = `import "reflect-metadata";
import { Controller, Get, Module, Header } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

const HTML = ${HTML};

@Controller()
class AppController {
  @Get()
  @Header("Content-Type", "text/html")
  home(): string { return HTML; }
}

@Module({ controllers: [AppController] })
class AppModule {}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: ["error", "warn"] });
  const port = Number(process.env.PORT) || 3000;
  await app.listen(port, "127.0.0.1");
  console.log("listening on http://127.0.0.1:" + port);
}
bootstrap();
`;
  const tsconfig = JSON.stringify({ compilerOptions: { module: "commonjs", target: "ES2021", experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true, skipLibCheck: true, strict: false, outDir: "dist" } }, null, 2) + "\n";
  return [
    ["package.json", pkg(ctx.slug, {
      scripts: { dev: "tsx watch src/main.ts", start: "tsx src/main.ts" },
      dependencies: { "@nestjs/common": "^10.4.1", "@nestjs/core": "^10.4.1", "@nestjs/platform-express": "^10.4.1", "reflect-metadata": "^0.2.2", rxjs: "^7.8.1" },
      devDependencies: { tsx: "^4.19.2", typescript: "^5.5.4" },
    })],
    ["src/main.ts", main],
    ["tsconfig.json", tsconfig],
    [".gitignore", GITIGNORE_NODE],
    [".env.example", ENV_EXAMPLE],
  ];
}

/* ----------------------------------------------------------------- Vite (React/Vue/Svelte) */
function landBlock(ctx: StarterCtx) {
  const p = paletteFor(ctx.company);
  return { p, obj: ctx.objective?.trim() || "this product", chips: stackLine(ctx.stack) };
}

function viteReact(ctx: StarterCtx): [string, string][] {
  const { p, obj, chips } = landBlock(ctx);
  const css = `:root{color-scheme:dark}body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:radial-gradient(1200px 800px at 70% -10%,#${p.c2}33,transparent),linear-gradient(160deg,#${p.c1},#05060d);color:#e8eaf2}.card{max-width:680px;padding:48px 44px;text-align:center}.badge{display:inline-block;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#${p.c2};border:1px solid #${p.c2}55;border-radius:999px;padding:5px 14px;margin-bottom:22px}h1{font-size:52px;margin:0 0 14px;background:linear-gradient(120deg,#fff,#${p.c2});-webkit-background-clip:text;background-clip:text;color:transparent}.mission{font-size:17px;line-height:1.6;color:#c3c7d6;margin:0 0 26px}.build{font-size:14px;color:#9aa0b8;background:#ffffff0a;border:1px solid #ffffff14;border-radius:12px;padding:14px 18px;margin-bottom:22px}.build b{color:#${p.c2}}.chips{font-size:12px;color:#8b90a8;font-family:ui-monospace,monospace;margin-bottom:30px}.foot{font-size:12px;color:#6b7088}`;
  const app = `export default function App() {
  return (
    <div className="card">
      <span className="badge">● Live starter</span>
      <h1>${JSON.stringify(ctx.company).slice(1, -1)}</h1>
      <p className="mission">${JSON.stringify(ctx.mission || "Your project, scaffolded and running.").slice(1, -1)}</p>
      <div className="build">Your AI team is building <b>${JSON.stringify(obj).slice(1, -1)}</b> on top of this starter.</div>
      ${chips ? `<div className="chips">${JSON.stringify(chips).slice(1, -1)}</div>` : ""}
      <div className="foot">Runnable starter scaffolded by Constella — edit src/App.tsx to build the product.</div>
    </div>
  );
}
`;
  return [
    ["package.json", pkg(ctx.slug, {
      scripts: { dev: "vite", build: "vite build", preview: "vite preview" },
      dependencies: { react: "^18.3.1", "react-dom": "^18.3.1" },
      devDependencies: { vite: "^5.4.0", "@vitejs/plugin-react": "^4.3.1", typescript: "^5.5.4", "@types/react": "^18.3.3", "@types/react-dom": "^18.3.0" },
    })],
    ["vite.config.ts", `import { defineConfig } from "vite";\nimport react from "@vitejs/plugin-react";\nexport default defineConfig({ plugins: [react()], server: { host: "127.0.0.1", port: Number(process.env.PORT) || 5173, strictPort: false } });\n`],
    ["index.html", `<!doctype html>\n<html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${esc(ctx.company)}</title></head>\n<body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>\n`],
    ["src/main.tsx", `import React from "react";\nimport { createRoot } from "react-dom/client";\nimport App from "./App";\nimport "./index.css";\ncreateRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);\n`],
    ["src/App.tsx", app],
    ["src/index.css", css + "\n"],
    ["tsconfig.json", JSON.stringify({ compilerOptions: { target: "ES2021", lib: ["ES2021", "DOM", "DOM.Iterable"], jsx: "react-jsx", module: "ESNext", moduleResolution: "bundler", strict: false, skipLibCheck: true, esModuleInterop: true }, include: ["src"] }, null, 2) + "\n"],
    [".gitignore", GITIGNORE_NODE],
    [".env.example", ENV_EXAMPLE],
  ];
}

function viteVue(ctx: StarterCtx): [string, string][] {
  const { obj, chips } = landBlock(ctx);
  const appVue = `<template>
  <div class="card">
    <span class="badge">● Live starter</span>
    <h1>{{ company }}</h1>
    <p class="mission">{{ mission }}</p>
    <div class="build">Your AI team is building <b>{{ objective }}</b> on top of this starter.</div>
    <div v-if="chips" class="chips">{{ chips }}</div>
    <div class="foot">Runnable starter scaffolded by Constella — edit src/App.vue to build the product.</div>
  </div>
</template>
<script setup>
const company = ${JSON.stringify(ctx.company)};
const mission = ${JSON.stringify(ctx.mission || "Your project, scaffolded and running.")};
const objective = ${JSON.stringify(obj)};
const chips = ${JSON.stringify(chips)};
</script>
`;
  return [
    ["package.json", pkg(ctx.slug, {
      scripts: { dev: "vite", build: "vite build", preview: "vite preview" },
      dependencies: { vue: "^3.4.38" },
      devDependencies: { vite: "^5.4.0", "@vitejs/plugin-vue": "^5.1.2" },
    })],
    ["vite.config.js", `import { defineConfig } from "vite";\nimport vue from "@vitejs/plugin-vue";\nexport default defineConfig({ plugins: [vue()], server: { host: "127.0.0.1", port: Number(process.env.PORT) || 5173, strictPort: false } });\n`],
    ["index.html", `<!doctype html>\n<html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${esc(ctx.company)}</title></head>\n<body><div id="app"></div><script type="module" src="/src/main.js"></script></body></html>\n`],
    ["src/main.js", `import { createApp } from "vue";\nimport App from "./App.vue";\nimport "./index.css";\ncreateApp(App).mount("#app");\n`],
    ["src/App.vue", appVue],
    ["src/index.css", viteCss(ctx)],
    [".gitignore", GITIGNORE_NODE],
    [".env.example", ENV_EXAMPLE],
  ];
}

function viteSvelte(ctx: StarterCtx): [string, string][] {
  const { obj, chips } = landBlock(ctx);
  const appSvelte = `<script>
  const company = ${JSON.stringify(ctx.company)};
  const mission = ${JSON.stringify(ctx.mission || "Your project, scaffolded and running.")};
  const objective = ${JSON.stringify(obj)};
  const chips = ${JSON.stringify(chips)};
</script>
<div class="card">
  <span class="badge">● Live starter</span>
  <h1>{company}</h1>
  <p class="mission">{mission}</p>
  <div class="build">Your AI team is building <b>{objective}</b> on top of this starter.</div>
  {#if chips}<div class="chips">{chips}</div>{/if}
  <div class="foot">Runnable starter scaffolded by Constella — edit src/App.svelte to build the product.</div>
</div>
`;
  return [
    ["package.json", pkg(ctx.slug, {
      scripts: { dev: "vite", build: "vite build", preview: "vite preview" },
      dependencies: {},
      devDependencies: { vite: "^5.4.0", svelte: "^4.2.19", "@sveltejs/vite-plugin-svelte": "^3.1.1" },
    })],
    ["vite.config.js", `import { defineConfig } from "vite";\nimport { svelte } from "@sveltejs/vite-plugin-svelte";\nexport default defineConfig({ plugins: [svelte()], server: { host: "127.0.0.1", port: Number(process.env.PORT) || 5173, strictPort: false } });\n`],
    ["svelte.config.js", `import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";\nexport default { preprocess: vitePreprocess() };\n`],
    ["index.html", `<!doctype html>\n<html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${esc(ctx.company)}</title></head>\n<body><div id="app"></div><script type="module" src="/src/main.js"></script></body></html>\n`],
    ["src/main.js", `import App from "./App.svelte";\nimport "./index.css";\nconst app = new App({ target: document.getElementById("app") });\nexport default app;\n`],
    ["src/App.svelte", appSvelte],
    ["src/index.css", viteCss(ctx)],
    [".gitignore", GITIGNORE_NODE],
    [".env.example", ENV_EXAMPLE],
  ];
}

function viteCss(ctx: StarterCtx): string {
  const p = paletteFor(ctx.company);
  return `:root{color-scheme:dark}body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:radial-gradient(1200px 800px at 70% -10%,#${p.c2}33,transparent),linear-gradient(160deg,#${p.c1},#05060d);color:#e8eaf2}.card{max-width:680px;padding:48px 44px;text-align:center}.badge{display:inline-block;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#${p.c2};border:1px solid #${p.c2}55;border-radius:999px;padding:5px 14px;margin-bottom:22px}h1{font-size:52px;margin:0 0 14px;background:linear-gradient(120deg,#fff,#${p.c2});-webkit-background-clip:text;background-clip:text;color:transparent}.mission{font-size:17px;line-height:1.6;color:#c3c7d6;margin:0 0 26px}.build{font-size:14px;color:#9aa0b8;background:#ffffff0a;border:1px solid #ffffff14;border-radius:12px;padding:14px 18px;margin-bottom:22px}.build b{color:#${p.c2}}.chips{font-size:12px;color:#8b90a8;font-family:ui-monospace,monospace;margin-bottom:30px}.foot{font-size:12px;color:#6b7088}\n`;
}

/* ----------------------------------------------------------------- Next.js */
function nextApp(ctx: StarterCtx): [string, string][] {
  const { obj, chips } = landBlock(ctx);
  const page = `export default function Home() {
  return (
    <main className="card">
      <span className="badge">● Live starter</span>
      <h1>${JSON.stringify(ctx.company).slice(1, -1)}</h1>
      <p className="mission">${JSON.stringify(ctx.mission || "Your project, scaffolded and running.").slice(1, -1)}</p>
      <div className="build">Your AI team is building <b>${JSON.stringify(obj).slice(1, -1)}</b> on top of this starter.</div>
      ${chips ? `<div className="chips">${JSON.stringify(chips).slice(1, -1)}</div>` : ""}
      <div className="foot">Runnable starter scaffolded by Constella — edit app/page.tsx to build the product.</div>
    </main>
  );
}
`;
  return [
    ["package.json", pkg(ctx.slug, {
      scripts: { dev: "next dev", build: "next build", start: "next start" },
      dependencies: { next: "^14.2.5", react: "^18.3.1", "react-dom": "^18.3.1" },
      devDependencies: { typescript: "^5.5.4", "@types/react": "^18.3.3", "@types/node": "^20.14.0" },
    })],
    ["next.config.mjs", `/** @type {import('next').NextConfig} */\nexport default { reactStrictMode: true };\n`],
    ["tsconfig.json", JSON.stringify({ compilerOptions: { target: "ES2021", lib: ["dom", "dom.iterable", "esnext"], jsx: "preserve", module: "esnext", moduleResolution: "bundler", strict: false, skipLibCheck: true, esModuleInterop: true, plugins: [{ name: "next" }], incremental: true }, include: ["next-env.d.ts", "**/*.ts", "**/*.tsx"], exclude: ["node_modules"] }, null, 2) + "\n"],
    ["next-env.d.ts", `/// <reference types="next" />\n/// <reference types="next/image-types/global" />\n`],
    ["app/layout.tsx", `import "./globals.css";\nexport const metadata = { title: ${JSON.stringify(ctx.company)} };\nexport default function RootLayout({ children }: { children: React.ReactNode }) {\n  return (<html lang="en"><body>{children}</body></html>);\n}\n`],
    ["app/page.tsx", page],
    ["app/globals.css", viteCss(ctx)],
    [".gitignore", GITIGNORE_NODE],
    [".env.example", ENV_EXAMPLE],
  ];
}

/* ----------------------------------------------------------------- Python */
function pyLanding(ctx: StarterCtx): string {
  // triple-quoted python string; landingHtml never contains """.
  return `HTML = """${landingHtml(ctx)}"""\n`;
}
function fastapiApp(ctx: StarterCtx): [string, string][] {
  return [
    ["requirements.txt", "fastapi>=0.111\nuvicorn[standard]>=0.30\n"],
    ["main.py", `from fastapi import FastAPI\nfrom fastapi.responses import HTMLResponse\n\n${pyLanding(ctx)}\napp = FastAPI()\n\n@app.get("/", response_class=HTMLResponse)\ndef home():\n    return HTML\n`],
    [".gitignore", GITIGNORE_PY],
    [".env.example", ENV_EXAMPLE],
  ];
}
function flaskApp(ctx: StarterCtx): [string, string][] {
  return [
    ["requirements.txt", "flask>=3.0\n"],
    ["main.py", `import os\nfrom flask import Flask\n\n${pyLanding(ctx)}\napp = Flask(__name__)\n\n@app.get("/")\ndef home():\n    return HTML\n\nif __name__ == "__main__":\n    port = int(os.environ.get("PORT", 5000))\n    print("listening on http://127.0.0.1:" + str(port))\n    app.run(host="127.0.0.1", port=port)\n`],
    [".gitignore", GITIGNORE_PY],
    [".env.example", ENV_EXAMPLE],
  ];
}
function djangoApp(ctx: StarterCtx): [string, string][] {
  const secret = "django-insecure-" + paletteFor(ctx.company).c2 + "-starter-key-change-me";
  return [
    ["requirements.txt", "django>=5.0\n"],
    ["manage.py", `#!/usr/bin/env python\nimport os, sys\nif __name__ == "__main__":\n    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")\n    from django.core.management import execute_from_command_line\n    execute_from_command_line(sys.argv)\n`],
    ["config/__init__.py", ""],
    ["config/settings.py", `from pathlib import Path\nBASE_DIR = Path(__file__).resolve().parent.parent\nSECRET_KEY = ${JSON.stringify(secret)}\nDEBUG = True\nALLOWED_HOSTS = ["*"]\nINSTALLED_APPS = ["django.contrib.contenttypes", "django.contrib.staticfiles"]\nMIDDLEWARE = ["django.middleware.common.CommonMiddleware"]\nROOT_URLCONF = "config.urls"\nTEMPLATES = [{"BACKEND": "django.template.backends.django.DjangoTemplates", "DIRS": [], "APP_DIRS": True, "OPTIONS": {}}]\nWSGI_APPLICATION = "config.wsgi.application"\nSTATIC_URL = "static/"\nDATABASES = {}\n`],
    ["config/urls.py", `from django.http import HttpResponse\nfrom django.urls import path\n\n${pyLanding(ctx)}\ndef home(_request):\n    return HttpResponse(HTML)\n\nurlpatterns = [path("", home)]\n`],
    ["config/wsgi.py", `import os\nfrom django.core.wsgi import get_wsgi_application\nos.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")\napplication = get_wsgi_application()\n`],
    [".gitignore", GITIGNORE_PY],
    [".env.example", ENV_EXAMPLE],
  ];
}

/* ----------------------------------------------------------------- Go */
function goHttp(ctx: StarterCtx): [string, string][] {
  const html = landingHtml(ctx); // Go raw string `...` — html has no backticks
  return [
    ["go.mod", `module ${ctx.slug || "project"}\n\ngo 1.21\n`],
    ["main.go", `package main\n\nimport (\n\t"log"\n\t"net/http"\n\t"os"\n)\n\nconst html = \`${html}\`\n\nfunc main() {\n\tport := os.Getenv("PORT")\n\tif port == "" {\n\t\tport = "8080"\n\t}\n\thttp.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {\n\t\tw.Header().Set("Content-Type", "text/html; charset=utf-8")\n\t\tw.Write([]byte(html))\n\t})\n\tlog.Println("listening on http://127.0.0.1:" + port)\n\tlog.Fatal(http.ListenAndServe("127.0.0.1:"+port, nil))\n}\n`],
    [".gitignore", GITIGNORE_GO],
    [".env.example", ENV_EXAMPLE],
  ];
}
function goGin(ctx: StarterCtx): [string, string][] {
  const html = landingHtml(ctx);
  return [
    ["go.mod", `module ${ctx.slug || "project"}\n\ngo 1.21\n\nrequire github.com/gin-gonic/gin v1.10.0\n`],
    ["main.go", `package main\n\nimport (\n\t"net/http"\n\t"os"\n\n\t"github.com/gin-gonic/gin"\n)\n\nconst html = \`${html}\`\n\nfunc main() {\n\tport := os.Getenv("PORT")\n\tif port == "" {\n\t\tport = "8080"\n\t}\n\tr := gin.Default()\n\tr.GET("/", func(c *gin.Context) {\n\t\tc.Data(http.StatusOK, "text/html; charset=utf-8", []byte(html))\n\t})\n\tr.Run("127.0.0.1:" + port)\n}\n`],
    [".gitignore", GITIGNORE_GO],
    [".env.example", ENV_EXAMPLE],
  ];
}

/* ----------------------------------------------------------------- Rust */
function rustRaw(html: string): string {
  // Rust raw string r#"..."# — landingHtml never contains the `"#` sequence.
  return `r#"${html}"#`;
}
function rustAxum(ctx: StarterCtx): [string, string][] {
  return [
    ["Cargo.toml", `[package]\nname = "${(ctx.slug || "project").replace(/[^a-z0-9_-]/gi, "-")}"\nversion = "0.1.0"\nedition = "2021"\n\n[dependencies]\naxum = "0.7"\ntokio = { version = "1", features = ["full"] }\n`],
    ["src/main.rs", `use axum::{routing::get, Router, response::Html};\nuse std::env;\n\nasync fn home() -> Html<&'static str> { Html(${rustRaw(landingHtml(ctx))}) }\n\n#[tokio::main]\nasync fn main() {\n    let port = env::var("PORT").unwrap_or_else(|_| "8080".to_string());\n    let app = Router::new().route("/", get(home));\n    let addr = format!("127.0.0.1:{}", port);\n    println!("listening on http://{}", addr);\n    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();\n    axum::serve(listener, app).await.unwrap();\n}\n`],
    [".gitignore", GITIGNORE_RUST],
    [".env.example", ENV_EXAMPLE],
  ];
}
function rustActix(ctx: StarterCtx): [string, string][] {
  return [
    ["Cargo.toml", `[package]\nname = "${(ctx.slug || "project").replace(/[^a-z0-9_-]/gi, "-")}"\nversion = "0.1.0"\nedition = "2021"\n\n[dependencies]\nactix-web = "4"\n`],
    ["src/main.rs", `use actix_web::{get, App, HttpServer, HttpResponse};\nuse std::env;\n\n#[get("/")]\nasync fn home() -> HttpResponse { HttpResponse::Ok().content_type("text/html; charset=utf-8").body(${rustRaw(landingHtml(ctx))}) }\n\n#[actix_web::main]\nasync fn main() -> std::io::Result<()> {\n    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8080);\n    println!("listening on http://127.0.0.1:{}", port);\n    HttpServer::new(|| App::new().service(home)).bind(("127.0.0.1", port))?.run().await\n}\n`],
    [".gitignore", GITIGNORE_RUST],
    [".env.example", ENV_EXAMPLE],
  ];
}

/* ----------------------------------------------------------------- selection */
const SSR_META = new Set(["Next.js", "Nuxt", "Remix", "SvelteKit", "Astro", "Gatsby"]);

/** Pure: choose the starter template id from the chosen stack. Web/frontend beats backend; a Node
 *  path is always preferred when ambiguous; unknown → the always-bootable `static` Node server. */
export function pickStarter(stack: Record<string, string>): StarterId {
  const s = stack || {};
  const meta = s.meta, fe = s.frontend, be = s.backend, lang = s.language;

  if (meta === "Next.js") return "next";
  // Meta-framework implies its frontend family even when `frontend` is left unset/None — otherwise a
  // SvelteKit/Nuxt project with no explicit frontend fell through to the vite-react baseline.
  if (meta === "SvelteKit") return "vite-svelte";
  if (meta === "Nuxt") return "vite-vue";
  // Plain HTML/CSS/JS or an explicit "no framework" choice → the always-bootable static server.
  if (fe === "HTML/CSS" || fe === "Vanilla JS" || meta === "Static (no framework)") return "static";
  // SSR metas without a dedicated template → closest Vite baseline by frontend.
  if (meta === "Vite (SPA)" || (fe && fe !== "None" && (!meta || meta === "None" || SSR_META.has(meta)))) {
    if (fe === "Vue") return "vite-vue";
    if (fe === "Svelte" || meta === "SvelteKit") return "vite-svelte";
    return "vite-react";
  }
  if (be === "Express") return "node-express";
  if (be === "Fastify") return "node-fastify";
  if (be === "Koa") return "node-koa";
  if (be === "Hono") return "node-hono";
  if (be === "NestJS") return "node-nest";
  if (be === "FastAPI") return "fastapi";
  if (be === "Flask") return "flask";
  if (be === "Django") return "django";
  if (be === "Gin") return "go-gin";
  if (be === "Actix") return "rust-actix";
  if (lang === "Python") return "flask";
  if (lang === "Go") return "go-http";
  if (lang === "Rust") return "rust-axum";
  // JS/TS language with no framework picked → a safe Vite-React app.
  if (lang === "TypeScript" || lang === "JavaScript") return "vite-react";
  return "static";
}

/** The [relPath, content][] file set for a stack's runnable starter. */
export function projectStarterFiles(ctx: StarterCtx): [string, string][] {
  const id = pickStarter(ctx.stack);
  switch (id) {
    case "next": return nextApp(ctx);
    case "vite-react": return viteReact(ctx);
    case "vite-vue": return viteVue(ctx);
    case "vite-svelte": return viteSvelte(ctx);
    case "node-express": case "node-fastify": case "node-koa": case "node-hono": return nodeBackend(ctx, id);
    case "node-nest": return nodeNest(ctx);
    case "fastapi": return fastapiApp(ctx);
    case "flask": return flaskApp(ctx);
    case "django": return djangoApp(ctx);
    case "go-http": return goHttp(ctx);
    case "go-gin": return goGin(ctx);
    case "rust-axum": return rustAxum(ctx);
    case "rust-actix": return rustActix(ctx);
    default: return nodeBackend(ctx, "static");
  }
}

export function starterFor(ctx: StarterCtx): { id: StarterId; files: [string, string][] } {
  return { id: pickStarter(ctx.stack), files: projectStarterFiles(ctx) };
}
