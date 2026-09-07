/**
 * Shared (client + server) rules for importing an EXISTING project — which directories to never copy and
 * which files count as importable text. Kept dependency-free (no node/server imports) so the onboarding
 * folder-picker (client) and the server-side walk/clone use the SAME filter and land the same files.
 */

// Dependency / build / cache / editor / runtime-data directories — never copied when importing a project.
// Without this a Django `.venv`, a JVM/Rust `target`, a .NET `bin/obj` etc. floods the workspace.
export const IMPORT_SKIP_DIRS = new Set<string>([
  // JS / web
  "node_modules", ".git", ".next", ".turbo", "dist", "build", "out", "coverage", ".cache",
  ".pnpm-store", ".vercel", "vendor", ".parcel-cache", ".svelte-kit", ".nuxt", ".astro", ".angular",
  // Python
  ".venv", "venv", "env", "__pycache__", ".mypy_cache", ".pytest_cache", ".ruff_cache",
  ".tox", ".nox", "htmlcov", "site-packages", ".eggs", ".ipynb_checkpoints",
  // JVM / .NET / native / Rust / Go / mobile
  "target", ".gradle", "bin", "obj", "Pods", ".cargo", "Carthage", ".cxx", "DerivedData",
  // editors / VCS / OS
  ".idea", ".vscode", ".svn", ".hg", ".vs", ".fleet",
  // runtime data / scratch (not source)
  "logs", "tmp", "temp", ".terraform", "archives", ".testdev",
]);

// Text/source files worth importing (extension allow-list — keeps binaries, media, DBs and archives out).
export const TEXT_EXT = /\.(py|pyi|pyw|js|jsx|ts|tsx|mjs|cjs|mts|cts|json|jsonc|html?|css|scss|sass|less|styl|md|markdown|mdx|txt|rst|yml|yaml|toml|ini|cfg|conf|env|example|sample|sh|bash|zsh|bat|cmd|ps1|sql|graphql|gql|prisma|xml|svg|vue|svelte|astro|go|rs|java|kt|kts|scala|clj|rb|erb|php|blade|c|h|cpp|cc|hpp|cs|fs|swift|m|mm|dart|lua|r|ex|exs|erl|hrl|gradle|properties|lock|proto|tf|tfvars|dockerfile|dockerignore|gitignore|gitattributes|editorconfig|prettierrc|eslintrc|babelrc|npmrc|nvmrc|browserslistrc)$/i;

// Extensionless files that are still text/config (matched case-insensitively on the basename).
const NO_EXT_TEXT = new Set<string>([
  "dockerfile", "makefile", "procfile", "rakefile", "gemfile", "brewfile", "vagrantfile",
  "license", "licence", "readme", "changelog", "authors", "contributors", "notice", "codeowners",
]);

/** True if a path segment is a dependency/build/cache dir that must not be imported. */
export function isSkipDir(name: string): boolean {
  return IMPORT_SKIP_DIRS.has(name);
}

/** True if a file basename is importable text (by extension, or a known extensionless config file). */
export function isTextFile(basename: string): boolean {
  if (TEXT_EXT.test(basename)) return true;
  return NO_EXT_TEXT.has(basename.toLowerCase());
}
