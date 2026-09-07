// Flat ESLint config (ESLint 9 / Next 16 — `next lint` was removed, run `eslint` directly).
// Single purpose: an anti-regression guard for the i18n pass. It flags hardcoded user-visible
// text in JSX so new strings get routed through the i18n dict (useT()/getT()) instead of being
// typed inline. It deliberately does NOT enable the full recommended rule sets — this is a
// targeted i18n guard, not a general linter.
//
// Requires (dev): eslint, eslint-plugin-react, typescript-eslint
//   pnpm add -D eslint eslint-plugin-react typescript-eslint
//
// Scripts: `pnpm lint` (whole tree) · `pnpm lint:i18n` (just UI dirs).
import react from "eslint-plugin-react";
import tseslint from "typescript-eslint";

// The codebase carries legacy `// eslint-disable-next-line @next/next/* | react-hooks/*` comments
// from a `next lint` setup that was never wired (Next 16 removed `next lint`). This guard is
// i18n-only, so it doesn't load those plugins — but an undefined rule in a disable directive is a
// hard error. Stub the two namespaces with a Proxy that returns a no-op rule for ANY name, so the
// legacy directives resolve without pulling extra deps. `reportUnusedDisableDirectives: off` keeps
// the now-inert directives from spamming warnings.
const noopRule = { create: () => ({}) };
const stubPlugin = { rules: new Proxy({}, { get: () => noopRule }) };

export default [
  {
    ignores: [
      ".next/**", "node_modules/**", "dist/**", "build/**", "bin/**", "scripts/**",
      "drizzle/**", "skills/**", "public/**",
      "src/lib/i18n.ts", // the dict itself is all strings — never lint it
    ],
  },
  {
    files: ["src/components/**/*.tsx", "src/app/**/*.tsx"],
    linterOptions: { reportUnusedDisableDirectives: "off" },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true }, sourceType: "module" },
    },
    plugins: { react, "react-hooks": stubPlugin, "@next/next": stubPlugin },
    settings: { react: { version: "detect" } },
    rules: {
      // noStrings flags JSX text + (when ignoreProps:false) attribute strings.
      // Phase 1 ships with ignoreProps:true (text first); flip to false to also catch
      // hardcoded title=/placeholder=/aria-label= once the text pass is clean.
      "react/jsx-no-literals": ["warn", {
        noStrings: true,
        ignoreProps: true,
        noAttributeStrings: false,
        // allowedStrings matches the WHOLE trimmed JSX text node (not a substring), so listing a
        // proper noun here permits only a node that is exactly that word — it cannot mask a real
        // sentence. Two groups: (1) symbols/separators/affordances, (2) the reviewed kept-English
        // literals from the i18n pass (proper nouns, file paths, hosts, locale/enum VALUES, CLI).
        // Add to group 2 only after confirming a string is genuinely non-translatable.
        allowedStrings: [
          // — group 1: symbols, separators, keyboard/affordance glyphs, emoji —
          "·", "—", "–", "•", "…", "/", "@", "#", "$", "%", "&", "|", ":", ".", "-", "+", "*",
          "✓", "✕", "×", "▾", "▸", "▴", "▿", "⚠", "☁", "⌘", "↗", "→", "←", "↑", "↓", "()", "{}", "[]",
          "(", ")", "[", "]", "{", "}", ",", ";", "=", "~", "v", "%)", "--", ".*", "/$", "0.5",
          "Aa", "ab", "k", "••••", "↵", "⇧↵", "−", "⊘", "▶", "●", "✖", "🎉", "🔕",
          "◧", "M", "&lt;", "&gt; ·", "&ldquo;", "&rdquo;",
          // — group 2: reviewed kept-English literals (proper nouns / paths / hosts / values / CLI) —
          "Constella", "Telegram", "RAG", "GPU", "CPU", "VRAM", "UTC", "OP",
          "English (US)", "Português (BR)", "Español",
          "America/New_York", "America/Sao_Paulo", "Europe/Lisbon",
          "read", "full", "repo, deploy", "spec", "issue", "kb",
          ".md", "· .md", "/SYSTEM.md", ".claude/agents/", "specs/", "skills/", "mock/", "design-mock/", "origin", "origin/",
          "constella.yaml", "company.yaml", "./company.yaml", "~/.constella/config.yaml",
          "ollama", "qwen2.5-coder:7b", "nomic-embed-text-v1.5",
          "github.com", "127.0.0.1", "127.0.0.1:11434", "127.0.0.1:8082 ·", "127.0.0.1:8083 ·",
          "@BotFather", "@userinfobot", "/newbot", "constella --", "npm i -g constella@", "better-auth ·",
          "GGUF (HuggingFace) ·", "· llama.cpp GGUF", "· @", "· v", "· @ada (CEO)",
          "· HTML, CSS, JS, MD", "· Reports/system-health.md",
        ],
      }],
    },
  },
];
