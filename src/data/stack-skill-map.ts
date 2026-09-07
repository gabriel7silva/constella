/**
 * Maps a Project-Stack catalog value (the human name in STACK_CATS.opts) to a `skills/` library
 * leaf id, so a workspace seeds the stack skills that match its chosen stack. A missing entry or
 * "None" means "no skill" (skipped). The skills-library loader additionally filters these to the
 * ids that actually exist on disk, so unknown/aspirational mappings degrade to a no-op.
 */
export const STACK_VALUE_TO_SKILL: Record<string, string> = {
  // language
  TypeScript: "typescript", JavaScript: "javascript", Python: "python", Go: "go", Rust: "rust",
  Java: "java", Kotlin: "kotlin", "C#": "csharp", Ruby: "ruby", PHP: "php", Elixir: "elixir",
  Swift: "swift", "C++": "cpp", Scala: "scala", Dart: "dart", C: "c", Clojure: "clojure",
  Haskell: "haskell", Lua: "lua", "Objective-C": "objectivec", Erlang: "erlang",
  // runtime
  "Node.js": "node", Bun: "bun", Deno: "deno", "Python 3": "python3", PyPy: "pypy",
  JVM: "jvm", ".NET": "dotnet", "BEAM (Erlang VM)": "beam",
  // frontend
  React: "react", Vue: "vue", Svelte: "svelte", Angular: "angular", SolidJS: "solidjs",
  Preact: "preact", Qwik: "qwik", Lit: "lit", "Alpine.js": "alpine",
  // meta / ssg
  "Next.js": "nextjs", Nuxt: "nuxt", Remix: "remix", SvelteKit: "sveltekit", Astro: "astro",
  Gatsby: "gatsby", "Vite (SPA)": "vite",
  // backend
  NestJS: "nestjs", Fastify: "fastify", Express: "express", Hono: "hono", Koa: "koa",
  Django: "django", Flask: "flask", FastAPI: "fastapi", "Spring Boot": "spring-boot", Spring: "spring",
  Laravel: "laravel", Symfony: "symfony", "Ruby on Rails": "rails", Gin: "gin", Fiber: "fiber",
  Actix: "actix", Phoenix: "phoenix", "ASP.NET Core": "aspnet-core", AdonisJS: "adonisjs",
  // mobile
  "React Native": "react-native", Flutter: "flutter",
  // database
  PostgreSQL: "postgresql", MySQL: "mysql", MariaDB: "mariadb", SQLite: "sqlite", MongoDB: "mongodb",
  Redis: "redis", Supabase: "supabase",
  // orm
  Prisma: "prisma", Drizzle: "drizzle", TypeORM: "typeorm", Sequelize: "sequelize",
  SQLAlchemy: "sqlalchemy", "Django ORM": "django-orm", Mongoose: "mongoose", GORM: "gorm",
  // styling
  "Tailwind CSS": "tailwind", "CSS Modules": "css-modules", "styled-components": "styled-components", Sass: "sass",
  // testing
  Jest: "jest", Vitest: "vitest", Cypress: "cypress", Playwright: "playwright",
  // container
  Docker: "docker", Podman: "podman",
  // queue
  BullMQ: "bullmq", RabbitMQ: "rabbitmq", Kafka: "kafka", Celery: "celery",
  // auth
  "Auth.js": "authjs", Keycloak: "keycloak",
  // ── library fill: stacks that now ship a dedicated SKILL.md ──
  // language
  R: "r",
  // frontend
  Ember: "ember", Backbone: "backbone",
  // meta / ssg
  Hugo: "hugo", Jekyll: "jekyll", Eleventy: "eleventy", Docusaurus: "docusaurus",
  // backend
  CodeIgniter: "codeigniter", GraphQL: "graphql", Nginx: "nginx",
  // mobile
  Android: "android", Ionic: "ionic", Xamarin: "xamarin", NativeScript: "nativescript",
  // styling
  Bootstrap: "bootstrap", Bulma: "bulma", Vuetify: "vuetify",
  // testing
  Selenium: "selenium", Mocha: "mocha", Jasmine: "jasmine", Puppeteer: "puppeteer",
  // ai / ml
  TensorFlow: "tensorflow", PyTorch: "pytorch", "scikit-learn": "scikit-learn", Keras: "keras",
  Pandas: "pandas", NumPy: "numpy", Jupyter: "jupyter",
  // data viz
  D3: "d3", "Chart.js": "chart-js", Grafana: "grafana", Plotly: "plotly",
  // infra / devops
  Azure: "azure", Jenkins: "jenkins", CircleCI: "circleci", Terraform: "terraform",
  Ansible: "ansible", Vagrant: "vagrant",
  // baas
  Firebase: "firebase", Appwrite: "appwrite", Amplify: "amplify", Heroku: "heroku",
};
