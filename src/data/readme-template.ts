/**
 * Deterministic, stack-aware README generator. Produces a polished, non-generic project README at
 * scaffold time — a capsule-render banner, shields badges derived from the chosen stack, a TOC,
 * About, a tech-stack table, an ASCII architecture, getting-started, configuration, commands,
 * structure, roadmap, contributing and license. No LLM, no fs — pure function of the context, so
 * it re-renders cheaply when the project's direction changes (it's in scaffold's MISSION_DOC_RE).
 *
 * Agents can then go further using the `readme-generation` skill — this is the strong baseline.
 */
import { STACK_CATS } from "./stack-catalog";
import { iconUrl } from "./stack-icons";

export type ReadmeCtx = { company: string; mission: string; objective: string; stack: Record<string, string>; slug?: string };

const CAT_LABEL: Record<string, string> = Object.fromEntries(STACK_CATS.map((c) => [c.key, c.label]));

// simple-icons slug + brand color per stack value (drives the shields badges). Unknown values fall
// back to a plain neutral badge so every pick still renders something.
const BADGE: Record<string, { logo: string; color: string }> = {
  TypeScript: { logo: "typescript", color: "3178C6" }, JavaScript: { logo: "javascript", color: "F7DF1E" },
  Python: { logo: "python", color: "3776AB" }, "Python 3": { logo: "python", color: "3776AB" },
  Go: { logo: "go", color: "00ADD8" }, Rust: { logo: "rust", color: "000000" }, Java: { logo: "openjdk", color: "ED8B00" },
  Kotlin: { logo: "kotlin", color: "7F52FF" }, "C#": { logo: "csharp", color: "512BD4" }, Ruby: { logo: "ruby", color: "CC342D" },
  PHP: { logo: "php", color: "777BB4" }, Elixir: { logo: "elixir", color: "4B275F" }, Swift: { logo: "swift", color: "F05138" },
  "C++": { logo: "cplusplus", color: "00599C" }, C: { logo: "c", color: "A8B9CC" }, Scala: { logo: "scala", color: "DC322F" },
  Dart: { logo: "dart", color: "0175C2" }, Clojure: { logo: "clojure", color: "5881D8" }, Haskell: { logo: "haskell", color: "5D4F85" },
  Lua: { logo: "lua", color: "2C2D72" }, R: { logo: "r", color: "276DC3" }, Erlang: { logo: "erlang", color: "A90533" },
  "Node.js": { logo: "nodedotjs", color: "5FA04E" }, Bun: { logo: "bun", color: "000000" }, Deno: { logo: "deno", color: "70FFAF" },
  ".NET": { logo: "dotnet", color: "512BD4" },
  React: { logo: "react", color: "61DAFB" }, Vue: { logo: "vuedotjs", color: "4FC08D" }, Svelte: { logo: "svelte", color: "FF3E00" },
  Angular: { logo: "angular", color: "DD0031" }, SolidJS: { logo: "solid", color: "2C4F7C" }, Preact: { logo: "preact", color: "673AB8" },
  Qwik: { logo: "qwik", color: "AC7EF4" }, "Alpine.js": { logo: "alpinedotjs", color: "8BC0D0" }, Ember: { logo: "emberdotjs", color: "E04E39" },
  "Next.js": { logo: "nextdotjs", color: "000000" }, Nuxt: { logo: "nuxtdotjs", color: "00DC82" }, Remix: { logo: "remix", color: "000000" },
  SvelteKit: { logo: "svelte", color: "FF3E00" }, Astro: { logo: "astro", color: "BC52EE" }, Gatsby: { logo: "gatsby", color: "663399" },
  "Vite (SPA)": { logo: "vite", color: "646CFF" }, Hugo: { logo: "hugo", color: "FF4088" }, Jekyll: { logo: "jekyll", color: "CC0000" },
  NestJS: { logo: "nestjs", color: "E0234E" }, Fastify: { logo: "fastify", color: "000000" }, Express: { logo: "express", color: "000000" },
  Hono: { logo: "hono", color: "E36002" }, Koa: { logo: "koa", color: "33333D" }, Django: { logo: "django", color: "092E20" },
  Flask: { logo: "flask", color: "000000" }, FastAPI: { logo: "fastapi", color: "009688" }, "Spring Boot": { logo: "springboot", color: "6DB33F" },
  Spring: { logo: "spring", color: "6DB33F" }, Laravel: { logo: "laravel", color: "FF2D20" }, Symfony: { logo: "symfony", color: "000000" },
  "Ruby on Rails": { logo: "rubyonrails", color: "D30001" }, Gin: { logo: "gin", color: "008ECF" }, Phoenix: { logo: "phoenixframework", color: "FD4F00" },
  "ASP.NET Core": { logo: "dotnet", color: "512BD4" }, GraphQL: { logo: "graphql", color: "E10098" }, Nginx: { logo: "nginx", color: "009639" },
  "React Native": { logo: "react", color: "61DAFB" }, Flutter: { logo: "flutter", color: "02569B" }, Android: { logo: "android", color: "3DDC84" },
  Ionic: { logo: "ionic", color: "3880FF" },
  PostgreSQL: { logo: "postgresql", color: "4169E1" }, MySQL: { logo: "mysql", color: "4479A1" }, MariaDB: { logo: "mariadb", color: "003545" },
  SQLite: { logo: "sqlite", color: "003B57" }, MongoDB: { logo: "mongodb", color: "47A248" }, Redis: { logo: "redis", color: "FF4438" },
  Cassandra: { logo: "apachecassandra", color: "1287B1" }, DynamoDB: { logo: "amazondynamodb", color: "4053D6" }, Supabase: { logo: "supabase", color: "3FCF8E" },
  Prisma: { logo: "prisma", color: "2D3748" }, Drizzle: { logo: "drizzle", color: "C5F74F" }, TypeORM: { logo: "typeorm", color: "FE0803" },
  Sequelize: { logo: "sequelize", color: "52B0E7" }, SQLAlchemy: { logo: "sqlalchemy", color: "D71F00" },
  "Tailwind CSS": { logo: "tailwindcss", color: "06B6D4" }, "CSS Modules": { logo: "cssmodules", color: "000000" },
  "styled-components": { logo: "styledcomponents", color: "DB7093" }, Sass: { logo: "sass", color: "CC6699" }, MUI: { logo: "mui", color: "007FFF" },
  Bootstrap: { logo: "bootstrap", color: "7952B3" }, Bulma: { logo: "bulma", color: "00D1B2" }, Vuetify: { logo: "vuetify", color: "1867C0" },
  Jest: { logo: "jest", color: "C21325" }, Vitest: { logo: "vitest", color: "6E9F18" }, Cypress: { logo: "cypress", color: "69D3A7" },
  Playwright: { logo: "playwright", color: "2EAD33" }, Selenium: { logo: "selenium", color: "43B02A" }, Mocha: { logo: "mocha", color: "8D6748" },
  TensorFlow: { logo: "tensorflow", color: "FF6F00" }, PyTorch: { logo: "pytorch", color: "EE4C2C" }, "scikit-learn": { logo: "scikitlearn", color: "F7931E" },
  Keras: { logo: "keras", color: "D00000" }, Pandas: { logo: "pandas", color: "150458" }, NumPy: { logo: "numpy", color: "013243" }, Jupyter: { logo: "jupyter", color: "F37626" },
  D3: { logo: "d3dotjs", color: "F9A03C" }, "Chart.js": { logo: "chartdotjs", color: "FF6384" }, Grafana: { logo: "grafana", color: "F46800" }, Plotly: { logo: "plotly", color: "3F4F75" },
  Docker: { logo: "docker", color: "2496ED" }, Podman: { logo: "podman", color: "892CA0" },
  Vercel: { logo: "vercel", color: "000000" }, Netlify: { logo: "netlify", color: "00C7B7" }, AWS: { logo: "amazonwebservices", color: "232F3E" },
  GCP: { logo: "googlecloud", color: "4285F4" }, Azure: { logo: "microsoftazure", color: "0078D4" }, Kubernetes: { logo: "kubernetes", color: "326CE5" },
  Cloudflare: { logo: "cloudflare", color: "F38020" }, Jenkins: { logo: "jenkins", color: "D24939" }, CircleCI: { logo: "circleci", color: "343434" },
  Terraform: { logo: "terraform", color: "7B42BC" }, Ansible: { logo: "ansible", color: "EE0000" },
  Firebase: { logo: "firebase", color: "DD2C00" }, Appwrite: { logo: "appwrite", color: "FD366E" }, Heroku: { logo: "heroku", color: "430098" },
  BullMQ: { logo: "bull", color: "CB0000" }, RabbitMQ: { logo: "rabbitmq", color: "FF6600" }, Kafka: { logo: "apachekafka", color: "231F20" }, Celery: { logo: "celery", color: "37814A" },
  "Auth.js": { logo: "auth0", color: "EB5424" }, Clerk: { logo: "clerk", color: "6C47FF" }, Auth0: { logo: "auth0", color: "EB5424" }, Keycloak: { logo: "keycloak", color: "4D4D4D" },
};

// Deterministic project palette (capsule banner) from the company name — gives each project its own
// identity without any randomness (Math.random isn't available in this environment anyway).
const PALETTES = [
  { c1: "0E0D17", c2: "E0A44E" }, { c1: "0B1120", c2: "38BDF8" }, { c1: "1A0B2E", c2: "A855F7" },
  { c1: "0A1F1C", c2: "2DD4BF" }, { c1: "1F0A0A", c2: "F87171" }, { c1: "0A0A1F", c2: "6366F1" },
  { c1: "131A0A", c2: "A3E635" }, { c1: "1F140A", c2: "FB923C" },
];
function paletteFor(name: string) {
  let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTES[h % PALETTES.length];
}

const enc = (s: string) => encodeURIComponent(s);
function anchor(s: string): string { return s.toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-"); }
function shieldLabel(s: string): string { return s.replace(/-/g, "--").replace(/_/g, "__").replace(/ /g, "_"); }

/** A shields.io badge for one stack value (branded when known, neutral otherwise). */
function badgeFor(value: string): string {
  const b = BADGE[value];
  const label = shieldLabel(value);
  return b
    ? `![${value}](https://img.shields.io/badge/${label}-${b.color}?style=for-the-badge&logo=${b.logo}&logoColor=white)`
    : `![${value}](https://img.shields.io/badge/${label}-2B2D42?style=for-the-badge)`;
}

function nonEmpty(stack: Record<string, string>): [string, string][] {
  return Object.entries(stack || {}).filter(([, v]) => v && v !== "None" && v.trim());
}

function stackTable(stack: Record<string, string>): string {
  const rows = nonEmpty(stack).map(([k, v]) => {
    const icon = iconUrl(v);
    const img = icon ? `<img src="${icon}" width="18" height="18" align="center" /> ` : "";
    return `| **${CAT_LABEL[k] ?? k}** | ${img}${v} |`;
  });
  return `| Layer | Technology |\n| :-- | :-- |\n${rows.join("\n")}`;
}

function architectureAscii(s: Record<string, string>): string {
  const fe = s.frontend || s.mobile || "—";
  const meta = s.meta && s.meta !== "None" ? ` · ${s.meta}` : "";
  const be = s.backend && s.backend !== "None" ? s.backend : (s.runtime || "—");
  const db = s.database || "—";
  const orm = s.orm && s.orm !== "None" ? ` (${s.orm})` : "";
  return [
    "```",
    "┌──────────────────────────────────────────────────────────┐",
    `│  CLIENT     ${fe}${meta}`.padEnd(59) + "│",
    "├──────────────────────────────────────────────────────────┤",
    `│  SERVER     ${be}  ·  runtime: ${s.runtime || "—"}`.padEnd(59) + "│",
    "├──────────────────────────────────────────────────────────┤",
    `│  DATA       ${db}${orm}`.padEnd(59) + "│",
    "└──────────────────────────────────────────────────────────┘",
    "```",
  ].join("\n");
}

function installFor(s: Record<string, string>): { install: string; dev: string; build: string; test: string } {
  const rt = s.runtime || "", lang = s.language || "";
  if (rt === "Bun") return { install: "bun install", dev: "bun run dev", build: "bun run build", test: "bun test" };
  if (rt === "Deno") return { install: "deno install", dev: "deno task dev", build: "deno task build", test: "deno test" };
  if (/Python/.test(rt) || lang === "Python") return { install: "pip install -r requirements.txt", dev: "python main.py", build: "python -m build", test: "pytest" };
  if (lang === "Go") return { install: "go mod download", dev: "go run .", build: "go build ./...", test: "go test ./..." };
  if (lang === "Rust") return { install: "cargo build", dev: "cargo run", build: "cargo build --release", test: "cargo test" };
  return { install: "npm install", dev: "npm run dev", build: "npm run build", test: "npm test" };
}

/** Build the full README markdown for a freshly-scaffolded project. */
export function buildReadme(c: ReadmeCtx): string {
  const { company, mission, objective, stack } = c;
  const pal = paletteFor(company);
  const cmds = installFor(stack);
  const entries = nonEmpty(stack);

  const banner = `https://capsule-render.vercel.app/api?type=waving&height=200&color=0:${pal.c1},100:${pal.c2}&text=${enc(company)}&fontColor=ffffff&fontSize=64&fontAlignY=38&desc=${enc((mission || "").slice(0, 90))}&descAlignY=58&descSize=16&descColor=ffffff`;

  // Headline badges from the most defining picks.
  const headlineKeys = ["language", "runtime", "meta", "frontend", "backend", "mobile", "database", "orm", "styling", "container"];
  const headline = headlineKeys
    .map((k) => stack[k]).filter((v): v is string => !!v && v !== "None")
    .filter((v, i, a) => a.indexOf(v) === i).slice(0, 8).map(badgeFor).join("\n");

  return `<div align="center">

<img src="${banner}" alt="${company}" />

# ${company}

**${(mission || `${company} — built with Constella.`).trim()}**

${headline}
![License](https://img.shields.io/badge/license-MIT-2B2D42?style=for-the-badge)
![Built with Constella](https://img.shields.io/badge/built_with-Constella-E0A44E?style=for-the-badge)

</div>

---

## 📑 Table of Contents

- [About](#-about)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Getting Started](#-getting-started)
- [Usage](#-usage)
- [Configuration](#-configuration)
- [Commands](#-commands)
- [Project Structure](#-project-structure)
- [Roadmap](#-roadmap)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🎯 About

> ${(mission || "Mission to be defined.").trim()}

${objective ? `**Objective —** ${objective.trim()}\n` : ""}
This repository is operated by an autonomous AI team (a CEO plus specialists) scaffolded with **[Constella](#)**. The working directory is the source of truth.

---

## 🧩 Tech Stack

${entries.length ? stackTable(stack) : "_No stack selected yet._"}

---

## 🏗️ Architecture

${architectureAscii(stack)}

---

## 🚀 Getting Started

> **Prerequisites:** ${stack.runtime || stack.language || "the project runtime"}${stack.container && stack.container !== "None" ? ` · ${stack.container} (optional)` : ""}

\`\`\`bash
# 1. Clone
git clone <your-repo-url>
cd ${c.slug || anchor(company) || "project"}

# 2. Install dependencies
${cmds.install}

# 3. Configure environment
cp .env.example .env   # then fill in the values below

# 4. Run the dev server
${cmds.dev}
\`\`\`

---

## 💡 Usage

After \`${cmds.dev}\`, open the app and follow the in-product flow. See [\`DOCS/\`](./DOCS) for module-level guides and [\`PO/roadmap.md\`](./PO/roadmap.md) for what's planned.

---

## ⚙️ Configuration

Environment variables live in \`.env\` (never commit it — secrets belong in the vault).

| Variable | Description | Required |
| :-- | :-- | :--: |
| \`NODE_ENV\` | \`development\` / \`production\` | ✅ |
${stack.database && stack.database !== "None" ? `| \`DATABASE_URL\` | ${stack.database} connection string | ✅ |\n` : ""}| \`PORT\` | Port the server listens on | ⬜ |

> 🔒 Never hard-code API keys, tokens or passwords. A pre-commit secret scan blocks any commit that contains them.

---

## 🛠️ Commands

| Command | What it does |
| :-- | :-- |
| \`${cmds.dev}\` | Start the dev server |
| \`${cmds.build}\` | Production build |
| \`${cmds.test}\` | Run the test suite |

---

## 📁 Project Structure

\`\`\`
${c.slug || anchor(company) || "project"}/
├── .claude/        # agent personas, skills, operating manual (the brain)
├── DOCS/           # architecture, API, database, standards
├── PO/             # roadmap, backlog, sprint plan, requirements
├── specs/          # detailed specs written by the CEO planner
├── issues/         # approved issues the agents implement
├── Reports/        # status, health, pulse, daily/weekly reports
└── README.md       # this file
\`\`\`

---

## 🗺️ Roadmap

- [x] Project scaffolded & team assembled
- [ ] Core feature set (see [\`PO/roadmap.md\`](./PO/roadmap.md))
- [ ] Tests green & CI wired
- [ ] First release

![Progress](https://img.shields.io/badge/progress-bootstrapping-E0A44E?style=flat-square)

---

## 🤝 Contributing

Contributions are welcome. Read [\`DOCS/code-standards.md\`](./DOCS/code-standards.md) first, branch from \`main\`, keep PRs small with a clear test plan, and ensure \`${cmds.test}\` passes before requesting review.

---

## 📄 License

Released under the **MIT License** — see [\`LICENSE\`](./LICENSE).

<div align="center">
<sub>Scaffolded & maintained by an autonomous AI team · 🤖 <a href="#">Constella</a></sub>
</div>
`;
}
