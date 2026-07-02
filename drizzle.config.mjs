// Plain-JS config (NOT .ts): the compiled distribution ships this under the user's `node_modules`, and
// Node refuses to strip TypeScript types for files under `node_modules` ("Stripping types is currently
// unsupported …"). `drizzle-kit migrate` loads this at first run, so it must be loadable without any
// TypeScript tooling. `out` + `schema` are relative to the dir `drizzle-kit` runs in.
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "file:./.constella/constella.db",
  },
  verbose: true,
  strict: true,
});
