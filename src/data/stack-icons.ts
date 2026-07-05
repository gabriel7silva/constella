/**
 * Devicon icon mapping for the Project Stack picker. Each catalog option name maps to a devicon
 * slug + variant; `iconUrl(name)` builds the raw SVG URL on jsdelivr. Options without a devicon
 * entry (or whose SVG 404s) fall back to the 2-letter `.sc-mono` badge in the UI — so missing
 * icons degrade gracefully and the picker still works offline.
 *
 * Devicon: https://github.com/devicons/devicon — icons/<slug>/<slug>-<variant>.svg
 */
export type IconRef = { slug: string; variant?: "original" | "plain" | "original-wordmark" | "plain-wordmark" };

const CDN = "https://cdn.jsdelivr.net/gh/devicons/devicon/icons";

export const STACK_ICON: Record<string, IconRef> = {
  // ── languages ──
  TypeScript: { slug: "typescript" }, JavaScript: { slug: "javascript" }, Python: { slug: "python" },
  Go: { slug: "go", variant: "original-wordmark" }, Rust: { slug: "rust" }, Java: { slug: "java" },
  Kotlin: { slug: "kotlin" }, "C#": { slug: "csharp" }, Ruby: { slug: "ruby" }, PHP: { slug: "php" },
  Elixir: { slug: "elixir" }, Swift: { slug: "swift" }, "C++": { slug: "cplusplus" }, Scala: { slug: "scala" },
  Dart: { slug: "dart" }, C: { slug: "c" }, Clojure: { slug: "clojure" }, Haskell: { slug: "haskell" },
  Lua: { slug: "lua" }, R: { slug: "r" }, "Objective-C": { slug: "objectivec" }, Erlang: { slug: "erlang", variant: "plain" },

  // ── runtime ──
  "Node.js": { slug: "nodejs" }, Bun: { slug: "bun" }, Deno: { slug: "denojs" }, "Python 3": { slug: "python" },
  JVM: { slug: "java" }, ".NET": { slug: "dotnetcore" }, "BEAM (Erlang VM)": { slug: "erlang", variant: "plain" },

  // ── frontend ──
  React: { slug: "react" }, Vue: { slug: "vuejs" }, Svelte: { slug: "svelte" }, Angular: { slug: "angular" },
  SolidJS: { slug: "solidjs" }, "Alpine.js": { slug: "alpinejs" }, Ember: { slug: "ember" }, Backbone: { slug: "backbonejs" },
  "HTML/CSS": { slug: "html5" }, "Vanilla JS": { slug: "javascript" }, "Plain CSS": { slug: "css3" },

  // ── meta / ssg ──
  "Next.js": { slug: "nextjs" }, Nuxt: { slug: "nuxtjs" }, Remix: { slug: "remix" }, SvelteKit: { slug: "svelte" },
  Astro: { slug: "astro" }, Gatsby: { slug: "gatsby" }, "Vite (SPA)": { slug: "vitejs" }, Hugo: { slug: "hugo" },
  Jekyll: { slug: "jekyll", variant: "original-wordmark" },

  // ── backend ──
  NestJS: { slug: "nestjs" }, Fastify: { slug: "fastify" }, Express: { slug: "express" }, Koa: { slug: "koa" },
  Django: { slug: "django", variant: "plain" }, Flask: { slug: "flask" }, FastAPI: { slug: "fastapi" },
  "Spring Boot": { slug: "spring" }, Spring: { slug: "spring" }, Laravel: { slug: "laravel" }, "Ruby on Rails": { slug: "rails" },
  Gin: { slug: "go", variant: "original-wordmark" }, Phoenix: { slug: "phoenix" }, "ASP.NET Core": { slug: "dotnetcore" },
  Nginx: { slug: "nginx" }, GraphQL: { slug: "graphql" }, Symfony: { slug: "symfony" }, CodeIgniter: { slug: "codeigniter" },

  // ── database ──
  PostgreSQL: { slug: "postgresql" }, MySQL: { slug: "mysql" }, MariaDB: { slug: "mariadb" }, SQLite: { slug: "sqlite" },
  MongoDB: { slug: "mongodb" }, Redis: { slug: "redis" }, Cassandra: { slug: "cassandra" }, DynamoDB: { slug: "dynamodb" },
  Supabase: { slug: "supabase" },

  // ── orm ──
  Prisma: { slug: "prisma" }, Sequelize: { slug: "sequelize" }, SQLAlchemy: { slug: "sqlalchemy" },

  // ── styling ──
  "Tailwind CSS": { slug: "tailwindcss" }, "CSS Modules": { slug: "css3" }, Sass: { slug: "sass" },
  MUI: { slug: "materialui" }, Bootstrap: { slug: "bootstrap" }, Bulma: { slug: "bulma" }, Vuetify: { slug: "vuetify" },

  // ── container ──
  Docker: { slug: "docker" }, Podman: { slug: "podman" },

  // ── infra / devops ──
  Vercel: { slug: "vercel" }, Netlify: { slug: "netlify" }, AWS: { slug: "amazonwebservices", variant: "original-wordmark" },
  GCP: { slug: "googlecloud" }, Kubernetes: { slug: "kubernetes" }, Azure: { slug: "azure" }, Jenkins: { slug: "jenkins" },
  CircleCI: { slug: "circleci", variant: "plain" }, Terraform: { slug: "terraform" }, Ansible: { slug: "ansible" }, Vagrant: { slug: "vagrant" },

  // ── queue ──
  RabbitMQ: { slug: "rabbitmq" }, Kafka: { slug: "apachekafka" },

  // ── auth ──
  Auth0: { slug: "auth0", variant: "plain" }, Keycloak: { slug: "keycloak" },

  // ── mobile ──
  "React Native": { slug: "react" }, Flutter: { slug: "flutter" }, Android: { slug: "android" }, Ionic: { slug: "ionic" },
  Xamarin: { slug: "xamarin" }, NativeScript: { slug: "nativescript" },

  // ── ai / ml ──
  TensorFlow: { slug: "tensorflow" }, PyTorch: { slug: "pytorch" }, "scikit-learn": { slug: "scikitlearn" },
  Pandas: { slug: "pandas" }, NumPy: { slug: "numpy" }, Jupyter: { slug: "jupyter" },

  // ── testing ──
  Jest: { slug: "jest" }, Vitest: { slug: "vitest" }, Cypress: { slug: "cypressio" }, Playwright: { slug: "playwright" },
  Selenium: { slug: "selenium" }, Mocha: { slug: "mocha" }, Jasmine: { slug: "jasmine" }, Puppeteer: { slug: "puppeteer" },

  // ── data viz ──
  D3: { slug: "d3js" }, Grafana: { slug: "grafana" },

  // ── baas ──
  Firebase: { slug: "firebase" }, Appwrite: { slug: "appwrite" }, Heroku: { slug: "heroku" },
};

/** Raw devicon SVG URL for a stack option, or null when there's no mapped icon (UI shows the badge). */
export function iconUrl(name: string): string | null {
  const ref = STACK_ICON[name];
  if (!ref) return null;
  return `${CDN}/${ref.slug}/${ref.slug}-${ref.variant ?? "original"}.svg`;
}
