// Plain-JS config (NOT .ts) on purpose: `next start` re-reads this at runtime, and the compiled
// distribution installs `dependencies` only — `typescript` isn't present for end users, so a .ts
// config would fail to load. JSDoc keeps editor types without a runtime TypeScript dependency.

/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Heavy/native packages Next must NOT bundle — loaded from node_modules at runtime.
  serverExternalPackages: ["better-sqlite3", "@playwright/test", "playwright-core", "playwright", "chromium-bidi"],
  typedRoutes: true,
  // Onboarding can upload a picked existing project (its text source files) to import it into the workspace.
  // The default 1MB Server Action body limit is too small for a real project; raise it (loopback, self-hosted).
  experimental: { serverActions: { bodySizeLimit: "48mb" } },
  // NOTE: `output: "standalone"` was removed. Its NFT tracer aborts on the dev-server manager's
  // runtime fs/spawn operations ("whole project traced unintentionally"), and its chdir into
  // `.next/standalone/` forked a separate DB. Plain `next start` serves assets + auto-loads `.env`
  // from the project root — simpler and correct for local prod. The npm package instead ships the
  // prebuilt `.next` directly (see package.json "files"), which is self-contained enough.
};

export default nextConfig;
